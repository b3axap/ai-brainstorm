// All socket.on event handlers
import { state, socket } from './state.js';
import { showScreen, showToast, escHtml } from './utils.js';
import { showLandingError } from './landing.js';
import { addChatMessage, appendStream, endStreaming, resetStreaming } from './chat.js';
import {
  renderArtifactCard, removeArtifactUpdating, updateUserLists,
  updateRoomCode, refreshExpandPopup, closeArtifactExpand, getExpandArtifactId
} from './canvas.js';
import { openVizPicker } from './viz-picker.js';

export function initSocketHandlers() {
  const engineDebounce = new Map();

  socket.on('connect_error', () => showToast('Connection error — retrying...'));

  socket.on('disconnect', (reason) => {
    state.generating = false;
    resetStreaming();
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

    // Render clarifying questions
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
              btn.classList.toggle('selected');
              if (typeof window._updateSendState === 'function') window._updateSendState();
            };
            optionsDiv.appendChild(btn);
          });
          qBlock.appendChild(optionsDiv);
          // Custom answer input below options
          const customInput = document.createElement('input');
          customInput.type = 'text';
          customInput.className = 'clarify-custom-input';
          customInput.placeholder = 'Свой вариант...';
          customInput.addEventListener('input', () => {
            if (typeof window._updateSendState === 'function') window._updateSendState();
          });
          qBlock.appendChild(customInput);
        } else {
          // Open question — inline input
          const inlineInput = document.createElement('input');
          inlineInput.type = 'text';
          inlineInput.className = 'clarify-inline-input';
          inlineInput.placeholder = 'Ваш ответ...';
          inlineInput.addEventListener('input', () => {
            if (typeof window._updateSendState === 'function') window._updateSendState();
          });
          qBlock.appendChild(inlineInput);
        }
        questionsDiv.appendChild(qBlock);
      });
      actionsDiv.appendChild(questionsDiv);
      hasContent = true;
      // Update send button state after questions render
      setTimeout(() => {
        if (typeof window._updateSendState === 'function') window._updateSendState();
      }, 0);
    }

    // Canvas offer
    if (offerCanvas && hasSuggestions) {
      const canvasOffer = document.createElement('div');
      canvasOffer.className = 'canvas-offer';

      const quickLabel = document.createElement('div');
      quickLabel.className = 'canvas-offer-label';
      quickLabel.textContent = '\u2728 Suggested visualizations:';
      canvasOffer.appendChild(quickLabel);

      const quickBtns = document.createElement('div');
      quickBtns.className = 'suggest-buttons';
      suggestedTypes.forEach(suggestion => {
        const typeId = suggestion.type || suggestion;
        const brief = suggestion.brief || '';
        const agent = state.agents.find(a => a.id === typeId);
        if (!agent) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'suggest-btn-wrapper';

        const btn = document.createElement('button');
        btn.className = 'suggest-btn' + (brief ? ' has-brief' : '');
        btn.dataset.agentType = typeId;
        btn.dataset.brief = brief;
        btn.innerHTML = `<span class="suggest-btn-main">${agent.icon} ${agent.name}</span>`
          + (brief ? `<span class="suggest-btn-brief">${escHtml(brief)}</span>` : '');
        wrapper.appendChild(btn);

        if (brief) {
          const editBtn = document.createElement('button');
          editBtn.className = 'suggest-edit-btn';
          editBtn.title = 'Edit before generating';
          editBtn.textContent = '\u270F\uFE0F';
          editBtn.onclick = (e) => {
            e.stopPropagation();
            const editArea = document.createElement('div');
            editArea.className = 'suggest-edit-inline';
            editArea.innerHTML = `
              <textarea class="suggest-edit-textarea" rows="2">${escHtml(brief)}</textarea>
              <div class="suggest-edit-actions">
                <button class="suggest-confirm-btn">${agent.icon} Generate</button>
                <button class="suggest-cancel-btn">Cancel</button>
              </div>
            `;
            wrapper.replaceWith(editArea);
            const textarea = editArea.querySelector('.suggest-edit-textarea');
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            editArea.querySelector('.suggest-confirm-btn').onclick = () => {
              const customPrompt = textarea.value.trim();
              editArea.innerHTML = `<div class="suggest-btn generating"><span class="auto-spinner"></span> ${agent.name}...</div>`;
              socket.emit('generate-artifact', {
                roomId: state.roomId, type: typeId,
                customPrompt: customPrompt || undefined
              });
              showToast(`Generating ${agent.name}...`);
            };
            editArea.querySelector('.suggest-cancel-btn').onclick = () => {
              editArea.replaceWith(wrapper);
            };
          };
          wrapper.appendChild(editBtn);
        }

        quickBtns.appendChild(wrapper);
      });
      quickBtns.onclick = (e) => {
        const btn = e.target.closest('.suggest-btn');
        if (!btn || btn.disabled) return;
        const typeId = btn.dataset.agentType;
        const brief = btn.dataset.brief || '';
        const agent = state.agents.find(a => a.id === typeId);
        if (!agent) return;
        btn.innerHTML = `<span class="auto-spinner"></span> ${agent.name}...`;
        btn.disabled = true;
        socket.emit('generate-artifact', {
          roomId: state.roomId, type: typeId,
          customPrompt: brief || undefined
        });
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

    // Canvas action
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

    // Show placeholder card for freeform (longer generation)
    if (type === 'freeform') {
      const existing = document.getElementById('generating-placeholder');
      if (!existing) {
        const idx = state.artifacts.length;
        const col = idx % 2, row = Math.floor(idx / 2);
        const pos = { x: 40 + col * (540 + 40), y: 40 + row * (360 + 40) };
        const placeholder = document.createElement('div');
        placeholder.className = 'artifact-card generating-placeholder';
        placeholder.id = 'generating-placeholder';
        placeholder.style.left = pos.x + 'px';
        placeholder.style.top = pos.y + 'px';
        placeholder.innerHTML = `
          <div class="artifact-head">
            <span class="a-icon">✨</span>
            <span class="a-title">Generating custom visualization...</span>
          </div>
          <div class="artifact-body" style="display:flex;align-items:center;justify-content:center;min-height:200px;">
            <div class="gen-placeholder-content">
              <div class="gen-placeholder-spinner"></div>
              <div class="gen-placeholder-text">Creating something amazing...</div>
            </div>
          </div>
        `;
        document.getElementById('canvasContent')?.appendChild(placeholder);
        if (window._canvasPanZoom) window._canvasPanZoom.panTo(pos.x - 40, pos.y - 40);
      }
    }
  });

  socket.on('artifact-created', ({ artifact }) => {
    document.getElementById('generating-placeholder')?.remove();
    state.artifacts.push(artifact);
    state.generating = false;
    const card = renderArtifactCard(artifact);
    showToast(`${artifact.icon || '📄'} ${artifact.title || 'Untitled'} created!`);

    if (window.innerWidth <= 768) {
      const tabCanvas = document.getElementById('mobileTabCanvas');
      if (tabCanvas) tabCanvas.click();
    }

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

    art.data = data;
    if (title) art.title = title;

    const body = document.getElementById(`abody-${artifactId}`);
    if (body && typeof renderArtifact === 'function') {
      try {
        renderArtifact(art.renderer || art.type, data, body);
      } catch (err) {
        console.error(`[artifact-updated] Render error:`, err);
        body.innerHTML = '<div style="padding:12px;color:#f87171;">Render error — try refreshing</div>';
      }
    }

    const card = document.getElementById(`artifact-${artifactId}`);
    if (card) {
      removeArtifactUpdating(card);
      if (title) {
        const titleEl = card.querySelector('.a-title');
        if (titleEl) titleEl.textContent = title;
      }
      if (window.InteractiveEngine) {
        // Debounce engine recreation for rapid updates
        if (engineDebounce.has(artifactId)) clearTimeout(engineDebounce.get(artifactId));
        engineDebounce.set(artifactId, setTimeout(() => {
          engineDebounce.delete(artifactId);
          const currentCard = document.getElementById(`artifact-${artifactId}`);
          if (currentCard) {
            const engine = new InteractiveEngine(currentCard, art, socket);
            engine.forwardUpdate(data);
          }
        }, 50));
      }
    }

    if (getExpandArtifactId() === artifactId) {
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

  socket.on('artifact-resized', ({ artifactId, size }) => {
    if (!size) return;
    const card = document.getElementById(`artifact-${artifactId}`);
    if (card) {
      card.style.width = size.w + 'px';
      card.style.height = size.h + 'px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
    }
    const art = state.artifacts.find(a => a.id === artifactId);
    if (art) art.size = size;
  });

  socket.on('artifact-deleted', ({ artifactId }) => {
    state.artifacts = state.artifacts.filter(a => a.id !== artifactId);
    const card = document.getElementById(`artifact-${artifactId}`);
    if (card) card.remove();
  });

  socket.on('generation-error', ({ message }) => {
    document.getElementById('generating-placeholder')?.remove();
    state.generating = false;
    showToast('Error: ' + message);
    document.getElementById('typingIndicator').classList.remove('visible');
    document.querySelectorAll('.artifact-updating').forEach(el => el.remove());
    document.querySelectorAll('.expand-loading').forEach(el => el.remove());
  });
}
