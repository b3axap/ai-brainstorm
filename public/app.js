// app.js — Client-side logic for AI Brainstorm

// --- Init ---
const socket = io();
mermaid.initialize({ startOnLoad: false, theme: 'dark' });

// --- State ---
const state = {
  screen: 'landing',
  roomId: null,
  userName: null,
  messages: [],
  artifacts: [],
  users: [],
  generating: false,
  agents: []
};

// Load agents list
fetch('/api/agents').then(r => r.json()).then(agents => {
  state.agents = agents;
  populateAgentGrid();
});

// --- Screen switching ---
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  state.screen = name;
  if (name === 'chat') document.getElementById('chatInput').focus();
}

// --- Toast ---
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2500);
}

// --- Landing ---
document.getElementById('createBtn').onclick = () => {
  const name = document.getElementById('nameInput').value.trim();
  if (!name) return showLandingError('Please enter your name');
  state.userName = name;
  socket.emit('join-room', { userName: name });
};

document.getElementById('joinBtn').onclick = () => {
  const name = document.getElementById('nameInput').value.trim();
  const code = document.getElementById('codeInput').value.trim().toUpperCase();
  if (!name) return showLandingError('Please enter your name');
  if (!code) return showLandingError('Please enter a room code');
  state.userName = name;
  socket.emit('join-room', { userName: name, roomId: code });
};

document.getElementById('nameInput').onkeypress = (e) => {
  if (e.key === 'Enter') document.getElementById('createBtn').click();
};
document.getElementById('codeInput').onkeypress = (e) => {
  if (e.key === 'Enter') document.getElementById('joinBtn').click();
};

function showLandingError(msg) {
  const el = document.getElementById('landingError');
  el.textContent = msg;
  el.style.display = 'block';
}

// --- Chat ---
document.getElementById('chatSendBtn').onclick = sendChatMessage;
document.getElementById('chatInput').onkeypress = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) sendChatMessage();
};

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content || state.generating) return;
  input.value = '';
  socket.emit('send-message', { roomId: state.roomId, content });
}

function addChatMessage(message) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${message.role}`;
  div.id = `msg-${message.id}`;

  const nameLabel = message.role === 'assistant' ? 'Claude' : message.userName || 'User';

  div.innerHTML = `
    <div class="msg-header"><span class="name">${escHtml(nameLabel)}</span></div>
    <div class="msg-bubble">${escHtml(message.content)}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Suggest buttons and clarify questions are now rendered inline in the claude-done handler

// Streaming: Claude response building
let streamingMsgId = null;

function startStreaming() {
  streamingMsgId = 'stream-' + Date.now();
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message assistant';
  div.id = `msg-${streamingMsgId}`;
  div.innerHTML = `
    <div class="msg-header"><span class="name">Claude</span></div>
    <div class="msg-bubble"></div>
  `;
  container.appendChild(div);
  document.getElementById('typingIndicator').classList.add('visible');
  state.generating = true;
}

function appendStream(chunk) {
  if (!streamingMsgId) startStreaming();
  const msgEl = document.getElementById(`msg-${streamingMsgId}`);
  if (msgEl) {
    const bubble = msgEl.querySelector('.msg-bubble');
    bubble.textContent += chunk;
    document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
  }
}

function endStreaming(fullMessage) {
  document.getElementById('typingIndicator').classList.remove('visible');
  // Replace streaming message with clean version
  if (streamingMsgId) {
    const msgEl = document.getElementById(`msg-${streamingMsgId}`);
    if (msgEl) {
      const bubble = msgEl.querySelector('.msg-bubble');
      bubble.textContent = fullMessage;
    }
  }
  streamingMsgId = null;
}

// --- Canvas ---
document.getElementById('goCanvasBtn').onclick = () => showScreen('canvas');
document.getElementById('goChatBtn').onclick = () => showScreen('chat');

// New Idea modal
document.getElementById('newIdeaBtn').onclick = () => {
  document.getElementById('newIdeaModal').classList.add('active');
};
document.getElementById('modalCancelBtn').onclick = () => {
  document.getElementById('newIdeaModal').classList.remove('active');
};
document.getElementById('newIdeaModal').onclick = (e) => {
  if (e.target === document.getElementById('newIdeaModal')) {
    document.getElementById('newIdeaModal').classList.remove('active');
  }
};

function populateAgentGrid() {
  const grid = document.getElementById('agentGrid');
  grid.innerHTML = '';
  state.agents.forEach(agent => {
    const div = document.createElement('div');
    div.className = 'agent-option';
    div.innerHTML = `<div class="agent-icon">${agent.icon}</div><div class="agent-name">${escHtml(agent.name)}</div>`;
    div.onclick = () => {
      if (state.generating) return;
      state.generating = true;
      document.getElementById('newIdeaModal').classList.remove('active');

      // If there's additional context, send it as a message first
      const extraContext = document.getElementById('newIdeaInput').value.trim();
      if (extraContext) {
        socket.emit('canvas-message', { roomId: state.roomId, content: extraContext });
      }
      document.getElementById('newIdeaInput').value = '';

      socket.emit('generate-artifact', { roomId: state.roomId, type: agent.id });
      showToast(`Generating ${agent.name}...`);
    };
    grid.appendChild(div);
  });
}

// Sidebar mini-chat
document.getElementById('sidebarSendBtn').onclick = sendSidebarMessage;
document.getElementById('sidebarInput').onkeypress = (e) => {
  if (e.key === 'Enter') sendSidebarMessage();
};

function sendSidebarMessage() {
  const input = document.getElementById('sidebarInput');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  socket.emit('canvas-message', { roomId: state.roomId, content });
}

function addSidebarMessage(message) {
  const container = document.getElementById('sidebarMessages');
  const div = document.createElement('div');
  div.className = `sidebar-msg ${message.role === 'assistant' || message.role === 'system' ? 's-system' : ''}`;
  if (message.role === 'user') {
    div.innerHTML = `<span class="s-name">${escHtml(message.userName)}: </span><span class="s-text">${escHtml(message.content)}</span>`;
  } else {
    div.textContent = message.content;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// --- Artifact rendering on canvas ---
function renderArtifactCard(artifact) {
  const card = document.createElement('div');
  card.className = 'artifact-card';
  card.id = `artifact-${artifact.id}`;
  card.style.left = artifact.position.x + 'px';
  card.style.top = artifact.position.y + 'px';

  card.innerHTML = `
    <div class="artifact-head">
      <span class="a-icon">${artifact.icon || '📄'}</span>
      <span class="a-title">${escHtml(artifact.title || 'Untitled')}</span>
      <span class="a-author">by ${escHtml(artifact.author || '?')}</span>
    </div>
    <div class="artifact-body" id="abody-${artifact.id}"></div>
  `;

  document.getElementById('canvasContent').appendChild(card);

  // Render content
  const body = document.getElementById(`abody-${artifact.id}`);
  renderArtifact(artifact.renderer || artifact.type, artifact.data, body);

  // Drag to move
  setupDrag(card, artifact);

  return card;
}

function setupDrag(card, artifact) {
  const head = card.querySelector('.artifact-head');
  let dragging = false, startX, startY, origLeft, origTop;

  head.onmousedown = (e) => {
    dragging = true;
    card.classList.add('dragging');
    startX = e.clientX;
    startY = e.clientY;
    origLeft = parseInt(card.style.left) || 0;
    origTop = parseInt(card.style.top) || 0;
    e.preventDefault();
  };

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    card.style.left = (origLeft + dx) + 'px';
    card.style.top = (origTop + dy) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove('dragging');
    const pos = { x: parseInt(card.style.left), y: parseInt(card.style.top) };
    socket.emit('move-artifact', { roomId: state.roomId, artifactId: artifact.id, position: pos });
  });
}

// --- Update user lists ---
function updateUserLists() {
  const names = state.users.map(u => u.name).join(', ');
  document.getElementById('chatUsers').textContent = names;
  document.getElementById('canvasUsers').textContent = names;
}

// --- Room code display ---
function updateRoomCode() {
  document.getElementById('chatRoomCode').textContent = state.roomId;
  document.getElementById('canvasRoomCode').textContent = state.roomId;
}

document.querySelectorAll('.room-code').forEach(el => {
  el.onclick = () => {
    navigator.clipboard.writeText(state.roomId).then(() => showToast('Room code copied!'));
  };
});

// --- Socket events ---
socket.on('room-joined', ({ room, user }) => {
  state.roomId = room.id;
  state.users = room.users;
  state.messages = room.messages;
  state.artifacts = room.artifacts;

  updateRoomCode();
  updateUserLists();

  // Render existing messages in chat
  room.messages.forEach(msg => addChatMessage(msg));

  // Render existing artifacts on canvas
  room.artifacts.forEach(art => renderArtifactCard(art));

  // Also populate sidebar with recent messages
  room.messages.filter(m => m.role === 'user').slice(-10).forEach(msg => addSidebarMessage(msg));

  showScreen('chat');
});

socket.on('user-joined', ({ user }) => {
  state.users.push(user);
  updateUserLists();
  addSidebarMessage({ role: 'system', content: `${user.name} joined` });
});

socket.on('user-left', ({ socketId }) => {
  const user = state.users.find(u => u.socketId === socketId);
  state.users = state.users.filter(u => u.socketId !== socketId);
  updateUserLists();
  if (user) {
    addSidebarMessage({ role: 'system', content: `${user.name} left` });
  }
});

socket.on('new-message', ({ message }) => {
  state.messages.push(message);
  if (message.role === 'user') {
    addChatMessage(message);
    addSidebarMessage(message);
  }
});

socket.on('claude-chunk', ({ chunk }) => {
  appendStream(chunk);
});

socket.on('claude-done', ({ fullMessage, suggestedTypes, clarifyQuestions, phase, offerCanvas }) => {
  endStreaming(fullMessage);
  state.generating = false;

  const container = document.getElementById('chatMessages');
  const lastMsg = container.querySelector('.message:last-child');
  if (!lastMsg) return;

  const hasQuestions = clarifyQuestions && clarifyQuestions.length > 0;
  const hasSuggestions = suggestedTypes && suggestedTypes.length > 0;

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'claude-actions';
  let hasContent = false;

  // Render clarifying questions with answer options
  if (hasQuestions) {
    const questionsDiv = document.createElement('div');
    questionsDiv.className = 'clarify-section';
    clarifyQuestions.forEach(item => {
      const questionText = typeof item === 'string' ? item : item.q;
      const options = typeof item === 'object' && item.options ? item.options : [];

      const qBlock = document.createElement('div');
      qBlock.className = 'clarify-block';

      const qText = document.createElement('div');
      qText.className = 'clarify-question';
      qText.textContent = questionText;
      qBlock.appendChild(qText);

      if (options.length > 0) {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'clarify-options';
        options.forEach(opt => {
          const btn = document.createElement('button');
          btn.className = 'clarify-option-btn';
          btn.textContent = opt;
          btn.onclick = () => {
            const input = document.getElementById('chatInput');
            const current = input.value.trim();
            input.value = current ? current + '. ' + opt : opt;
            input.focus();
            btn.classList.add('selected');
          };
          optionsDiv.appendChild(btn);
        });
        qBlock.appendChild(optionsDiv);
      }

      questionsDiv.appendChild(qBlock);
    });
    actionsDiv.appendChild(questionsDiv);
    hasContent = true;
  }

  // Canvas offer: show visualization picker button (user decides when to generate)
  if (offerCanvas && hasSuggestions) {
    const canvasOffer = document.createElement('div');
    canvasOffer.className = 'canvas-offer';

    const offerLabel = document.createElement('div');
    offerLabel.className = 'canvas-offer-label';
    offerLabel.textContent = '\uD83C\uDFA8 Ready to visualize? Pick what to generate:';
    canvasOffer.appendChild(offerLabel);

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'suggest-buttons';
    suggestedTypes.forEach(typeId => {
      const agent = state.agents.find(a => a.id === typeId);
      if (!agent) return;
      const btn = document.createElement('button');
      btn.className = 'suggest-btn';
      btn.innerHTML = `${agent.icon} ${agent.name}`;
      btn.onclick = () => {
        if (state.generating) return;
        state.generating = true;
        btn.innerHTML = `<span class="auto-spinner"></span> ${agent.name}...`;
        btn.disabled = true;
        socket.emit('generate-artifact', { roomId: state.roomId, type: typeId });
        showToast(`Generating ${agent.name}...`);
      };
      buttonsDiv.appendChild(btn);
    });
    canvasOffer.appendChild(buttonsDiv);

    // "Generate all" button
    if (suggestedTypes.length > 1) {
      const allBtn = document.createElement('button');
      allBtn.className = 'generate-all-btn';
      allBtn.textContent = '\u26A1 Generate all';
      allBtn.onclick = () => {
        if (state.generating) return;
        state.generating = true;
        allBtn.innerHTML = '<span class="auto-spinner"></span> Generating...';
        allBtn.disabled = true;
        buttonsDiv.querySelectorAll('.suggest-btn').forEach(b => b.disabled = true);
        suggestedTypes.forEach(typeId => {
          const agent = state.agents.find(a => a.id === typeId);
          if (agent) {
            socket.emit('generate-artifact', { roomId: state.roomId, type: typeId });
          }
        });
        showToast('Generating all visualizations...');
      };
      canvasOffer.appendChild(allBtn);
    }

    actionsDiv.appendChild(canvasOffer);
    hasContent = true;
  }

  if (hasContent) {
    lastMsg.appendChild(actionsDiv);
    container.scrollTop = container.scrollHeight;
  }
});

socket.on('artifact-generating', ({ type, status }) => {
  state.generating = true;
  // Could show spinner in chat or canvas
});

socket.on('artifact-created', ({ artifact }) => {
  state.artifacts.push(artifact);
  state.generating = false;
  renderArtifactCard(artifact);

  showToast(`${artifact.icon} ${artifact.title} created!`);

  // Re-enable generation for next artifact
  state.generating = false;
});

socket.on('artifact-moved', ({ artifactId, position }) => {
  const card = document.getElementById(`artifact-${artifactId}`);
  if (card) {
    card.style.left = position.x + 'px';
    card.style.top = position.y + 'px';
  }
  const art = state.artifacts.find(a => a.id === artifactId);
  if (art) art.position = position;
});

socket.on('generation-error', ({ message }) => {
  state.generating = false;
  showToast('Error: ' + message);
  document.getElementById('typingIndicator').classList.remove('visible');
});

// --- Utility ---
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
