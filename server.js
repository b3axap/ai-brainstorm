try { require('dotenv/config'); } catch(e) { /* dotenv optional, Replit uses Secrets */ }
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { getAgent, getAgentSummaries } = require('./agents');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// --- Claude client (lazy init) ---
let anthropic = null;
function getAnthropicClient() {
  if (!anthropic) {
    const Anthropic = require('@anthropic-ai/sdk');
    const AnthropicClass = Anthropic.default || Anthropic;
    anthropic = new AnthropicClass();
  }
  return anthropic;
}

// Health check for Replit
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// --- In-memory rooms ---
const rooms = {};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

const COLORS = ['#6c5ce7', '#00cec9', '#fdcb6e', '#fd79a8', '#74b9ff', '#ff6b6b', '#a29bfe', '#55efc4'];

// --- Context builder: keeps canvas aware of the idea ---
function buildContext(room) {
  const userNames = room.users.map(u => u.name).join(', ') || 'none';
  const artifactList = room.artifacts.map(a => `- [${a.type}] "${a.title}" by ${a.author}`).join('\n') || 'none yet';

  const systemBase = `You are an AI brainstorming partner in a collaborative room.
Room ID: ${room.id}
Active users: ${userNames}
Existing artifacts in this session:
${artifactList}

Your job is to help users develop their ideas, make connections between different perspectives, and suggest useful visualizations.`;

  // Build messages array with user attribution
  let msgs = room.messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.role === 'user' ? `[${m.userName}]: ${m.content}` : m.content
  }));

  // Trim if too long: keep first 5 + last 30
  if (msgs.length > 50) {
    msgs = [...msgs.slice(0, 5), { role: 'user', content: '[... earlier messages trimmed ...]' }, ...msgs.slice(-30)];
  }

  return { systemBase, messages: msgs };
}

// --- Chat analysis: Claude responds with structured flow ---
async function handleChatAnalysis(room, socket) {
  const { systemBase, messages } = buildContext(room);
  const agentList = getAgentSummaries()
    .map(a => `${a.id}: ${a.icon} ${a.name} — ${a.description}`)
    .join('\n');

  // Track conversation phase
  const userMsgCount = room.messages.filter(m => m.role === 'user').length;
  const isFirstMessage = userMsgCount <= 1;
  const mandatoryDone = room.mandatoryQuestionsDone || false;
  // After mandatory phase, count user messages since mandatory was completed
  const msgsSinceMandatory = mandatoryDone ? (userMsgCount - (room.mandatoryDoneAtMsg || 0)) : 0;
  const shouldOfferCanvas = mandatoryDone && (msgsSinceMandatory === 1 || msgsSinceMandatory % 3 === 0);

  let phasePrompt;
  if (isFirstMessage) {
    phasePrompt = `This is the user's FIRST message about their idea.

STRICT STRUCTURE for your response:
1. **SUMMARY** — Briefly restate the idea in 2-3 sentences. Show you understand the core concept and its value.
2. **MANDATORY QUESTIONS** — You MUST ask exactly 4 questions to deeply understand the idea. These questions should cover:
   - Target audience / users
   - Core problem being solved or key value proposition
   - Scale / scope (MVP vs full product, market size, etc.)
   - Key differentiator or unique angle
   Each question MUST have 2-3 short answer options for the user to click.

In the JSON block, include:
{"questions": [{"q": "...", "options": ["...", "..."]}, ...4 items], "phase": "mandatory"}`;
  } else if (!mandatoryDone) {
    phasePrompt = `The user is answering mandatory discovery questions. Acknowledge their answers briefly, then continue with any remaining mandatory questions (total should reach 4).

If all 4 mandatory questions have been answered, respond with a brief synthesis of what you've learned and set phase to "mandatory_done".

In the JSON block:
- If more questions needed: {"questions": [...remaining], "phase": "mandatory"}
- If all 4 answered: {"phase": "mandatory_done", "suggest": ["agent_id_1", "agent_id_2", "agent_id_3"]}`;
  } else {
    phasePrompt = `The mandatory discovery phase is complete. You are now in FREE BRAINSTORM mode.
Respond naturally. Help develop the idea further. You may ask 0-3 follow-up questions if something new comes up.

${shouldOfferCanvas ? 'IMPORTANT: Include "offer_canvas": true in the JSON to show the user a "Generate to Canvas" button with visualization options.' : ''}

In the JSON block, always include:
- "suggest": array of 2-3 best visualization types for this idea
- "questions": optional array of 0-3 question objects (only if genuinely needed)
${shouldOfferCanvas ? '- "offer_canvas": true' : ''}
- "phase": "free"`;
  }

  const systemPrompt = `${systemBase}

RESPONSE STRUCTURE:

${phasePrompt}

AVAILABLE VISUALIZATION TYPES:
${agentList}

CHOOSING THE RIGHT VISUALIZATION:
- Comparing options? → table, pros_cons, matrix
- Breaking down a concept? → mindmap
- Planning phases? → timeline, kanban
- Analyzing strengths/weaknesses? → swot, pros_cons
- Process or flow? → diagram
- Custom/interactive? → freeform
- Quick insight? → quote_card

JSON FORMAT (must be the LAST thing in your response, on its own line):
- "phase": "mandatory" | "mandatory_done" | "free"
- "questions": array of question objects with "q" and "options" (2-3 options each)
- "suggest": array of 2-3 agent IDs (required when phase is "mandatory_done" or "free")
- "offer_canvas": true (only when explicitly told to include it above)

Examples:
{"questions": [{"q": "Who is the target audience?", "options": ["B2B", "B2C", "Both"]}], "phase": "mandatory"}

{"phase": "mandatory_done", "suggest": ["mindmap", "table", "diagram"]}

{"suggest": ["swot", "pros_cons"], "phase": "free", "offer_canvas": true}

{"questions": [{"q": "Have you considered monetization?", "options": ["Subscription", "Freemium", "One-time"]}], "suggest": ["table", "mindmap"], "phase": "free"}

Rules:
- The JSON block must be the LAST thing in your response, on its own line.
- During mandatory phase: ALWAYS include exactly 4 questions on first message.
- During free phase: questions are optional (0-3).
- Keep text concise. No fluff.
- Use Russian language if the user writes in Russian.`;

  try {
    let fullResponse = '';

    const stream = getAnthropicClient().messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages
    });

    stream.on('text', (text) => {
      fullResponse += text;
      io.to(room.id).emit('claude-chunk', { roomId: room.id, chunk: text });
    });

    await stream.finalMessage();

    // Parse JSON block at end
    let suggestedTypes = [];
    let clarifyQuestions = [];
    let phase = '';
    let offerCanvas = false;

    // Try to find any JSON block at the end of the response
    const jsonMatch = fullResponse.match(/\{[\s\S]*"phase"\s*:[\s\S]*\}$/m)
      || fullResponse.match(/\{[^{}]*"phase"\s*:[^{}]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestedTypes = parsed.suggest || [];
        clarifyQuestions = parsed.questions || [];
        phase = parsed.phase || '';
        offerCanvas = parsed.offer_canvas || false;
      } catch (e) { /* ignore parse error */ }
    }

    // Fallback: try to find any JSON with questions or suggest
    if (!phase) {
      const fallback = fullResponse.match(/\{[^{}]*"(?:suggest|questions)"\s*:\s*\[[^\]]*\][^{}]*\}/);
      if (fallback) {
        try {
          const parsed = JSON.parse(fallback[0]);
          suggestedTypes = parsed.suggest || [];
          clarifyQuestions = parsed.questions || [];
        } catch(e) {}
      }
    }

    // Track mandatory phase completion
    if (phase === 'mandatory_done' && !room.mandatoryQuestionsDone) {
      room.mandatoryQuestionsDone = true;
      room.mandatoryDoneAtMsg = room.messages.filter(m => m.role === 'user').length;
      offerCanvas = true; // Always offer canvas right after mandatory phase
    }

    // Clean response text (remove JSON block)
    const cleanResponse = fullResponse
      .replace(/\{[\s\S]*"phase"\s*:[\s\S]*\}$/m, '')
      .replace(/\{[^{}]*"phase"\s*:[^{}]*\}/, '')
      .replace(/\{[^{}]*"suggest"\s*:\s*\[[^\]]*\][^{}]*\}/, '')
      .replace(/\{[^{}]*"questions"\s*:\s*\[[^\]]*\][^{}]*\}/, '')
      .trim();

    // Store assistant message
    room.messages.push({
      id: generateId(),
      role: 'assistant',
      content: cleanResponse,
      userName: 'Claude',
      timestamp: Date.now()
    });

    io.to(room.id).emit('claude-done', {
      roomId: room.id,
      fullMessage: cleanResponse,
      suggestedTypes: suggestedTypes,
      clarifyQuestions: clarifyQuestions,
      phase: phase,
      offerCanvas: offerCanvas
    });

  } catch (error) {
    console.error('Claude chat error:', error.message);
    io.to(room.id).emit('generation-error', {
      roomId: room.id,
      message: 'Failed to get Claude response: ' + error.message
    });
  }
}

// --- Artifact generation ---
async function handleArtifactGeneration(room, type, userName, socket) {
  const agent = getAgent(type);
  if (!agent) {
    socket.emit('generation-error', { roomId: room.id, message: `Unknown agent type: ${type}` });
    return;
  }

  io.to(room.id).emit('artifact-generating', { roomId: room.id, type, status: 'working' });

  // External API agents (placeholder for now)
  if (agent.externalAPI) {
    // Step 1: Ask Claude to formulate a prompt
    const { systemBase, messages } = buildContext(room);
    try {
      const response = await getAnthropicClient().messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: `${systemBase}\n\n${agent.systemPrompt}`,
        messages: messages
      });

      const text = response.content[0].text;
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { prompt: text, style: 'illustration' };
      }

      // Placeholder: no actual API call yet
      data.imageUrl = null;
      data.placeholder = true;

      const artifact = {
        id: generateId(),
        type: agent.id,
        title: data.prompt ? data.prompt.substring(0, 40) + '...' : 'Generated Image',
        data: data,
        author: userName,
        renderer: agent.renderer,
        icon: agent.icon,
        timestamp: Date.now(),
        position: { x: 50 + Math.random() * 400, y: 50 + Math.random() * 300 }
      };

      room.artifacts.push(artifact);
      io.to(room.id).emit('artifact-created', { roomId: room.id, artifact });
    } catch (error) {
      socket.emit('generation-error', { roomId: room.id, message: error.message });
    }
    return;
  }

  // Claude-based agents
  const { systemBase, messages } = buildContext(room);
  const fullSystem = `${systemBase}\n\n${agent.systemPrompt}`;

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: fullSystem,
      messages: messages
    });

    const text = response.content[0].text;
    let data;

    // Try to parse JSON from response
    try {
      // Try full text as JSON
      data = JSON.parse(text);
    } catch {
      // Try to extract JSON block
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          data = JSON.parse(jsonMatch[0]);
        } catch {
          // Retry with stricter prompt
          console.log(`Retrying ${type} generation (invalid JSON)...`);
          const retry = await getAnthropicClient().messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            system: fullSystem + '\n\nCRITICAL: Output ONLY valid JSON. No markdown, no explanation, no code fences. Just the JSON object.',
            messages: messages
          });
          const retryText = retry.content[0].text;
          try {
            data = JSON.parse(retryText);
          } catch {
            const retryMatch = retryText.match(/\{[\s\S]*\}/);
            data = retryMatch ? JSON.parse(retryMatch[0]) : { error: 'Failed to parse', raw: retryText };
          }
        }
      } else {
        data = { error: 'No JSON in response', raw: text };
      }
    }

    const artifact = {
      id: generateId(),
      type: agent.id,
      title: data.title || data.center || agent.name + ' visualization',
      data: data,
      author: userName,
      renderer: agent.renderer,
      icon: agent.icon,
      timestamp: Date.now(),
      position: { x: 50 + room.artifacts.length * 60 + Math.random() * 200, y: 50 + room.artifacts.length * 40 + Math.random() * 200 }
    };

    room.artifacts.push(artifact);
    io.to(room.id).emit('artifact-created', { roomId: room.id, artifact });

  } catch (error) {
    console.error(`Agent ${type} error:`, error.message);
    socket.emit('generation-error', { roomId: room.id, message: error.message });
  }
}

// --- Socket.IO events ---
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, userName }) => {
    let room;

    if (roomId && rooms[roomId]) {
      room = rooms[roomId];
    } else {
      const id = roomId || generateRoomId();
      room = {
        id: id,
        messages: [],
        artifacts: [],
        users: [],
        mandatoryQuestionsDone: false,
        mandatoryDoneAtMsg: 0
      };
      rooms[id] = room;
    }

    const user = {
      socketId: socket.id,
      name: userName,
      color: COLORS[room.users.length % COLORS.length]
    };
    room.users.push(user);
    socket.join(room.id);

    // Send full room state to joining user
    socket.emit('room-joined', { room, user });

    // Notify others
    socket.to(room.id).emit('user-joined', { user });

    // Store room reference on socket for disconnect
    socket.roomId = room.id;
    socket.userName = userName;
  });

  socket.on('send-message', ({ roomId, content }) => {
    const room = rooms[roomId];
    if (!room) return;

    const message = {
      id: generateId(),
      role: 'user',
      content: content,
      userName: socket.userName,
      timestamp: Date.now()
    };
    room.messages.push(message);
    io.to(roomId).emit('new-message', { message });

    // Trigger Claude analysis
    handleChatAnalysis(room, socket);
  });

  socket.on('generate-artifact', ({ roomId, type }) => {
    const room = rooms[roomId];
    if (!room) return;
    handleArtifactGeneration(room, type, socket.userName, socket);
  });

  socket.on('move-artifact', ({ roomId, artifactId, position }) => {
    const room = rooms[roomId];
    if (!room) return;
    const art = room.artifacts.find(a => a.id === artifactId);
    if (art) art.position = position;
    socket.to(roomId).emit('artifact-moved', { artifactId, position });
  });

  socket.on('canvas-message', ({ roomId, content }) => {
    const room = rooms[roomId];
    if (!room) return;

    const message = {
      id: generateId(),
      role: 'user',
      content: content,
      userName: socket.userName,
      timestamp: Date.now()
    };
    room.messages.push(message);
    io.to(roomId).emit('new-message', { message });
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(u => u.socketId !== socket.id);
      io.to(roomId).emit('user-left', { socketId: socket.id });

      // Clean up empty rooms after 5 minutes
      if (rooms[roomId].users.length === 0) {
        setTimeout(() => {
          if (rooms[roomId] && rooms[roomId].users.length === 0) {
            delete rooms[roomId];
            console.log(`Room ${roomId} cleaned up`);
          }
        }, 5 * 60 * 1000);
      }
    }
  });
});

// --- Expose agent list via HTTP for client ---
app.get('/api/agents', (req, res) => {
  res.json(getAgentSummaries());
});

// --- Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Brainstorm server running on port ${PORT}`);
});
