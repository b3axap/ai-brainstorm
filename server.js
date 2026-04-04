require('dotenv/config');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Anthropic = require('@anthropic-ai/sdk');
const { getAgent, getAllAgents, getAgentSummaries } = require('./agents');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// --- Claude client ---
const anthropic = new Anthropic.default();

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

// --- Chat analysis: Claude responds and suggests visualization types ---
async function handleChatAnalysis(room, socket) {
  const { systemBase, messages } = buildContext(room);
  const agentList = getAgentSummaries()
    .map(a => `${a.id}: ${a.icon} ${a.name} — ${a.description}`)
    .join('\n');

  const systemPrompt = `${systemBase}

IMPORTANT: After your conversational response, you MUST suggest 2-3 visualization types that would help communicate this idea. Choose from:
${agentList}

End your response with a JSON block on its own line:
{"suggest": ["agent_id_1", "agent_id_2"]}

The JSON must be the LAST thing in your response, on its own line.`;

  try {
    let fullResponse = '';

    const stream = anthropic.messages.stream({
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

    // Parse suggested types from JSON block at end
    let suggestedTypes = [];
    const jsonMatch = fullResponse.match(/\{"suggest":\s*\[([^\]]+)\]\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestedTypes = parsed.suggest || [];
      } catch (e) { /* ignore parse error */ }
    }

    // Clean response text (remove the JSON block)
    const cleanResponse = fullResponse.replace(/\{"suggest":\s*\[[^\]]*\]\}/, '').trim();

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
      suggestedTypes: suggestedTypes
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
      const response = await anthropic.messages.create({
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
    const response = await anthropic.messages.create({
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
          const retry = await anthropic.messages.create({
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
        users: []
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
server.listen(PORT, () => {
  console.log(`AI Brainstorm server running on port ${PORT}`);
});
