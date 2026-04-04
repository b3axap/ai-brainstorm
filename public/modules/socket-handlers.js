// socket-handlers.js — All socket event listeners

(function() {
  const { socket, state, showScreen, showToast, escHtml,
    addChatMessage, appendStream, endStreaming,
    renderArtifactCard, removeArtifactUpdating, refreshExpandPopup,
    openVizPicker, updateRoomCode, updateUserLists } = App;

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

  socket.on('join-error', ({ message }) => {
    const el = document.getElementById('landingError');
    if (el) { el.textContent = message; el.style.display = 'block'; }
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

    // Clarifying questions with answer options
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

    // Canvas offer with quick buttons + picker
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

    // Canvas action button
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
      actionBtn.innerHTML = `${label} \u2192`;
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

  socket.on('artifact-generating', ({ type }) => { state.generating = true; });

  socket.on('artifact-created', ({ artifact }) => {
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
    art.data = data;
    if (title) art.title = title;

    const body = document.getElementById(`abody-${artifactId}`);
    if (body) renderArtifact(art.renderer || art.type, data, body);

    const card = document.getElementById(`artifact-${artifactId}`);
    if (card) {
      removeArtifactUpdating(card);
      if (title) { const titleEl = card.querySelector('.a-title'); if (titleEl) titleEl.textContent = title; }
      if (window.InteractiveEngine) {
        const engine = new InteractiveEngine(card, art, socket);
        engine.forwardUpdate(data);
      }
    }

    refreshExpandPopup();
    showToast(`${art.icon || '📄'} ${art.title} updated!`);
  });

  socket.on('artifact-moved', ({ artifactId, position }) => {
    if (!position) return;
    const card = document.getElementById(`artifact-${artifactId}`);
    if (card) { card.style.left = position.x + 'px'; card.style.top = position.y + 'px'; }
    const art = state.artifacts.find(a => a.id === artifactId);
    if (art) art.position = position;
  });

  socket.on('generation-error', ({ message }) => {
    state.generating = false;
    showToast('Error: ' + message);
    document.getElementById('typingIndicator').classList.remove('visible');
    document.querySelectorAll('.artifact-updating').forEach(el => el.remove());
  });
})();
