// Chat UI: messages, streaming, file attachment, new idea mode
import { state, socket } from './state.js';
import { escHtml, renderMarkdown, showToast } from './utils.js';
import { closeMentionDropdown } from './mentions.js';

// --- Streaming state ---
let streamingMsgId = null;
let streamingActive = false;

export function updateSendState() {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const hasText = input.value.trim().length > 0;
  const hasFiles = state.pendingFiles.length > 0;

  // Check if last clarify section has any interaction
  const allSections = document.querySelectorAll('.clarify-section');
  let lastSectionAnswered = false;
  if (allSections.length > 0) {
    const lastSection = allSections[allSections.length - 1];
    const blocks = lastSection.querySelectorAll('.clarify-block');
    if (blocks.length > 0) {
      const lastBlock = blocks[blocks.length - 1];
      const hasSelected = lastBlock.querySelector('.clarify-option-btn.selected');
      const inlineInput = lastBlock.querySelector('.clarify-inline-input');
      const hasInlineText = inlineInput && inlineInput.value.trim().length > 0;
      const customInput = lastBlock.querySelector('.clarify-custom-input');
      const hasCustomText = customInput && customInput.value.trim().length > 0;
      lastSectionAnswered = !!(hasSelected || hasInlineText || hasCustomText);
    }
  }

  sendBtn.disabled = !(hasText || hasFiles || lastSectionAnswered);
}

export function initChat() {
  const sendBtn = document.getElementById('chatSendBtn');
  sendBtn.onclick = sendChatMessage;
  sendBtn.disabled = true;

  const chatInput = document.getElementById('chatInput');
  chatInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    updateSendState();
  });

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

function collectClarifyAnswers() {
  const sections = document.querySelectorAll('.clarify-section');
  if (!sections.length) return '';
  const answers = [];
  sections.forEach(section => {
    section.querySelectorAll('.clarify-block').forEach(block => {
      const qEl = block.querySelector('.clarify-question');
      const question = qEl ? qEl.textContent.replace(/^\?\s*/, '') : '';

      // Collect selected options
      const selected = Array.from(block.querySelectorAll('.clarify-option-btn.selected'))
        .map(b => b.textContent).join(', ');

      // Collect custom input
      const customInput = block.querySelector('.clarify-custom-input');
      const custom = customInput ? customInput.value.trim() : '';

      // Collect inline input (open questions)
      const inlineInput = block.querySelector('.clarify-inline-input');
      const inline = inlineInput ? inlineInput.value.trim() : '';

      const answer = [selected, custom, inline].filter(Boolean).join(', ');
      if (answer) answers.push(`${question}: ${answer}`);
    });
  });
  return answers.join('\n');
}

function clearClarifyUI() {
  document.querySelectorAll('.clarify-section').forEach(s => {
    s.querySelectorAll('.clarify-option-btn.selected').forEach(b => b.classList.remove('selected'));
    s.querySelectorAll('.clarify-inline-input, .clarify-custom-input').forEach(i => { i.value = ''; });
  });
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const userText = input.value.trim();
  const clarifyText = collectClarifyAnswers();
  const content = [clarifyText, userText].filter(Boolean).join('\n\n');
  const hasFiles = state.pendingFiles.length > 0;
  if ((!content && !hasFiles) || state.generating) return;
  input.value = '';
  input.style.height = 'auto';
  clearClarifyUI();
  updateSendState();
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
        return `<div class="msg-file"><img class="msg-file-thumb" src="data:${escHtml(f.type)};base64,${escHtml(f.data)}" alt="${escHtml(f.name)}"></div>`;
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
  if (!streamingMsgId) return;
  const msgEl = document.getElementById(`msg-${streamingMsgId}`);
  if (!msgEl) {
    // DOM element gone (e.g., screen changed) — reset state
    streamingMsgId = null;
    streamingActive = false;
    return;
  }
  const bubble = msgEl.querySelector('.msg-bubble');
  if (bubble) bubble.textContent += chunk;
  const chatMessages = document.getElementById('chatMessages');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

export function resetStreaming() {
  if (streamingMsgId) {
    const msgEl = document.getElementById(`msg-${streamingMsgId}`);
    if (msgEl) {
      const bubble = msgEl.querySelector('.msg-bubble');
      if (bubble && bubble.textContent.trim()) {
        bubble.innerHTML += '<span class="stream-interrupted"> (interrupted)</span>';
      }
    }
  }
  streamingMsgId = null;
  streamingActive = false;
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
      chip.innerHTML = `<img class="file-chip-thumb" src="data:${escHtml(file.type)};base64,${escHtml(file.data)}" alt="">`;
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
