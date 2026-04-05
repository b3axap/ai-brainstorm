// Chat UI: messages, streaming, file attachment, new idea mode
import { state, socket } from './state.js';
import { escHtml, renderMarkdown, showToast } from './utils.js';
import { closeMentionDropdown } from './mentions.js';

// --- Streaming state ---
let streamingMsgId = null;
let streamingActive = false;

export function initChat() {
  document.getElementById('chatSendBtn').onclick = sendChatMessage;
  document.getElementById('chatInput').onkeypress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) sendChatMessage();
  };

  // File attachment
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
        state.pendingFiles.push({ name: file.name, type: file.type, size: file.size, data: base64, isImage });
        renderFilePreview();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // New idea button
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
}

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

export function addChatMessage(message) {
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

export function startStreaming() {
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

export function appendStream(chunk) {
  if (!streamingActive) startStreaming();
  const msgEl = streamingMsgId ? document.getElementById(`msg-${streamingMsgId}`) : null;
  if (msgEl) {
    const bubble = msgEl.querySelector('.msg-bubble');
    if (bubble) bubble.textContent += chunk;
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

export function endStreaming(fullMessage) {
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
