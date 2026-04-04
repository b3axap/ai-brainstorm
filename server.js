try { require('dotenv/config'); } catch(e) { /* dotenv optional, Replit uses Secrets */ }
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { getAgent, getAgentSummaries } = require('./agents');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 15 * 1024 * 1024 }); // 15MB for file uploads

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

// Extract last JSON object from text using brace-depth matching
function extractLastJsonBlock(text) {
  let lastOpen = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '}') { lastOpen = i; break; }
  }
  if (lastOpen === -1) return null;

  let depth = 0;
  for (let i = lastOpen; i >= 0; i--) {
    if (text[i] === '}') depth++;
    else if (text[i] === '{') depth--;
    if (depth === 0) return text.slice(i, lastOpen + 1);
  }
  return null;
}

// Safely extract text from Claude API response
function extractResponseText(response) {
  if (!response || !response.content || !response.content[0]) return null;
  return response.content[0].text || null;
}

// Grid-based positioning for artifacts (2 columns, 540px wide + 40px gap)
function calcArtifactPosition(index) {
  const COLS = 2;
  const CARD_W = 540;
  const CARD_H = 360;
  const GAP = 40;
  const OFFSET_X = 40;
  const OFFSET_Y = 40;
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return {
    x: OFFSET_X + col * (CARD_W + GAP),
    y: OFFSET_Y + row * (CARD_H + GAP)
  };
}

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

  // Use per-user chat history, with multimodal support for files
  const userChat = room.userChats[socketId];
  let msgs = (userChat ? userChat.messages : []).map(m => {
    const role = m.role === 'assistant' ? 'assistant' : 'user';

    // Build multimodal content if files are attached
    if (m.files && m.files.length > 0 && role === 'user') {
      const contentBlocks = [];
      m.files.forEach(f => {
        if (f.isImage && f.data) {
          contentBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: f.type, data: f.data }
          });
        } else if (f.data) {
          // Text files: decode and include as text
          try {
            const decoded = Buffer.from(f.data, 'base64').toString('utf-8');
            contentBlocks.push({ type: 'text', text: `[File: ${f.name}]\n${decoded}` });
          } catch { /* skip unreadable files */ }
        }
      });
      if (m.content) contentBlocks.push({ type: 'text', text: m.content });
      return { role, content: contentBlocks.length > 0 ? contentBlocks : m.content };
    }

    return { role, content: m.content };
  });

  // Trim if too long: keep first 5 + last 30
  if (msgs.length > 50) {
    msgs = [...msgs.slice(0, 5), { role: 'user', content: '[... earlier messages trimmed ...]' }, ...msgs.slice(-30)];
  }

  return { systemBase, messages: msgs };
}

// --- Chat analysis: Claude responds with structured flow (per-user) ---
async function handleChatAnalysis(room, socket, isNewIdea) {
  const { systemBase, messages } = buildContext(room, socket.id);
  const agentList = getAgentSummaries()
    .map(a => `${a.id}: ${a.icon} ${a.name} — ${a.description}`)
    .join('\n');

  const userChat = room.userChats[socket.id];
  const userMsgCount = userChat ? userChat.phase.msgCount : 0;
  const isFirstMessage = userMsgCount <= 1;

  let contextHint = '';
  if (isNewIdea) {
    contextHint = `\n\nCONTEXT: The user is introducing a NEW, ADDITIONAL idea (via the ➕ button). If it's a real idea: analyze it, find connections with the existing brainstorm, suggest integration, and include "suggest" + "offer_canvas": true. If it's vague or unclear, ask what the idea actually is before offering anything.`;
  } else if (isFirstMessage) {
    contextHint = `\n\nCONTEXT: This is the user's FIRST message. Show you get the idea, share your own angle on it, and ask what you genuinely need to know.`;
  }

  const systemPrompt = `${systemBase}
${contextHint}

YOU ARE A CREATIVE BRAINSTORMING PARTNER.

Behave like a smart, engaged colleague — not a questionnaire bot. Be natural and adaptive.

CRITICAL RULE — VISUALIZATION READINESS:
Before you EVER include "suggest" or "offer_canvas" in the JSON, ask yourself:
"Can I describe in one sentence WHAT I would visualize and WHY it would be useful?"
If the answer is no — you don't have enough context. Keep talking, ask questions, dig deeper.

NEVER suggest visualizations when:
- The user's message is unclear, gibberish, or a test input (e.g. "aaa", "test", "BBB")
- You don't understand the actual idea yet
- The conversation is still at the "what are we even talking about" stage
- You're just being polite or trying to seem helpful

In these cases, be honest: "I'd love to help brainstorm, but I need to understand your idea first. What are you working on?"

GUIDELINES (not rigid rules):

1. FIRST MESSAGE:
   - If the message is vague, off-topic, or nonsense — say so directly and ask for a real idea. Don't pretend you understood something.
   - If it's a real idea: show you get it (1-2 sentences, casual), add your own angle, and put questions in the JSON block.
   - If it's already very detailed: you can skip questions and suggest visualizations right away.

2. ONGOING CONVERSATION:
   - Be an active participant: develop ideas, suggest alternatives, play devil's advocate when useful
   - Ask questions ONLY when you actually need clarification (0-2 at a time)

IMPORTANT — QUESTION PLACEMENT:
- Questions go ONLY in the JSON "questions" array. They will be rendered as interactive buttons in the UI.
- Do NOT write the questions in your text response. No numbered lists of questions, no "Here are my questions:" — that creates duplication.
- Your text response should be your thoughts, observations, and ideas — the conversational part. Questions are separate.
   - Suggest visualizations when you can clearly articulate WHAT would be visualized — not just because some messages have passed
   - When suggesting a visualization, say in one sentence WHAT it would show and WHY it helps

3. QUESTIONS FORMAT:
   - If a question has obvious answer variants (yes/no, a few clear options), include them as clickable options
   - Format: {"q": "question text", "options": ["Option A", "Option B", "Option C"]}
   - If the question is open-ended with no obvious options, just include the question as a string: "What's your main concern?"
   - The user can ALWAYS type their own answer regardless, options are just shortcuts
   - Don't force options where they don't make sense

${room.artifacts.length > 0 ? `4. CANVAS ACTIONS:
   When the user CLEARLY wants to create, update, or transform a visualization, include "canvas_action":
   - "make a mindmap" → canvas_action: {"intent":"create", "artifact_type":"mindmap"}
   - "update the table" → canvas_action: {"intent":"update", "target_id":"<id>", "instruction":"..."}
   - "convert to presentation" → canvas_action: {"intent":"transform", "target_id":"<id>", "artifact_type":"presentation"}
   Only when intent is UNAMBIGUOUS. Normal discussion does NOT get canvas_action.
` : ''}
AVAILABLE VISUALIZATION TYPES:
${agentList}

CHOOSING VISUALIZATIONS:
${isFirstMessage ? 'mindmap is usually a great start for a new idea.' : `- Comparing? → table, pros_cons, matrix | Breakdown? → mindmap | Planning? → timeline, kanban
- Analysis? → swot, pros_cons | Process? → diagram | Custom? → freeform | Insight? → quote_card`}

JSON BLOCK (LAST thing in your response, on its own line):
All fields are OPTIONAL — include only what's relevant:
- "questions": array of question objects (with "q" + "options") or plain strings
- "suggest": array of 2-3 agent IDs — when you think it's time to visualize
- "offer_canvas": true — include alongside "suggest" to show the visualization picker
- "canvas_action": object — only for explicit canvas commands

Examples:
{"questions": [{"q": "Who is this for?", "options": ["B2B", "B2C", "Both"]}, "What problem does it solve?"]}
{"suggest": ["mindmap", "table"], "offer_canvas": true}
{"canvas_action": {"intent": "create", "artifact_type": "mindmap"}}

Rules:
- JSON block must be the LAST line.
- Use the same language the user writes in.
- Be concise. No fluff. No filler questions.`;

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

    // Parse JSON block at end of response
    let suggestedTypes = [];
    let clarifyQuestions = [];
    let offerCanvas = false;
    let canvasAction = null;

    // Extract last JSON block using brace-depth matching (handles nested objects)
    const jsonBlock = extractLastJsonBlock(fullResponse);
    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock);
        suggestedTypes = parsed.suggest || [];
        clarifyQuestions = parsed.questions || [];
        offerCanvas = parsed.offer_canvas || false;
        canvasAction = parsed.canvas_action || null;
      } catch (e) { /* ignore parse error */ }
    }

    // Clean response text (remove JSON block)
    const cleanResponse = jsonBlock
      ? fullResponse.slice(0, fullResponse.lastIndexOf(jsonBlock)).trim()
      : fullResponse.trim();

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

  const text = extractResponseText(response);
  if (!text) throw new Error('Empty response from Claude');
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

  const text = extractResponseText(response);
  if (!text) throw new Error('Empty response from Claude');
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

  const text = extractResponseText(response);
  if (!text) throw new Error('Empty response from Claude');
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

      const text = extractResponseText(response);
      if (!text) throw new Error('Empty response from Claude');
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
        position: calcArtifactPosition(room.artifacts.length)
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

    const text = extractResponseText(response);
    if (!text) throw new Error('Empty response from Claude');
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
      position: calcArtifactPosition(room.artifacts.length)
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
    } else if (roomId && !rooms[roomId]) {
      // User provided a code that doesn't exist — error, don't create
      socket.emit('join-error', { message: 'Room not found. Check the code and try again.' });
      return;
    } else {
      const id = generateRoomId();
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

  socket.on('send-message', ({ roomId, content, isNewIdea, files }) => {
    const room = rooms[roomId];
    if (!room) return;

    const userChat = room.userChats[socket.id];
    if (!userChat) return;

    // Reject if a Claude call is already in-flight for this user
    if (activeLocks.get(socket.id)) {
      socket.emit('generation-error', { roomId, message: 'Please wait for the current response to finish.' });
      return;
    }

    // Validate and cap files (max 5 files, max 10MB each)
    let validFiles = null;
    if (files && Array.isArray(files) && files.length > 0) {
      validFiles = files.slice(0, 5).filter(f => f.data && f.type && f.data.length < 10 * 1024 * 1024 * 1.37);
    }

    const message = {
      id: generateId(),
      role: 'user',
      content: content,
      userName: socket.userName,
      timestamp: Date.now(),
      files: validFiles || undefined
    };

    // Store in personal chat (with cap)
    userChat.messages.push(message);
    if (userChat.messages.length > MAX_MESSAGES) userChat.messages.splice(0, userChat.messages.length - MAX_MESSAGES);
    userChat.phase.msgCount++;

    // Also store in shared log for sidebar (with cap, without file data to save memory)
    const sharedMsg = { ...message, files: validFiles ? validFiles.map(f => ({ name: f.name, type: f.type, isImage: f.isImage })) : undefined };
    room.messages.push(sharedMsg);
    if (room.messages.length > MAX_MESSAGES) room.messages.splice(0, room.messages.length - MAX_MESSAGES);

    // Send to this user only (personal chat)
    socket.emit('new-message', { message });

    // Notify others via sidebar only (without file data)
    socket.to(roomId).emit('sidebar-message', { message: sharedMsg });

    // Trigger Claude analysis (per-user)
    handleChatAnalysis(room, socket, isNewIdea);
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

  // --- Artifact array operations (add/remove/move items) ---
  socket.on('artifact-array-op', ({ roomId, artifactId, op }) => {
    const room = rooms[roomId];
    if (!room) return;
    const artifact = room.artifacts.find(a => a.id === artifactId);
    if (!artifact || !op) return;

    try {
      const getByPath = (obj, path) => {
        const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
        for (const p of parts) {
          if (obj == null) return undefined;
          obj = obj[p];
        }
        return obj;
      };

      const getParentAndKey = (obj, path) => {
        const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
        const key = parts.pop();
        for (const p of parts) {
          if (obj == null) return { parent: null, key };
          obj = obj[p];
        }
        return { parent: obj, key };
      };

      if (op.type === 'insert') {
        // Insert value at end of array at path
        const arr = getByPath(artifact.data, op.path);
        if (Array.isArray(arr)) {
          arr.push(op.value != null ? op.value : '');
        }
      } else if (op.type === 'remove') {
        // Remove item at path (e.g. "branches.2" removes index 2 from branches)
        const { parent, key } = getParentAndKey(artifact.data, op.path);
        if (Array.isArray(parent)) {
          const idx = parseInt(key);
          if (!isNaN(idx) && idx >= 0 && idx < parent.length) {
            parent.splice(idx, 1);
          }
        }
      } else if (op.type === 'move') {
        // Move item from op.path to op.toPath array
        const { parent: srcParent, key: srcKey } = getParentAndKey(artifact.data, op.path);
        const destArr = getByPath(artifact.data, op.toPath);
        if (Array.isArray(srcParent) && Array.isArray(destArr)) {
          const idx = parseInt(srcKey);
          if (!isNaN(idx) && idx >= 0 && idx < srcParent.length) {
            const [item] = srcParent.splice(idx, 1);
            destArr.push(item);
          }
        }
      }
    } catch (e) {
      console.error('Array op error:', e.message);
      return;
    }

    io.to(roomId).emit('artifact-updated', {
      roomId, artifactId, data: artifact.data, title: artifact.title
    });
  });

  // --- Execute canvas action from Claude's suggestion ---
  socket.on('delete-artifact', ({ roomId, artifactId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const idx = room.artifacts.findIndex(a => a.id === artifactId);
    if (idx === -1) return;
    room.artifacts.splice(idx, 1);
    io.to(roomId).emit('artifact-deleted', { artifactId });
  });

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
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Brainstorm server running on port ${PORT}`);
});
