// chat.js — Landing, chat input, streaming, file attachment, mentions

(function() {
  const { socket, state, escHtml, renderMarkdown, showToast } = App;

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

  // --- Chat Input ---
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
    App.closeMentionDropdown();

    const isNewIdea = state.newIdeaMode || false;
    const files = hasFiles ? [...state.pendingFiles] : undefined;
    socket.emit('send-message', { roomId: state.roomId, content: content || '(attached files)', isNewIdea, files });

    if (hasFiles) {
      state.pendingFiles = [];
      renderFilePreview();
    }

    if (state.newIdeaMode) {
      state.newIdeaMode = false;
      input.placeholder = 'Describe your idea...';
      input.closest('.chat-input').classList.remove('new-idea-mode');
      document.getElementById('newIdeaBtn').classList.remove('active');
    }
  }

  // --- Chat Action Buttons ---
  document.getElementById('attachBtn').onclick = () => {
    document.getElementById('fileInput').click();
  };

  document.getElementById('newIdeaBtn').onclick = () => {
    state.newIdeaMode = !state.newIdeaMode;
    const chatInput = document.getElementById('chatInput');
    const container = chatInput.closest('.chat-input');
    const btn = document.getElementById('newIdeaBtn');

    if (state.newIdeaMode) {
      chatInput.placeholder = 'Describe your new idea...';
      container.classList.add('new-idea-mode');
      btn.classList.add('active');
      chatInput.focus();
    } else {
      chatInput.placeholder = 'Describe your idea...';
      container.classList.remove('new-idea-mode');
      btn.classList.remove('active');
    }
  };

  // --- File Attachment ---
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
        state.pendingFiles.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result.split(',')[1],
          isImage: file.type.startsWith('image/')
        });
        renderFilePreview();
      };
      reader.readAsDataURL(file);
    });
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
    if (state.pendingFiles.length === 0) { container.remove(); return; }

    state.pendingFiles.forEach((file, idx) => {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      chip.innerHTML = file.isImage
        ? `<img class="file-chip-thumb" src="data:${file.type};base64,${file.data}" alt="">`
        : `<span class="file-chip-icon">📄</span>`;
      chip.innerHTML += `<span class="file-chip-name">${escHtml(file.name)}</span>`;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'file-chip-remove';
      removeBtn.textContent = '×';
      removeBtn.onclick = () => { state.pendingFiles.splice(idx, 1); renderFilePreview(); };
      chip.appendChild(removeBtn);
      container.appendChild(chip);
    });
  }

  // --- Streaming ---
  let streamingMsgId = null;
  let streamingActive = false;

  App.startStreaming = function() {
    streamingMsgId = 'stream-' + Date.now();
    streamingActive = true;
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = `msg-${streamingMsgId}`;
    div.innerHTML = `<div class="msg-header"><span class="name">Claude</span></div><div class="msg-bubble"></div>`;
    container.appendChild(div);
    document.getElementById('typingIndicator').classList.add('visible');
    state.generating = true;
  };

  App.appendStream = function(chunk) {
    if (!streamingActive) App.startStreaming();
    const msgEl = streamingMsgId ? document.getElementById(`msg-${streamingMsgId}`) : null;
    if (msgEl) {
      const bubble = msgEl.querySelector('.msg-bubble');
      if (bubble) bubble.textContent += chunk;
      document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
    }
  };

  App.endStreaming = function(fullMessage) {
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
  };

  // --- Add Chat Message ---
  App.addChatMessage = function(message) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `message ${message.role}`;
    div.id = `msg-${message.id}`;

    const nameLabel = message.role === 'assistant' ? 'Claude' : message.userName || 'User';
    const bubbleContent = message.role === 'assistant' ? renderMarkdown(message.content) : escHtml(message.content);

    let filesHtml = '';
    if (message.files && message.files.length > 0) {
      const chips = message.files.map(f => {
        if (f.isImage) return `<div class="msg-file"><img class="msg-file-thumb" src="data:${f.type};base64,${f.data}" alt="${escHtml(f.name)}"></div>`;
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
  };

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
      const before = val.substring(0, pos);
      const atIdx = before.lastIndexOf('@');

      if (atIdx >= 0 && (atIdx === 0 || before[atIdx - 1] === ' ')) {
        const query = before.substring(atIdx + 1).toLowerCase();
        const matches = state.artifacts.filter(a =>
          (a.title || '').toLowerCase().includes(query) || (a.type || '').toLowerCase().includes(query)
        ).slice(0, 5);

        if (matches.length > 0) {
          mentionActive = true;
          mentionStart = atIdx;
          showMentionDropdown(matches, input);
          return;
        }
      }
      App.closeMentionDropdown();
    });

    input.addEventListener('keydown', (e) => {
      if (!mentionActive) return;
      if (e.key === 'Escape') { App.closeMentionDropdown(); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === 'Tab') {
        const active = dropdown.querySelector('.mention-item.active') || dropdown.querySelector('.mention-item');
        if (active && mentionActive) { selectMention(active.dataset.artifactId, input); e.preventDefault(); }
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
        item.innerHTML = `<span class="mention-icon">${art.icon || '📄'}</span><span class="mention-title">${escHtml(art.title || 'Untitled')}</span><span class="mention-type">${escHtml(art.type)}</span>`;
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
      App.closeMentionDropdown();
      inputEl.focus();
    }
  })();

  App.closeMentionDropdown = function() {
    const dropdown = document.getElementById('mentionDropdown');
    if (dropdown) dropdown.classList.remove('visible');
  };
})();
