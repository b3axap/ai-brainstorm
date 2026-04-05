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

socket.on('join-error', ({ message }) => {
  showLandingError(message);
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
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('vizPickerModal').classList.contains('active')) {
    closeVizPicker();
  }
});

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
  card.tabIndex = 0;
  card.setAttribute('aria-label', `${artifact.icon || ''} ${artifact.title}`);
  card.style.left = artifact.position.x + 'px';
  card.style.top = artifact.position.y + 'px';

  card.innerHTML = `
    <div class="artifact-actions">
      <button class="art-action-btn" data-action="open" title="Open in expanded view">⊞ Open</button>
      <button class="art-action-btn" data-action="expand" title="AI: add more detail">⊕ AI Expand</button>
      <button class="art-action-btn" data-action="transform" title="Convert to another type">⟲ Transform</button>
      <button class="art-action-btn" data-action="ask" title="Ask about this">? Ask</button>
      <button class="art-action-btn" data-action="copy" title="Copy data to clipboard">⎘ Copy</button>
      <button class="art-action-btn" data-action="screenshot" title="Save as PNG">📷 PNG</button>
      <button class="art-action-btn art-action-danger" data-action="delete" title="Delete artifact">🗑</button>
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

  // Setup interactive engine
  if (window.InteractiveEngine) {
    new InteractiveEngine(card, artifact, socket);
  }

  return card;
}

function setupArtifactActions(card, artifact) {
  // Open in expand popup
  card.querySelector('[data-action="open"]').onclick = (e) => {
    e.stopPropagation();
    openArtifactExpand(artifact.id);
  };

  // Double-click on header opens expand popup
  card.querySelector('.artifact-head').addEventListener('dblclick', (e) => {
    e.stopPropagation();
    e.preventDefault();
    openArtifactExpand(artifact.id);
  });

  // AI Expand (ask Claude to add detail)
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

  // Delete artifact
  card.querySelector('[data-action="delete"]').onclick = (e) => {
    e.stopPropagation();
    if (confirm(`Delete "${artifact.title}"?`)) {
      socket.emit('delete-artifact', { roomId: state.roomId, artifactId: artifact.id });
      state.artifacts = state.artifacts.filter(a => a.id !== artifact.id);
      card.remove();
      showToast('Artifact deleted');
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
        // Always add "Другое..." option
        const otherBtn = document.createElement('button');
        otherBtn.className = 'clarify-option-btn clarify-other';
        otherBtn.textContent = 'Другое...';
        otherBtn.onclick = () => {
          const input = document.getElementById('chatInput');
          input.value = '';
          input.focus();
          input.placeholder = 'Напишите свой вариант...';
        };
        optionsDiv.appendChild(otherBtn);
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

  // Pan canvas to the new artifact
  if (card) {
    setTimeout(() => {
      const pos = artifact.position || { x: 0, y: 0 };
      if (window._canvasPanZoom) {
        window._canvasPanZoom.panTo(pos.x - 40, pos.y - 40);
      } else {
        const panel = document.getElementById('canvasPanel');
        if (panel) panel.scrollTo({ left: Math.max(0, pos.x - 40), top: Math.max(0, pos.y - 40), behavior: 'smooth' });
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
    // Re-attach interactive engine (also forwards data to iframes)
    if (window.InteractiveEngine) {
      const engine = new InteractiveEngine(card, art, socket);
      engine.forwardUpdate(data);
    }
  }

  // Refresh expand popup if open for this artifact
  if (expandState.artifactId === artifactId) {
    refreshExpandPopup();
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

socket.on('artifact-deleted', ({ artifactId }) => {
  state.artifacts = state.artifacts.filter(a => a.id !== artifactId);
  const card = document.getElementById(`artifact-${artifactId}`);
  if (card) card.remove();
});

socket.on('generation-error', ({ message }) => {
  state.generating = false;
  showToast('Error: ' + message);
  document.getElementById('typingIndicator').classList.remove('visible');
  // Remove any updating overlays
  document.querySelectorAll('.artifact-updating').forEach(el => el.remove());
});

// --- Artifact Expand Popup ---
let expandState = { artifactId: null, engine: null };

function openArtifactExpand(artifactId) {
  const art = state.artifacts.find(a => a.id === artifactId);
  if (!art) return;

  expandState.artifactId = artifactId;

  const modal = document.getElementById('artifactExpandModal');
  const content = modal.querySelector('.expand-content');
  const header = modal.querySelector('.expand-header');

  // Set header
  header.querySelector('.expand-icon').textContent = art.icon || '📄';
  header.querySelector('.expand-title').textContent = art.title || 'Untitled';
  header.querySelector('.expand-type-badge').textContent = art.renderer || art.type;

  // Render artifact in popup
  renderArtifact(art.renderer || art.type, art.data, content);

  // Attach InteractiveEngine to the expand-body (using a virtual card wrapper)
  if (expandState.engine) expandState.engine.destroy();
  const bodyWrap = modal.querySelector('.expand-body');
  // InteractiveEngine expects card.querySelector('.artifact-body') — use expand-body as card
  const fakeCard = { querySelector: (sel) => sel === '.artifact-body' ? bodyWrap : null };
  if (window.InteractiveEngine) {
    expandState.engine = new InteractiveEngine(fakeCard, art, socket);
  }

  // Show
  modal.classList.add('active');

  // Setup toolbar actions
  setupExpandToolbar(art);
  setupExpandAskBar(art);
}

function closeArtifactExpand() {
  const modal = document.getElementById('artifactExpandModal');
  modal.classList.remove('active');
  if (expandState.engine) {
    expandState.engine.destroy();
    expandState.engine = null;
  }
  expandState.artifactId = null;
  // Clean up transform dropdown
  const dd = modal.querySelector('.expand-transform-dropdown');
  if (dd) dd.remove();
}

function refreshExpandPopup() {
  if (!expandState.artifactId) return;
  const art = state.artifacts.find(a => a.id === expandState.artifactId);
  if (!art) { closeArtifactExpand(); return; }

  const modal = document.getElementById('artifactExpandModal');
  const content = modal.querySelector('.expand-content');

  // Update header
  modal.querySelector('.expand-title').textContent = art.title || 'Untitled';

  // Re-render content
  renderArtifact(art.renderer || art.type, art.data, content);

  // Re-attach engine
  if (expandState.engine) expandState.engine.destroy();
  const bodyWrap = modal.querySelector('.expand-body');
  const fakeCard = { querySelector: (sel) => sel === '.artifact-body' ? bodyWrap : null };
  if (window.InteractiveEngine) {
    expandState.engine = new InteractiveEngine(fakeCard, art, socket);
    expandState.engine.forwardUpdate(art.data);
  }

  // Remove loading overlay
  const loading = modal.querySelector('.expand-loading');
  if (loading) loading.remove();
}

function setupExpandToolbar(artifact) {
  const modal = document.getElementById('artifactExpandModal');

  // AI Expand
  modal.querySelector('[data-expand-action="ai-expand"]').onclick = () => {
    showExpandLoading();
    socket.emit('artifact-action', { roomId: state.roomId, artifactId: artifact.id, action: 'expand' });
  };

  // Transform
  const transformBtn = modal.querySelector('[data-expand-action="transform"]');
  transformBtn.onclick = () => {
    const existing = modal.querySelector('.expand-transform-dropdown');
    if (existing) { existing.remove(); return; }

    const dropdown = document.createElement('div');
    dropdown.className = 'expand-transform-dropdown';
    state.agents.forEach(agent => {
      if (agent.id === artifact.type) return;
      const opt = document.createElement('div');
      opt.className = 'expand-transform-option';
      opt.innerHTML = `${agent.icon} ${escHtml(agent.name)}`;
      opt.onclick = () => {
        dropdown.remove();
        closeArtifactExpand();
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
    transformBtn.style.position = 'relative';
    transformBtn.appendChild(dropdown);

    setTimeout(() => {
      document.addEventListener('click', function close() {
        dropdown.remove();
        document.removeEventListener('click', close);
      }, { once: true });
    }, 0);
  };

  // Copy
  modal.querySelector('[data-expand-action="copy"]').onclick = () => {
    const art = state.artifacts.find(a => a.id === expandState.artifactId);
    if (art) {
      navigator.clipboard.writeText(JSON.stringify(art.data, null, 2)).then(() => showToast('Copied to clipboard!'));
    }
  };

  // PNG screenshot
  modal.querySelector('[data-expand-action="png"]').onclick = async () => {
    const art = state.artifacts.find(a => a.id === expandState.artifactId);
    if (!art) return;
    const content = modal.querySelector('.expand-content');
    try {
      if (typeof html2canvas === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; document.head.appendChild(script); });
      }
      const canvas = await html2canvas(content, { backgroundColor: '#1a1d27', scale: 2 });
      const link = document.createElement('a');
      link.download = `${(art.title || 'artifact').replace(/[^a-z0-9]/gi, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('PNG saved!');
    } catch (err) {
      showToast('Screenshot failed');
    }
  };

  // Delete
  modal.querySelector('[data-expand-action="delete"]').onclick = () => {
    const art = state.artifacts.find(a => a.id === expandState.artifactId);
    if (!art) return;
    if (confirm(`Delete "${art.title}"?`)) {
      closeArtifactExpand();
      socket.emit('delete-artifact', { roomId: state.roomId, artifactId: art.id });
      // Remove locally
      state.artifacts = state.artifacts.filter(a => a.id !== art.id);
      const card = document.getElementById(`artifact-${art.id}`);
      if (card) card.remove();
      showToast('Artifact deleted');
    }
  };
}

function setupExpandAskBar(artifact) {
  const input = document.getElementById('expandAskInput');
  const btn = document.getElementById('expandAskBtn');

  const submit = () => {
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    showExpandLoading();
    socket.emit('artifact-action', {
      roomId: state.roomId,
      artifactId: artifact.id,
      action: 'ask',
      payload: { question }
    });
  };

  btn.onclick = submit;
  input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
}

function showExpandLoading() {
  const body = document.querySelector('#artifactExpandModal .expand-body');
  if (body.querySelector('.expand-loading')) return;
  const overlay = document.createElement('div');
  overlay.className = 'expand-loading';
  overlay.innerHTML = '<div class="gen-spinner"></div>';
  body.appendChild(overlay);
}

// Close handlers
document.getElementById('artifactExpandModal').querySelector('.expand-close').onclick = closeArtifactExpand;
document.getElementById('artifactExpandModal').addEventListener('click', (e) => {
  if (e.target.id === 'artifactExpandModal') closeArtifactExpand();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('artifactExpandModal').classList.contains('active')) {
    closeArtifactExpand();
  }

  // Delete key on focused artifact card
  if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input, textarea, [contenteditable]')) {
    const focused = document.activeElement;
    const card = focused && focused.closest('.artifact-card');
    if (card) {
      const artId = card.id.replace('artifact-', '');
      const art = state.artifacts.find(a => a.id === artId);
      if (art && confirm(`Delete "${art.title}"?`)) {
        socket.emit('delete-artifact', { roomId: state.roomId, artifactId: art.id });
        state.artifacts = state.artifacts.filter(a => a.id !== art.id);
        card.remove();
        showToast('Artifact deleted');
      }
    }
  }
});

// --- Canvas Pan & Zoom (Miro-like) ---
(function initCanvasPanZoom() {
  const panel = document.getElementById('canvasPanel');
  const area = document.getElementById('canvasArea');
  const zoomLevel = document.getElementById('zoomLevel');
  if (!panel || !area) return;

  let scale = 1;
  let panX = 0, panY = 0;
  let isPanning = false;
  let startX, startY, startPanX, startPanY;
  let spaceDown = false;

  function applyTransform() {
    area.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    if (zoomLevel) zoomLevel.textContent = Math.round(scale * 100) + '%';
  }

  function zoomTo(newScale, cx, cy) {
    const clamped = Math.min(2, Math.max(0.2, newScale));
    // Zoom toward cursor: adjust pan so the point under cursor stays fixed
    const rect = panel.getBoundingClientRect();
    const px = (cx !== undefined ? cx : rect.width / 2) - rect.left;
    const py = (cy !== undefined ? cy : rect.height / 2) - rect.top;
    panX = px - (px - panX) * (clamped / scale);
    panY = py - (py - panY) * (clamped / scale);
    scale = clamped;
    applyTransform();
  }

  // Ctrl+Wheel zoom
  panel.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoomTo(scale * delta, e.clientX, e.clientY);
    } else {
      // Normal scroll = pan
      panX -= e.deltaX;
      panY -= e.deltaY;
      applyTransform();
    }
  }, { passive: false });

  // Space key for pan mode
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      spaceDown = true;
      panel.style.cursor = 'grab';
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spaceDown = false;
      if (!isPanning) panel.style.cursor = '';
    }
  });

  // Mouse drag pan (middle-click or space+left-click)
  panel.addEventListener('pointerdown', (e) => {
    if (e.button === 1 || (spaceDown && e.button === 0)) {
      e.preventDefault();
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = panX;
      startPanY = panY;
      panel.classList.add('panning');
      panel.setPointerCapture(e.pointerId);
    }
  });
  panel.addEventListener('pointermove', (e) => {
    if (!isPanning) return;
    panX = startPanX + (e.clientX - startX);
    panY = startPanY + (e.clientY - startY);
    applyTransform();
  });
  panel.addEventListener('pointerup', (e) => {
    if (isPanning) {
      isPanning = false;
      panel.classList.remove('panning');
      panel.style.cursor = spaceDown ? 'grab' : '';
    }
  });

  // Prevent middle-click auto-scroll default
  panel.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });

  // Zoom buttons
  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  if (zoomIn) zoomIn.onclick = () => zoomTo(scale * 1.2);
  if (zoomOut) zoomOut.onclick = () => zoomTo(scale / 1.2);
  if (zoomLevel) zoomLevel.onclick = () => { scale = 1; panX = 0; panY = 0; applyTransform(); };

  // Expose for scrollTo on artifact creation
  window._canvasPanZoom = { zoomTo, applyTransform, getScale: () => scale, panTo(x, y) { panX = -x; panY = -y; applyTransform(); } };
})();

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
