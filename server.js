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

// --- Concurrency: per-socket request locks & active streams ---
const activeLocks = new Map();    // socketId -> boolean (true = Claude call in-flight)
const activeAborts = new Map();   // socketId -> AbortController

const MAX_MESSAGES = 200;         // Cap per-user and shared message history

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

const COLORS = ['#6c5ce7', '#00cec9', '#fdcb6e', '#fd79a8', '#74b9ff', '#ff6b6b', '#a29bfe', '#55efc4'];

// --- Context builder: uses per-user chat history ---
function buildContext(room, socketId) {
  const userNames = room.users.map(u => u.name).join(', ') || 'none';
  const artifactList = room.artifacts.map(a => `- [${a.type}] "${a.title}" (id:${a.id}) by ${a.author}`).join('\n') || 'none yet';

  const systemBase = `You are an AI brainstorming partner in a collaborative room.
Room ID: ${room.id}
Active users: ${userNames}
Existing artifacts in this session:
${artifactList}

Your job is to help users develop their ideas, make connections between different perspectives, and suggest useful visualizations.`;

  // Use per-user chat history
  const userChat = room.userChats[socketId];
  let msgs = (userChat ? userChat.messages : []).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  // Trim if too long: keep first 5 + last 30
  if (msgs.length > 50) {
    msgs = [...msgs.slice(0, 5), { role: 'user', content: '[... earlier messages trimmed ...]' }, ...msgs.slice(-30)];
  }

  return { systemBase, messages: msgs };
}

// --- Chat analysis: Claude responds with structured flow (per-user) ---
async function handleChatAnalysis(room, socket) {
  const { systemBase, messages } = buildContext(room, socket.id);
  const agentList = getAgentSummaries()
    .map(a => `${a.id}: ${a.icon} ${a.name} — ${a.description}`)
    .join('\n');

  // Per-user phase tracking
  const userChat = room.userChats[socket.id];
  const phase = userChat ? userChat.phase : { mandatoryDone: false, mandatoryDoneAtMsg: 0, msgCount: 0 };
  const userMsgCount = phase.msgCount;
  const isFirstMessage = userMsgCount <= 1;
  const mandatoryDone = phase.mandatoryDone;
  const msgsSinceMandatory = mandatoryDone ? (userMsgCount - phase.mandatoryDoneAtMsg) : 0;
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

${shouldOfferCanvas ? 'IMPORTANT: Include "offer_canvas": true and "suggest": [...] in the JSON.' : ''}

CANVAS COMMANDS:
When the user's message CLEARLY intends to create, update, or transform a visualization, include "canvas_action" in your JSON.
Examples:
- "make a mindmap of this" → canvas_action: {"intent":"create", "artifact_type":"mindmap"}
- "add a marketing branch to the mindmap" → canvas_action: {"intent":"update", "target_id":"<id>", "instruction":"add marketing branch"}
- "convert the table to a presentation" → canvas_action: {"intent":"transform", "target_id":"<id>", "artifact_type":"presentation"}
ONLY include canvas_action when the intent is UNAMBIGUOUS. Normal discussion does NOT get canvas_action.

In the JSON block:
- "phase": "free"
- "questions": optional 0-3 question objects
${shouldOfferCanvas ? '- "suggest": array of 2-3 agent IDs\n- "offer_canvas": true' : '- Do NOT include "suggest" unless you also include canvas_action or offer_canvas'}
- "canvas_action": optional — only when the user clearly wants to affect the canvas`;
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

  // Abort any previous in-flight stream for this socket
  const prevAbort = activeAborts.get(socket.id);
  if (prevAbort) prevAbort.abort();

  const abortController = new AbortController();
  activeAborts.set(socket.id, abortController);
  activeLocks.set(socket.id, true);

  try {
    let fullResponse = '';

    const stream = getAnthropicClient().messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages,
      signal: abortController.signal
    });

    stream.on('text', (text) => {
      if (abortController.signal.aborted) return;
      fullResponse += text;
      socket.emit('claude-chunk', { roomId: room.id, chunk: text });
    });

    await stream.finalMessage();

    // Parse JSON block at end
    let suggestedTypes = [];
    let clarifyQuestions = [];
    let phase = '';
    let offerCanvas = false;
    let canvasAction = null;

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
        canvasAction = parsed.canvas_action || null;
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

    // Track mandatory phase completion (per-user)
    if (phase === 'mandatory_done' && userChat && !userChat.phase.mandatoryDone) {
      userChat.phase.mandatoryDone = true;
      userChat.phase.mandatoryDoneAtMsg = userChat.phase.msgCount;
      offerCanvas = true;
    }

    // Clean response text (remove JSON block)
    const cleanResponse = fullResponse
      .replace(/\{[\s\S]*"phase"\s*:[\s\S]*\}$/m, '')
      .replace(/\{[^{}]*"phase"\s*:[^{}]*\}/, '')
      .replace(/\{[^{}]*"suggest"\s*:\s*\[[^\]]*\][^{}]*\}/, '')
      .replace(/\{[^{}]*"questions"\s*:\s*\[[^\]]*\][^{}]*\}/, '')
      .trim();

    // Store in user's personal chat (with cap)
    const assistantMsg = {
      id: generateId(),
      role: 'assistant',
      content: cleanResponse,
      userName: 'Claude',
      timestamp: Date.now()
    };
    if (userChat) {
      userChat.messages.push(assistantMsg);
      if (userChat.messages.length > MAX_MESSAGES) userChat.messages.splice(0, userChat.messages.length - MAX_MESSAGES);
    }
    room.messages.push(assistantMsg);
    if (room.messages.length > MAX_MESSAGES) room.messages.splice(0, room.messages.length - MAX_MESSAGES);

    // Send only to this user
    socket.emit('claude-done', {
      roomId: room.id,
      fullMessage: cleanResponse,
      suggestedTypes: suggestedTypes,
      clarifyQuestions: clarifyQuestions,
      phase: phase,
      offerCanvas: offerCanvas,
      canvasAction: canvasAction
    });

  } catch (error) {
    if (error.name === 'AbortError' || abortController.signal.aborted) {
      console.log('Claude stream aborted for socket:', socket.id);
      return;
    }
    console.error('Claude chat error:', error.message);
    socket.emit('generation-error', {
      roomId: room.id,
      message: 'Failed to get Claude response: ' + error.message
    });
  } finally {
    activeLocks.delete(socket.id);
    activeAborts.delete(socket.id);
  }
}

// --- Artifact manipulation: expand, transform, ask ---

async function handleArtifactExpand(room, artifact, socket) {
  const agent = getAgent(artifact.type);
  if (!agent) return;

  const { systemBase } = buildContext(room, socket.id);
  const system = `${systemBase}\n\n${agent.systemPrompt}\n\nYou are given an existing ${artifact.type} visualization. EXPAND it with significantly more detail, depth, and sub-items. Keep the same JSON structure but make it richer.\n\nExisting data:\n${JSON.stringify(artifact.data, null, 2)}\n\nReturn the COMPLETE updated JSON (not just the additions).`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: system,
    messages: [{ role: 'user', content: 'Expand this visualization with more detail.' }]
  });

  const text = response.content[0].text;
  let data;
  try { data = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    data = m ? JSON.parse(m[0]) : null;
  }
  if (!data) throw new Error('Failed to parse expanded data');

  artifact.data = data;
  artifact.title = data.title || data.center || artifact.title;
  io.to(room.id).emit('artifact-updated', {
    roomId: room.id, artifactId: artifact.id, data: artifact.data, title: artifact.title
  });
}

async function handleArtifactTransform(room, artifact, targetType, socket) {
  const agent = getAgent(targetType);
  if (!agent) return;

  const { systemBase } = buildContext(room, socket.id);
  const system = `${systemBase}\n\n${agent.systemPrompt}\n\nYou are converting an existing ${artifact.type} visualization into a ${targetType}. Use all the information from the source data below to create the best possible ${targetType}.\n\nSource data:\n${JSON.stringify(artifact.data, null, 2)}`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: system,
    messages: [{ role: 'user', content: `Convert this ${artifact.type} into a ${targetType}.` }]
  });

  const text = response.content[0].text;
  let data;
  try { data = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    data = m ? JSON.parse(m[0]) : null;
  }
  if (!data) throw new Error('Failed to parse transformed data');

  const newArtifact = {
    id: generateId(),
    type: agent.id,
    title: data.title || data.center || agent.name + ' visualization',
    data: data,
    author: socket.userName,
    renderer: agent.renderer,
    icon: agent.icon,
    timestamp: Date.now(),
    position: { x: (artifact.position?.x || 50) + 40, y: (artifact.position?.y || 50) + 40 }
  };

  room.artifacts.push(newArtifact);
  io.to(room.id).emit('artifact-created', { roomId: room.id, artifact: newArtifact });
}

async function handleArtifactAsk(room, artifact, question, socket) {
  const agent = getAgent(artifact.type);
  if (!agent) return;

  const { systemBase } = buildContext(room, socket.id);
  const system = `${systemBase}\n\n${agent.systemPrompt}\n\nYou are modifying an existing ${artifact.type} visualization based on a user's request. Apply the requested changes and return the COMPLETE updated JSON.\n\nCurrent data:\n${JSON.stringify(artifact.data, null, 2)}`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: system,
    messages: [{ role: 'user', content: question }]
  });

  const text = response.content[0].text;
  let data;
  try { data = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    data = m ? JSON.parse(m[0]) : null;
  }
  if (!data) throw new Error('Failed to parse updated data');

  artifact.data = data;
  artifact.title = data.title || data.center || artifact.title;
  io.to(room.id).emit('artifact-updated', {
    roomId: room.id, artifactId: artifact.id, data: artifact.data, title: artifact.title
  });
}

// --- Artifact generation ---
async function handleArtifactGeneration(room, type, userName, socket, referenceIds, customPrompt) {
  const agent = getAgent(type);
  if (!agent) {
    socket.emit('generation-error', { roomId: room.id, message: `Unknown agent type: ${type}` });
    return;
  }

  io.to(room.id).emit('artifact-generating', { roomId: room.id, type, status: 'working' });

  // External API agents (placeholder for now)
  if (agent.externalAPI) {
    // Step 1: Ask Claude to formulate a prompt
    const { systemBase, messages } = buildContext(room, socket.id);
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
  const { systemBase, messages } = buildContext(room, socket.id);
  let fullSystem = `${systemBase}\n\n${agent.systemPrompt}`;

  // Inject reference artifact data if provided
  if (referenceIds && referenceIds.length > 0) {
    const refs = referenceIds
      .map(id => room.artifacts.find(a => a.id === id))
      .filter(Boolean)
      .map(a => `[${a.type}] "${a.title}":\n${JSON.stringify(a.data, null, 2)}`)
      .join('\n\n');
    if (refs) fullSystem += `\n\nREFERENCE ARTIFACTS (use this data as context):\n${refs}`;
  }
  if (customPrompt) fullSystem += `\n\nADDITIONAL USER INSTRUCTIONS: ${customPrompt}`;

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
        messages: [],       // shared activity log (for canvas sidebar)
        artifacts: [],
        users: [],
        userChats: {}       // per-user chat: { socketId: { messages: [], phase: { mandatoryDone, mandatoryDoneAtMsg, msgCount } } }
      };
      rooms[id] = room;
    }

    // Prevent duplicate user entries for same socket
    const existingUser = room.users.find(u => u.socketId === socket.id);
    const user = existingUser || {
      socketId: socket.id,
      name: userName,
      color: COLORS[room.users.length % COLORS.length]
    };
    if (!existingUser) room.users.push(user);
    socket.join(room.id);

    // Cancel any pending room cleanup
    if (room._cleanupTimer) {
      clearTimeout(room._cleanupTimer);
      room._cleanupTimer = null;
    }

    // Initialize per-user chat
    if (!room.userChats[socket.id]) {
      room.userChats[socket.id] = {
        messages: [],
        phase: { mandatoryDone: false, mandatoryDoneAtMsg: 0, msgCount: 0 }
      };
    }

    // Send room state (artifacts shared, chat personal)
    socket.emit('room-joined', {
      room: {
        id: room.id,
        artifacts: room.artifacts,
        users: room.users,
        messages: room.userChats[socket.id].messages
      },
      user
    });

    // Notify others
    socket.to(room.id).emit('user-joined', { user });

    // Store room reference on socket for disconnect
    socket.roomId = room.id;
    socket.userName = userName;
  });

  socket.on('send-message', ({ roomId, content }) => {
    const room = rooms[roomId];
    if (!room) return;

    const userChat = room.userChats[socket.id];
    if (!userChat) return;

    // Reject if a Claude call is already in-flight for this user
    if (activeLocks.get(socket.id)) {
      socket.emit('generation-error', { roomId, message: 'Please wait for the current response to finish.' });
      return;
    }

    const message = {
      id: generateId(),
      role: 'user',
      content: content,
      userName: socket.userName,
      timestamp: Date.now()
    };

    // Store in personal chat (with cap)
    userChat.messages.push(message);
    if (userChat.messages.length > MAX_MESSAGES) userChat.messages.splice(0, userChat.messages.length - MAX_MESSAGES);
    userChat.phase.msgCount++;

    // Also store in shared log for sidebar (with cap)
    room.messages.push(message);
    if (room.messages.length > MAX_MESSAGES) room.messages.splice(0, room.messages.length - MAX_MESSAGES);

    // Send to this user only (personal chat)
    socket.emit('new-message', { message });

    // Notify others via sidebar only
    socket.to(roomId).emit('sidebar-message', { message });

    // Trigger Claude analysis (per-user)
    handleChatAnalysis(room, socket);
  });

  socket.on('generate-artifact', ({ roomId, type, referenceIds, customPrompt }) => {
    const room = rooms[roomId];
    if (!room) return;
    handleArtifactGeneration(room, type, socket.userName, socket, referenceIds, customPrompt);
  });

  socket.on('move-artifact', ({ roomId, artifactId, position }) => {
    const room = rooms[roomId];
    if (!room) return;
    const art = room.artifacts.find(a => a.id === artifactId);
    if (art) art.position = position;
    socket.to(roomId).emit('artifact-moved', { artifactId, position });
  });

  // --- Artifact actions: expand, transform, ask ---
  socket.on('artifact-action', async ({ roomId, artifactId, action, payload }) => {
    const room = rooms[roomId];
    if (!room) return;
    const artifact = room.artifacts.find(a => a.id === artifactId);
    if (!artifact) return;

    try {
      if (action === 'expand') {
        await handleArtifactExpand(room, artifact, socket);
      } else if (action === 'transform' && payload && payload.targetType) {
        await handleArtifactTransform(room, artifact, payload.targetType, socket);
      } else if (action === 'ask' && payload && payload.question) {
        await handleArtifactAsk(room, artifact, payload.question, socket);
      }
    } catch (error) {
      console.error(`Artifact action ${action} error:`, error.message);
      socket.emit('generation-error', { roomId, message: error.message });
    }
  });

  // --- Artifact data patches (inline edits) ---
  socket.on('artifact-data-patch', ({ roomId, artifactId, patch }) => {
    const room = rooms[roomId];
    if (!room) return;
    const artifact = room.artifacts.find(a => a.id === artifactId);
    if (!artifact || !patch) return;

    // Apply simple path-based patch: e.g. {path: 'branches.0.label', value: 'New'}
    try {
      const parts = patch.path.replace(/\[(\d+)\]/g, '.$1').split('.');
      let obj = artifact.data;
      for (let i = 0; i < parts.length - 1; i++) {
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = patch.value;
    } catch (e) {
      console.error('Patch apply error:', e.message);
      return;
    }

    io.to(roomId).emit('artifact-updated', {
      roomId, artifactId, data: artifact.data, title: artifact.title
    });
  });

  // --- Execute canvas action from Claude's suggestion ---
  socket.on('execute-canvas-action', async ({ roomId, canvasAction }) => {
    const room = rooms[roomId];
    if (!room || !canvasAction) return;

    try {
      if (canvasAction.intent === 'create' && canvasAction.artifact_type) {
        await handleArtifactGeneration(room, canvasAction.artifact_type, socket.userName, socket);
      } else if (canvasAction.intent === 'update' && canvasAction.target_id) {
        const artifact = room.artifacts.find(a => a.id === canvasAction.target_id);
        if (artifact) {
          await handleArtifactAsk(room, artifact, canvasAction.instruction || 'expand and improve', socket);
        }
      } else if (canvasAction.intent === 'transform' && canvasAction.target_id && canvasAction.artifact_type) {
        const artifact = room.artifacts.find(a => a.id === canvasAction.target_id);
        if (artifact) {
          await handleArtifactTransform(room, artifact, canvasAction.artifact_type, socket);
        }
      }
    } catch (error) {
      socket.emit('generation-error', { roomId, message: error.message });
    }
  });

  socket.on('disconnect', () => {
    // Abort any in-flight Claude stream for this socket
    const abort = activeAborts.get(socket.id);
    if (abort) abort.abort();
    activeLocks.delete(socket.id);
    activeAborts.delete(socket.id);

    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      room.users = room.users.filter(u => u.socketId !== socket.id);
      io.to(roomId).emit('user-left', { socketId: socket.id });

      // Clean up empty rooms after 5 minutes (one timer per room, cancellable on join)
      if (room.users.length === 0) {
        if (room._cleanupTimer) clearTimeout(room._cleanupTimer);
        room._cleanupTimer = setTimeout(() => {
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
