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
  agents: [],
  pendingSuggestions: []  // Claude's suggested agent IDs for viz picker pre-selection
};

// Load agents list
fetch('/api/agents')
  .then(r => r.json())
  .then(agents => {
    state.agents = agents;
    populateAgentGrid();
  })
  .catch(err => {
    console.error('Failed to load agents:', err);
    showToast('Failed to load visualization types');
  });

// --- Socket.IO connection handling ---
socket.on('connect_error', () => {
  showToast('Connection error — retrying...');
});

socket.on('disconnect', (reason) => {
  state.generating = false;
  document.getElementById('typingIndicator').classList.remove('visible');
  if (reason !== 'io client disconnect') {
    showToast('Disconnected — reconnecting...');
  }
});

socket.on('reconnect', () => {
  showToast('Reconnected!');
  // Re-join room if we were in one
  if (state.roomId && state.userName) {
    socket.emit('join-room', { userName: state.userName, roomId: state.roomId });
  }
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
let streamingActive = false;

function startStreaming() {
  streamingMsgId = 'stream-' + Date.now();
  streamingActive = true;
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
  if (!streamingActive) startStreaming();
  const msgEl = streamingMsgId ? document.getElementById(`msg-${streamingMsgId}`) : null;
  if (msgEl) {
    const bubble = msgEl.querySelector('.msg-bubble');
    if (bubble) bubble.textContent += chunk;
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function endStreaming(fullMessage) {
  document.getElementById('typingIndicator').classList.remove('visible');
  if (streamingMsgId) {
    const msgEl = document.getElementById(`msg-${streamingMsgId}`);
    if (msgEl) {
      const bubble = msgEl.querySelector('.msg-bubble');
      if (bubble) bubble.textContent = fullMessage;
    }
  }
  streamingMsgId = null;
  streamingActive = false;
}

// --- Canvas ---
document.getElementById('goCanvasBtn').onclick = () => showScreen('canvas');
document.getElementById('goChatBtn').onclick = () => showScreen('chat');

// --- Visualization Picker Modal ---
document.getElementById('newIdeaBtn').onclick = () => openVizPicker([]);
document.getElementById('vizCancelBtn').onclick = closeVizPicker;
document.getElementById('vizPickerModal').onclick = (e) => {
  if (e.target.id === 'vizPickerModal') closeVizPicker();
};

// Custom viz checkbox toggles input
document.getElementById('vizCustomCheck').onchange = (e) => {
  document.getElementById('vizCustomInput').disabled = !e.target.checked;
  if (e.target.checked) document.getElementById('vizCustomInput').focus();
  updateVizGenerateBtn();
};

// Generate selected button
document.getElementById('vizGenerateBtn').onclick = () => {
  const selected = getSelectedVizTypes();
  const customText = document.getElementById('vizCustomCheck').checked
    ? document.getElementById('vizCustomInput').value.trim() : '';

  if (selected.length === 0 && !customText) return;

  closeVizPicker();

  // Generate each selected type
  selected.forEach(typeId => {
    socket.emit('generate-artifact', { roomId: state.roomId, type: typeId });
  });

  // Handle custom visualization
  if (customText) {
    socket.emit('canvas-message', { roomId: state.roomId, content: customText });
    socket.emit('generate-artifact', { roomId: state.roomId, type: 'freeform' });
  }

  const count = selected.length + (customText ? 1 : 0);
  showToast(`Generating ${count} visualization${count > 1 ? 's' : ''}...`);
};

function openVizPicker(preSelected) {
  state.pendingSuggestions = preSelected || [];
  populateVizGrid();
  document.getElementById('vizCustomCheck').checked = false;
  document.getElementById('vizCustomInput').value = '';
  document.getElementById('vizCustomInput').disabled = true;
  document.getElementById('vizPickerModal').classList.add('active');
  updateVizGenerateBtn();
}

function closeVizPicker() {
  document.getElementById('vizPickerModal').classList.remove('active');
}

function populateVizGrid() {
  const grid = document.getElementById('vizGrid');
  grid.innerHTML = '';
  state.agents.forEach(agent => {
    const isPreSelected = state.pendingSuggestions.includes(agent.id);
    const card = document.createElement('label');
    card.className = `viz-card${isPreSelected ? ' selected' : ''}`;
    card.innerHTML = `
      <input type="checkbox" class="viz-checkbox" data-agent-id="${agent.id}" ${isPreSelected ? 'checked' : ''}>
      <span class="viz-icon">${agent.icon}</span>
      <span class="viz-name">${escHtml(agent.name)}</span>
      ${isPreSelected ? '<span class="viz-recommended">recommended</span>' : ''}
    `;
    const checkbox = card.querySelector('.viz-checkbox');
    checkbox.onchange = () => {
      card.classList.toggle('selected', checkbox.checked);
      updateVizGenerateBtn();
    };
    grid.appendChild(card);
  });
}

function populateAgentGrid() {
  // Kept for backward compat — now just calls populateVizGrid when agents load
}

function getSelectedVizTypes() {
  return Array.from(document.querySelectorAll('.viz-checkbox:checked'))
    .map(cb => cb.dataset.agentId);
}

function updateVizGenerateBtn() {
  const selected = getSelectedVizTypes();
  const hasCustom = document.getElementById('vizCustomCheck').checked
    && document.getElementById('vizCustomInput').value.trim();
  const count = selected.length + (hasCustom ? 1 : 0);
  const btn = document.getElementById('vizGenerateBtn');
  btn.disabled = count === 0;
  btn.textContent = count > 0 ? `Generate Selected (${count})` : 'Generate Selected (0)';
}

// Update count when custom input changes
document.getElementById('vizCustomInput').oninput = updateVizGenerateBtn;

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
  let startX, startY, origLeft, origTop;

  function onMouseMove(e) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    card.style.left = (origLeft + dx) + 'px';
    card.style.top = (origTop + dy) + 'px';
  }

  function onMouseUp() {
    card.classList.remove('dragging');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    const pos = { x: parseInt(card.style.left) || 0, y: parseInt(card.style.top) || 0 };
    socket.emit('move-artifact', { roomId: state.roomId, artifactId: artifact.id, position: pos });
  }

  head.onmousedown = (e) => {
    card.classList.add('dragging');
    startX = e.clientX;
    startY = e.clientY;
    origLeft = parseInt(card.style.left) || 0;
    origTop = parseInt(card.style.top) || 0;
    e.preventDefault();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
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
  state.messages = room.messages || [];
  state.artifacts = room.artifacts;

  updateRoomCode();
  updateUserLists();

  // Render personal chat messages
  state.messages.forEach(msg => addChatMessage(msg));

  // Render existing artifacts on canvas
  room.artifacts.forEach(art => renderArtifactCard(art));

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
  }
});

// Messages from other users (shown in sidebar only)
socket.on('sidebar-message', ({ message }) => {
  addSidebarMessage(message);
});

socket.on('claude-chunk', ({ chunk }) => {
  appendStream(chunk);
});

socket.on('claude-done', ({ fullMessage, suggestedTypes, clarifyQuestions, phase, offerCanvas }) => {
  endStreaming(fullMessage);
  state.generating = false;

  const container = document.getElementById('chatMessages');
  const lastMsg = streamingMsgId === null
    ? container.querySelector('.message.assistant:last-child') || container.querySelector('.message:last-child')
    : null;
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

  // Canvas offer: "Push to Canvas" button that opens the viz picker modal
  if (offerCanvas && hasSuggestions) {
    const canvasOffer = document.createElement('div');
    canvasOffer.className = 'canvas-offer';

    // Quick-pick buttons for suggested types
    const quickLabel = document.createElement('div');
    quickLabel.className = 'canvas-offer-label';
    quickLabel.textContent = '\u2728 Suggested visualizations:';
    canvasOffer.appendChild(quickLabel);

    const quickBtns = document.createElement('div');
    quickBtns.className = 'suggest-buttons';
    suggestedTypes.forEach(typeId => {
      const agent = state.agents.find(a => a.id === typeId);
      if (!agent) return;
      const btn = document.createElement('button');
      btn.className = 'suggest-btn';
      btn.dataset.agentType = typeId;
      btn.innerHTML = `${agent.icon} ${agent.name}`;
      quickBtns.appendChild(btn);
    });
    // Event delegation for suggest buttons
    quickBtns.onclick = (e) => {
      const btn = e.target.closest('.suggest-btn');
      if (!btn || btn.disabled) return;
      const typeId = btn.dataset.agentType;
      const agent = state.agents.find(a => a.id === typeId);
      if (!agent) return;
      btn.innerHTML = `<span class="auto-spinner"></span> ${agent.name}...`;
      btn.disabled = true;
      socket.emit('generate-artifact', { roomId: state.roomId, type: typeId });
      showToast(`Generating ${agent.name}...`);
    };
    canvasOffer.appendChild(quickBtns);

    // "Push to Canvas" button opens full picker
    const pushBtn = document.createElement('button');
    pushBtn.className = 'push-to-canvas-btn';
    pushBtn.textContent = '\uD83C\uDFA8 Push to Canvas \u2014 choose visualizations...';
    pushBtn.onclick = () => openVizPicker(suggestedTypes);
    canvasOffer.appendChild(pushBtn);

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
  showToast(`${artifact.icon || '📄'} ${artifact.title || 'Untitled'} created!`);
});

socket.on('artifact-moved', ({ artifactId, position }) => {
  if (!position) return;
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
