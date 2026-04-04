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
  pendingSuggestions: []
};

// Load agents list
fetch('/api/agents')
  .then(r => r.json())
  .then(agents => { state.agents = agents; })
  .catch(err => {
    console.error('Failed to load agents:', err);
    showToast('Failed to load visualization types');
  });

// --- Socket.IO connection handling ---
socket.on('connect_error', () => showToast('Connection error — retrying...'));

socket.on('disconnect', (reason) => {
  state.generating = false;
  document.getElementById('typingIndicator').classList.remove('visible');
  if (reason !== 'io client disconnect') showToast('Disconnected — reconnecting...');
});

socket.on('reconnect', () => {
  showToast('Reconnected!');
  if (state.roomId && state.userName) {
    socket.emit('join-room', { userName: state.userName, roomId: state.roomId });
  }
});

// --- Screen switching (landing / workspace) ---
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  state.screen = name;
  if (name === 'workspace') document.getElementById('chatInput').focus();
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
  const hasFiles = state.pendingFiles.length > 0;
  if ((!content && !hasFiles) || state.generating) return;
  input.value = '';
  closeMentionDropdown();

  const isNewIdea = state.newIdeaMode || false;
  const files = hasFiles ? [...state.pendingFiles] : undefined;
  socket.emit('send-message', { roomId: state.roomId, content: content || '(attached files)', isNewIdea, files });

  // Clear pending files
  if (hasFiles) {
    state.pendingFiles = [];
    renderFilePreview();
  }

  // Reset new-idea mode after sending
  if (state.newIdeaMode) {
    state.newIdeaMode = false;
    input.placeholder = 'Describe your idea...';
    input.closest('.chat-input').classList.remove('new-idea-mode');
    document.getElementById('newIdeaBtn').classList.remove('active');
  }
}

function addChatMessage(message) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${message.role}`;
  div.id = `msg-${message.id}`;

  const nameLabel = message.role === 'assistant' ? 'Claude' : message.userName || 'User';
  const bubbleContent = message.role === 'assistant' ? renderMarkdown(message.content) : escHtml(message.content);

  let filesHtml = '';
  if (message.files && message.files.length > 0) {
    const chips = message.files.map(f => {
      if (f.isImage) {
        return `<div class="msg-file"><img class="msg-file-thumb" src="data:${f.type};base64,${f.data}" alt="${escHtml(f.name)}"></div>`;
      }
      return `<div class="msg-file"><span class="msg-file-icon">📄</span><span class="msg-file-name">${escHtml(f.name)}</span></div>`;
    }).join('');
    filesHtml = `<div class="msg-files">${chips}</div>`;
  }

  div.innerHTML = `
    <div class="msg-header"><span class="name">${escHtml(nameLabel)}</span></div>
    ${filesHtml}
    <div class="msg-bubble">${bubbleContent}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// --- Streaming ---
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
      if (bubble) bubble.innerHTML = renderMarkdown(fullMessage);
    }
  }
  streamingMsgId = null;
  streamingActive = false;
}

// --- Resize Handle ---
(function setupResizeHandle() {
  const handle = document.getElementById('resizeHandle');
  const body = document.getElementById('workspaceBody');
  if (!handle || !body) return;

  let dragging = false;

  handle.onmousedown = (e) => {
    dragging = true;
    handle.classList.add('active');
    e.preventDefault();
  };

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = body.getBoundingClientRect();
    const chatWidth = Math.max(280, Math.min(e.clientX - rect.left, rect.width * 0.5));
    body.style.gridTemplateColumns = `${chatWidth}px 4px 1fr`;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('active');
  });
})();

// --- Mobile Tabs ---
(function setupMobileTabs() {
  const tabChat = document.getElementById('mobileTabChat');
  const tabCanvas = document.getElementById('mobileTabCanvas');
  const body = document.getElementById('workspaceBody');
  if (!tabChat || !tabCanvas || !body) return;

  tabChat.onclick = () => {
    body.classList.remove('show-canvas');
    tabChat.classList.add('active');
    tabCanvas.classList.remove('active');
  };

  tabCanvas.onclick = () => {
    body.classList.add('show-canvas');
    tabCanvas.classList.add('active');
    tabChat.classList.remove('active');
  };
})();

// --- Chat Action Buttons ---
// --- File Attachment ---
state.pendingFiles = [];

document.getElementById('attachBtn').onclick = () => {
  document.getElementById('fileInput').click();
};

document.getElementById('fileInput').onchange = (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  files.forEach(file => {
    if (file.size > 10 * 1024 * 1024) {
      showToast(`${file.name} is too large (max 10MB)`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      const isImage = file.type.startsWith('image/');
      state.pendingFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64,
        isImage
      });
      renderFilePreview();
    };
    reader.readAsDataURL(file);
  });

  // Reset input so same file can be re-selected
  e.target.value = '';
};

function renderFilePreview() {
  let container = document.getElementById('filePreviewBar');
  if (!container) {
    container = document.createElement('div');
    container.id = 'filePreviewBar';
    container.className = 'file-preview-bar';
    const chatInput = document.querySelector('.chat-input');
    chatInput.parentNode.insertBefore(container, chatInput);
  }

  container.innerHTML = '';
  if (state.pendingFiles.length === 0) {
    container.remove();
    return;
  }

  state.pendingFiles.forEach((file, idx) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    if (file.isImage) {
      chip.innerHTML = `<img class="file-chip-thumb" src="data:${file.type};base64,${file.data}" alt="">`;
    } else {
      chip.innerHTML = `<span class="file-chip-icon">📄</span>`;
    }
    chip.innerHTML += `<span class="file-chip-name">${escHtml(file.name)}</span>`;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-chip-remove';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => {
      state.pendingFiles.splice(idx, 1);
      renderFilePreview();
    };
    chip.appendChild(removeBtn);
    container.appendChild(chip);
  });
}

document.getElementById('newIdeaBtn').onclick = () => {
  state.newIdeaMode = !state.newIdeaMode;
  const chatInput = document.getElementById('chatInput');
  const chatInputContainer = chatInput.closest('.chat-input');
  const btn = document.getElementById('newIdeaBtn');

  if (state.newIdeaMode) {
    chatInput.placeholder = 'Describe your new idea...';
    chatInputContainer.classList.add('new-idea-mode');
    btn.classList.add('active');
    chatInput.focus();
  } else {
    chatInput.placeholder = 'Describe your idea...';
    chatInputContainer.classList.remove('new-idea-mode');
    btn.classList.remove('active');
  }
};

// --- Visualization Picker Modal ---
document.getElementById('vizCancelBtn').onclick = closeVizPicker;
document.getElementById('vizPickerModal').onclick = (e) => {
  if (e.target.id === 'vizPickerModal') closeVizPicker();
};

document.getElementById('vizCustomCheck').onchange = (e) => {
  document.getElementById('vizCustomInput').disabled = !e.target.checked;
  if (e.target.checked) document.getElementById('vizCustomInput').focus();
  updateVizGenerateBtn();
};

document.getElementById('vizGenerateBtn').onclick = () => {
  const selected = getSelectedVizTypes();
  const customText = document.getElementById('vizCustomCheck').checked
    ? document.getElementById('vizCustomInput').value.trim() : '';
  const refIds = getSelectedRefIds();

  if (selected.length === 0 && !customText) return;
  closeVizPicker();

  selected.forEach(typeId => {
    socket.emit('generate-artifact', { roomId: state.roomId, type: typeId, referenceIds: refIds });
  });

  if (customText) {
    socket.emit('send-message', { roomId: state.roomId, content: customText });
    socket.emit('generate-artifact', { roomId: state.roomId, type: 'freeform', referenceIds: refIds });
  }

  const count = selected.length + (customText ? 1 : 0);
  showToast(`Generating ${count} visualization${count > 1 ? 's' : ''}...`);
};

document.getElementById('vizCustomInput').oninput = updateVizGenerateBtn;

function openVizPicker(preSelected) {
  state.pendingSuggestions = preSelected || [];
  populateVizGrid();
  populateVizRefs();
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
    card.querySelector('.viz-checkbox').onchange = function() {
      card.classList.toggle('selected', this.checked);
      updateVizGenerateBtn();
    };
    grid.appendChild(card);
  });
}

function populateVizRefs() {
  const refsContainer = document.getElementById('vizReferences');
  const grid = document.getElementById('vizRefGrid');
  if (state.artifacts.length === 0) {
    refsContainer.style.display = 'none';
    return;
  }
  refsContainer.style.display = '';
  grid.innerHTML = '';
  state.artifacts.forEach(art => {
    const chip = document.createElement('div');
    chip.className = 'viz-ref-chip';
    chip.dataset.artifactId = art.id;
    chip.innerHTML = `<span class="ref-icon">${art.icon || '📄'}</span> ${escHtml(art.title || 'Untitled')}`;
    chip.onclick = () => chip.classList.toggle('selected');
    grid.appendChild(chip);
  });
}

function getSelectedVizTypes() {
  return Array.from(document.querySelectorAll('.viz-checkbox:checked')).map(cb => cb.dataset.agentId);
}

function getSelectedRefIds() {
  return Array.from(document.querySelectorAll('.viz-ref-chip.selected')).map(el => el.dataset.artifactId);
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

// --- @ Mention Autocomplete ---
(function setupMentionAutocomplete() {
  const input = document.getElementById('chatInput');
  const dropdown = document.getElementById('mentionDropdown');
  if (!input || !dropdown) return;

  let mentionActive = false;
  let mentionStart = -1;

  input.addEventListener('input', () => {
    const val = input.value;
    const pos = input.selectionStart;

    // Find @ before cursor
    const before = val.substring(0, pos);
    const atIdx = before.lastIndexOf('@');

    if (atIdx >= 0 && (atIdx === 0 || before[atIdx - 1] === ' ')) {
      const query = before.substring(atIdx + 1).toLowerCase();
      const matches = state.artifacts.filter(a =>
        (a.title || '').toLowerCase().includes(query) ||
        (a.type || '').toLowerCase().includes(query)
      ).slice(0, 5);

      if (matches.length > 0) {
        mentionActive = true;
        mentionStart = atIdx;
        showMentionDropdown(matches, input);
        return;
      }
    }

    closeMentionDropdown();
  });

  input.addEventListener('keydown', (e) => {
    if (!mentionActive) return;
    if (e.key === 'Escape') {
      closeMentionDropdown();
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const active = dropdown.querySelector('.mention-item.active') || dropdown.querySelector('.mention-item');
      if (active && mentionActive) {
        selectMention(active.dataset.artifactId, input);
        e.preventDefault();
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = dropdown.querySelectorAll('.mention-item');
      if (items.length === 0) return;
      const current = dropdown.querySelector('.mention-item.active');
      if (current) current.classList.remove('active');
      let idx = Array.from(items).indexOf(current);
      idx = e.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
      items[idx].classList.add('active');
      e.preventDefault();
    }
  });

  function showMentionDropdown(matches, inputEl) {
    dropdown.innerHTML = '';
    matches.forEach((art, i) => {
      const item = document.createElement('div');
      item.className = `mention-item${i === 0 ? ' active' : ''}`;
      item.dataset.artifactId = art.id;
      item.innerHTML = `
        <span class="mention-icon">${art.icon || '📄'}</span>
        <span class="mention-title">${escHtml(art.title || 'Untitled')}</span>
        <span class="mention-type">${escHtml(art.type)}</span>
      `;
      item.onclick = () => selectMention(art.id, inputEl);
      dropdown.appendChild(item);
    });

    const rect = inputEl.getBoundingClientRect();
    dropdown.style.left = rect.left + 'px';
    dropdown.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    dropdown.classList.add('visible');
  }

  function selectMention(artifactId, inputEl) {
    const art = state.artifacts.find(a => a.id === artifactId);
    if (!art) return;
    const val = inputEl.value;
    const before = val.substring(0, mentionStart);
    const after = val.substring(inputEl.selectionStart);
    inputEl.value = before + '@' + (art.title || art.type) + ' ' + after;
    closeMentionDropdown();
    inputEl.focus();
  }
})();

function closeMentionDropdown() {
  const dropdown = document.getElementById('mentionDropdown');
  if (dropdown) dropdown.classList.remove('visible');
}

// --- Artifact rendering on canvas ---
function renderArtifactCard(artifact) {
  const card = document.createElement('div');
  card.className = 'artifact-card';
  card.id = `artifact-${artifact.id}`;
  card.style.left = artifact.position.x + 'px';
  card.style.top = artifact.position.y + 'px';

  card.innerHTML = `
    <div class="artifact-actions">
      <button class="art-action-btn" data-action="expand" title="Expand / deepen">⊕ Expand</button>
      <button class="art-action-btn" data-action="transform" title="Convert to another type">⟲ Transform</button>
      <button class="art-action-btn" data-action="ask" title="Ask about this">? Ask</button>
      <button class="art-action-btn" data-action="copy" title="Copy data to clipboard">⎘ Copy</button>
      <button class="art-action-btn" data-action="screenshot" title="Save as PNG">📷 PNG</button>
    </div>
    <div class="artifact-head">
      <span class="a-icon">${artifact.icon || '📄'}</span>
      <span class="a-title">${escHtml(artifact.title || 'Untitled')}</span>
      <span class="a-author">by ${escHtml(artifact.author || '?')}</span>
    </div>
    <div class="artifact-body" id="abody-${artifact.id}"></div>
    <div class="artifact-ask-bar" id="askbar-${artifact.id}">
      <input class="input" placeholder="Ask about this visualization..." autocomplete="off">
      <button class="btn btn-primary">Ask</button>
    </div>
  `;

  document.getElementById('canvasContent').appendChild(card);

  // Bring to front on click
  card.addEventListener('mousedown', () => {
    document.querySelectorAll('.artifact-card').forEach(c => {
      if (c !== card) c.style.zIndex = Math.min(parseInt(c.style.zIndex) || 1, 10);
    });
    card.style.zIndex = 50;
  });

  // Hide empty state
  const emptyEl = document.getElementById('canvasEmpty');
  if (emptyEl) emptyEl.style.display = 'none';

  // Render content
  const body = document.getElementById(`abody-${artifact.id}`);
  renderArtifact(artifact.renderer || artifact.type, artifact.data, body);

  // Setup action bar
  setupArtifactActions(card, artifact);

  // Setup drag
  setupDrag(card, artifact);

  // Setup interactive layer if available
  if (window.InteractiveLayer) {
    new InteractiveLayer(card, artifact, socket);
  }

  return card;
}

function setupArtifactActions(card, artifact) {
  // Action buttons
  card.querySelector('[data-action="expand"]').onclick = (e) => {
    e.stopPropagation();
    showArtifactUpdating(card);
    socket.emit('artifact-action', { roomId: state.roomId, artifactId: artifact.id, action: 'expand' });
  };

  card.querySelector('[data-action="transform"]').onclick = (e) => {
    e.stopPropagation();
    showTransformDropdown(card, artifact);
  };

  card.querySelector('[data-action="ask"]').onclick = (e) => {
    e.stopPropagation();
    const askBar = document.getElementById(`askbar-${artifact.id}`);
    askBar.classList.toggle('visible');
    if (askBar.classList.contains('visible')) askBar.querySelector('input').focus();
  };

  // Copy data to clipboard
  card.querySelector('[data-action="copy"]').onclick = (e) => {
    e.stopPropagation();
    const text = JSON.stringify(artifact.data, null, 2);
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
  };

  // Screenshot as PNG
  card.querySelector('[data-action="screenshot"]').onclick = async (e) => {
    e.stopPropagation();
    if (typeof html2canvas === 'undefined') {
      showToast('Loading screenshot tool...');
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.onload = () => captureArtifactPNG(card, artifact);
      document.head.appendChild(script);
    } else {
      captureArtifactPNG(card, artifact);
    }
  };

  // Ask bar submit
  const askBar = document.getElementById(`askbar-${artifact.id}`);
  const askInput = askBar.querySelector('input');
  const askBtn = askBar.querySelector('button');

  askBtn.onclick = () => submitAskQuestion(artifact, askInput, askBar, card);
  askInput.onkeypress = (e) => {
    if (e.key === 'Enter') submitAskQuestion(artifact, askInput, askBar, card);
  };
}

async function captureArtifactPNG(card, artifact) {
  try {
    // Temporarily hide action bar
    const actions = card.querySelector('.artifact-actions');
    if (actions) actions.style.display = 'none';
    const canvas = await html2canvas(card, { backgroundColor: '#1a1d27', scale: 2 });
    if (actions) actions.style.display = '';

    const link = document.createElement('a');
    link.download = `${(artifact.title || 'artifact').replace(/[^a-z0-9]/gi, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('PNG saved!');
  } catch (err) {
    showToast('Screenshot failed');
    console.error('Screenshot error:', err);
  }
}

function submitAskQuestion(artifact, askInput, askBar, card) {
  const question = askInput.value.trim();
  if (!question) return;
  askInput.value = '';
  askBar.classList.remove('visible');
  showArtifactUpdating(card);
  socket.emit('artifact-action', {
    roomId: state.roomId,
    artifactId: artifact.id,
    action: 'ask',
    payload: { question }
  });
}

function showTransformDropdown(card, artifact) {
  // Remove any existing dropdown
  const existing = card.querySelector('.transform-dropdown');
  if (existing) { existing.remove(); return; }

  const dropdown = document.createElement('div');
  dropdown.className = 'transform-dropdown visible';
  state.agents.forEach(agent => {
    if (agent.id === artifact.type) return; // skip current type
    const opt = document.createElement('div');
    opt.className = 'transform-option';
    opt.innerHTML = `${agent.icon} ${escHtml(agent.name)}`;
    opt.onclick = (e) => {
      e.stopPropagation();
      dropdown.remove();
      socket.emit('artifact-action', {
        roomId: state.roomId,
        artifactId: artifact.id,
        action: 'transform',
        payload: { targetType: agent.id }
      });
      showToast(`Transforming to ${agent.name}...`);
    };
    dropdown.appendChild(opt);
  });
  card.querySelector('.artifact-actions').appendChild(dropdown);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown() {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }, { once: true });
  }, 0);
}

function showArtifactUpdating(card) {
  const overlay = document.createElement('div');
  overlay.className = 'artifact-updating';
  overlay.innerHTML = '<div class="gen-spinner"></div>';
  card.style.position = 'absolute'; // ensure positioning context
  card.appendChild(overlay);
}

function removeArtifactUpdating(card) {
  const overlay = card.querySelector('.artifact-updating');
  if (overlay) overlay.remove();
}

function setupDrag(card, artifact) {
  const head = card.querySelector('.artifact-head');
  let startX, startY, origLeft, origTop;

  function onMouseMove(e) {
    card.style.left = (origLeft + e.clientX - startX) + 'px';
    card.style.top = (origTop + e.clientY - startY) + 'px';
  }

  function onMouseUp() {
    card.classList.remove('dragging');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    const pos = { x: parseInt(card.style.left) || 0, y: parseInt(card.style.top) || 0 };
    socket.emit('move-artifact', { roomId: state.roomId, artifactId: artifact.id, position: pos });
  }

  head.onmousedown = (e) => {
    if (e.target.closest('.artifact-actions')) return; // don't drag from action buttons
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

// --- Update UI helpers ---
function updateUserLists() {
  const names = state.users.map(u => u.name).join(', ');
  const el = document.getElementById('usersList');
  if (el) el.textContent = names;
}

function updateRoomCode() {
  const el = document.getElementById('roomCode');
  if (el) el.textContent = state.roomId;
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

  state.messages.forEach(msg => addChatMessage(msg));
  room.artifacts.forEach(art => renderArtifactCard(art));

  showScreen('workspace');
});

socket.on('user-joined', ({ user }) => {
  state.users.push(user);
  updateUserLists();
});

socket.on('user-left', ({ socketId }) => {
  state.users = state.users.filter(u => u.socketId !== socketId);
  updateUserLists();
});

socket.on('new-message', ({ message }) => {
  state.messages.push(message);
  if (message.role === 'user') addChatMessage(message);
});

socket.on('claude-chunk', ({ chunk }) => {
  appendStream(chunk);
});

socket.on('claude-done', ({ fullMessage, suggestedTypes, clarifyQuestions, offerCanvas, canvasAction }) => {
  endStreaming(fullMessage);
  state.generating = false;

  const container = document.getElementById('chatMessages');
  const lastMsg = container.querySelector('.message.assistant:last-child');
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

  // Canvas offer: only on mandatory_done phase (first time)
  if (offerCanvas && hasSuggestions) {
    const canvasOffer = document.createElement('div');
    canvasOffer.className = 'canvas-offer';

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

    const pushBtn = document.createElement('button');
    pushBtn.className = 'push-to-canvas-btn';
    pushBtn.textContent = '\uD83C\uDFA8 Choose more visualizations...';
    pushBtn.onclick = () => openVizPicker(suggestedTypes);
    canvasOffer.appendChild(pushBtn);

    actionsDiv.appendChild(canvasOffer);
    hasContent = true;
  }

  // Canvas action from Claude (auto-detected intent)
  if (canvasAction && canvasAction.intent) {
    const actionDiv = document.createElement('div');
    let label = '';
    if (canvasAction.intent === 'create') {
      const agent = state.agents.find(a => a.id === canvasAction.artifact_type);
      label = agent ? `${agent.icon} Create ${agent.name}` : `Create ${canvasAction.artifact_type}`;
    } else if (canvasAction.intent === 'update') {
      const art = state.artifacts.find(a => a.id === canvasAction.target_id);
      label = `Update ${art ? art.title : 'artifact'}`;
    } else if (canvasAction.intent === 'transform') {
      const agent = state.agents.find(a => a.id === canvasAction.artifact_type);
      label = agent ? `Transform to ${agent.name}` : `Transform`;
    }

    const actionBtn = document.createElement('button');
    actionBtn.className = 'canvas-action-btn';
    actionBtn.innerHTML = `${label} →`;
    actionBtn.onclick = () => {
      actionBtn.disabled = true;
      actionBtn.innerHTML = `<span class="auto-spinner"></span> ${label}...`;
      socket.emit('execute-canvas-action', { roomId: state.roomId, canvasAction });
    };
    actionDiv.appendChild(actionBtn);
    actionsDiv.appendChild(actionDiv);
    hasContent = true;
  }

  if (hasContent) {
    lastMsg.appendChild(actionsDiv);
    container.scrollTop = container.scrollHeight;
  }
});

socket.on('artifact-generating', ({ type }) => {
  state.generating = true;
});

socket.on('artifact-created', ({ artifact }) => {
  state.artifacts.push(artifact);
  state.generating = false;
  const card = renderArtifactCard(artifact);
  showToast(`${artifact.icon || '📄'} ${artifact.title || 'Untitled'} created!`);

  // On mobile, switch to canvas to show the new artifact
  if (window.innerWidth <= 768) {
    const tabCanvas = document.getElementById('mobileTabCanvas');
    if (tabCanvas) tabCanvas.click();
  }

  // Smooth scroll canvas to the new artifact
  if (card) {
    setTimeout(() => {
      const panel = document.getElementById('canvasPanel');
      if (panel) {
        const pos = artifact.position || { x: 0, y: 0 };
        panel.scrollTo({ left: Math.max(0, pos.x - 40), top: Math.max(0, pos.y - 40), behavior: 'smooth' });
      }
    }, 100);
  }
});

socket.on('artifact-updated', ({ artifactId, data, title }) => {
  const art = state.artifacts.find(a => a.id === artifactId);
  if (!art) return;

  // Update state
  art.data = data;
  if (title) art.title = title;

  // Re-render card body
  const body = document.getElementById(`abody-${artifactId}`);
  if (body) renderArtifact(art.renderer || art.type, data, body);

  // Update title
  const card = document.getElementById(`artifact-${artifactId}`);
  if (card) {
    removeArtifactUpdating(card);
    if (title) {
      const titleEl = card.querySelector('.a-title');
      if (titleEl) titleEl.textContent = title;
    }
    // Re-attach interactive layer
    if (window.InteractiveLayer) {
      new InteractiveLayer(card, art, socket);
    }
  }

  showToast(`${art.icon || '📄'} ${art.title} updated!`);
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
  // Remove any updating overlays
  document.querySelectorAll('.artifact-updating').forEach(el => el.remove());
});

// --- Utility ---
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function renderMarkdown(text) {
  if (!text) return '';
  if (typeof marked !== 'undefined' && marked.parse) {
    try {
      return marked.parse(text, { breaks: true, gfm: true });
    } catch (e) {
      return escHtml(text);
    }
  }
  return escHtml(text);
}
