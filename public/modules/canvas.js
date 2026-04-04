// canvas.js — Artifact rendering, actions, drag, expand popup

(function() {
  const { socket, state, escHtml, showToast } = App;

  // --- Resize Handle ---
  (function() {
    const handle = document.getElementById('resizeHandle');
    const body = document.getElementById('workspaceBody');
    if (!handle || !body) return;
    let dragging = false;

    handle.onmousedown = (e) => { dragging = true; handle.classList.add('active'); e.preventDefault(); };
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = body.getBoundingClientRect();
      const chatWidth = Math.max(280, Math.min(e.clientX - rect.left, rect.width * 0.5));
      body.style.gridTemplateColumns = `${chatWidth}px 4px 1fr`;
    });
    document.addEventListener('mouseup', () => { if (dragging) { dragging = false; handle.classList.remove('active'); } });
  })();

  // --- Mobile Tabs ---
  (function() {
    const tabChat = document.getElementById('mobileTabChat');
    const tabCanvas = document.getElementById('mobileTabCanvas');
    const body = document.getElementById('workspaceBody');
    if (!tabChat || !tabCanvas || !body) return;

    tabChat.onclick = () => { body.classList.remove('show-canvas'); tabChat.classList.add('active'); tabCanvas.classList.remove('active'); };
    tabCanvas.onclick = () => { body.classList.add('show-canvas'); tabCanvas.classList.add('active'); tabChat.classList.remove('active'); };
  })();

  // --- Render Artifact Card ---
  App.renderArtifactCard = function(artifact) {
    const card = document.createElement('div');
    card.className = 'artifact-card';
    card.id = `artifact-${artifact.id}`;
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

    card.addEventListener('mousedown', () => {
      document.querySelectorAll('.artifact-card').forEach(c => {
        if (c !== card) c.style.zIndex = Math.min(parseInt(c.style.zIndex) || 1, 10);
      });
      card.style.zIndex = 50;
    });

    const emptyEl = document.getElementById('canvasEmpty');
    if (emptyEl) emptyEl.style.display = 'none';

    const body = document.getElementById(`abody-${artifact.id}`);
    renderArtifact(artifact.renderer || artifact.type, artifact.data, body);

    setupArtifactActions(card, artifact);
    setupDrag(card, artifact);

    if (window.InteractiveEngine) new InteractiveEngine(card, artifact, socket);

    return card;
  };

  // --- Actions ---
  function setupArtifactActions(card, artifact) {
    card.querySelector('[data-action="open"]').onclick = (e) => { e.stopPropagation(); openArtifactExpand(artifact.id); };
    card.querySelector('.artifact-head').addEventListener('dblclick', (e) => { e.stopPropagation(); e.preventDefault(); openArtifactExpand(artifact.id); });
    card.querySelector('[data-action="expand"]').onclick = (e) => {
      e.stopPropagation(); showArtifactUpdating(card);
      socket.emit('artifact-action', { roomId: state.roomId, artifactId: artifact.id, action: 'expand' });
    };
    card.querySelector('[data-action="transform"]').onclick = (e) => { e.stopPropagation(); showTransformDropdown(card, artifact); };
    card.querySelector('[data-action="ask"]').onclick = (e) => {
      e.stopPropagation();
      const askBar = document.getElementById(`askbar-${artifact.id}`);
      askBar.classList.toggle('visible');
      if (askBar.classList.contains('visible')) askBar.querySelector('input').focus();
    };
    card.querySelector('[data-action="copy"]').onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(JSON.stringify(artifact.data, null, 2)).then(() => showToast('Copied to clipboard!'));
    };
    card.querySelector('[data-action="screenshot"]').onclick = async (e) => {
      e.stopPropagation();
      if (typeof html2canvas === 'undefined') {
        showToast('Loading screenshot tool...');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        script.onload = () => captureArtifactPNG(card, artifact);
        document.head.appendChild(script);
      } else { captureArtifactPNG(card, artifact); }
    };

    const askBar = document.getElementById(`askbar-${artifact.id}`);
    const askInput = askBar.querySelector('input');
    const askBtn = askBar.querySelector('button');
    askBtn.onclick = () => submitAskQuestion(artifact, askInput, askBar, card);
    askInput.onkeypress = (e) => { if (e.key === 'Enter') submitAskQuestion(artifact, askInput, askBar, card); };
  }

  async function captureArtifactPNG(card, artifact) {
    try {
      const actions = card.querySelector('.artifact-actions');
      if (actions) actions.style.display = 'none';
      const canvas = await html2canvas(card, { backgroundColor: '#1a1d27', scale: 2 });
      if (actions) actions.style.display = '';
      const link = document.createElement('a');
      link.download = `${(artifact.title || 'artifact').replace(/[^a-z0-9]/gi, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('PNG saved!');
    } catch (err) { showToast('Screenshot failed'); console.error('Screenshot error:', err); }
  }

  function submitAskQuestion(artifact, askInput, askBar, card) {
    const question = askInput.value.trim();
    if (!question) return;
    askInput.value = '';
    askBar.classList.remove('visible');
    showArtifactUpdating(card);
    socket.emit('artifact-action', { roomId: state.roomId, artifactId: artifact.id, action: 'ask', payload: { question } });
  }

  function showTransformDropdown(card, artifact) {
    const existing = card.querySelector('.transform-dropdown');
    if (existing) { existing.remove(); return; }
    const dropdown = document.createElement('div');
    dropdown.className = 'transform-dropdown visible';
    state.agents.forEach(agent => {
      if (agent.id === artifact.type) return;
      const opt = document.createElement('div');
      opt.className = 'transform-option';
      opt.innerHTML = `${agent.icon} ${escHtml(agent.name)}`;
      opt.onclick = (e) => {
        e.stopPropagation(); dropdown.remove();
        socket.emit('artifact-action', { roomId: state.roomId, artifactId: artifact.id, action: 'transform', payload: { targetType: agent.id } });
        showToast(`Transforming to ${agent.name}...`);
      };
      dropdown.appendChild(opt);
    });
    card.querySelector('.artifact-actions').appendChild(dropdown);
    setTimeout(() => {
      document.addEventListener('click', function close() { dropdown.remove(); document.removeEventListener('click', close); }, { once: true });
    }, 0);
  }

  App.showArtifactUpdating = function(card) {
    const overlay = document.createElement('div');
    overlay.className = 'artifact-updating';
    overlay.innerHTML = '<div class="gen-spinner"></div>';
    card.style.position = 'absolute';
    card.appendChild(overlay);
  };
  function showArtifactUpdating(card) { App.showArtifactUpdating(card); }

  App.removeArtifactUpdating = function(card) {
    const overlay = card.querySelector('.artifact-updating');
    if (overlay) overlay.remove();
  };

  function setupDrag(card, artifact) {
    const head = card.querySelector('.artifact-head');
    let startX, startY, origLeft, origTop;
    function onMouseMove(e) { card.style.left = (origLeft + e.clientX - startX) + 'px'; card.style.top = (origTop + e.clientY - startY) + 'px'; }
    function onMouseUp() {
      card.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      socket.emit('move-artifact', { roomId: state.roomId, artifactId: artifact.id, position: { x: parseInt(card.style.left) || 0, y: parseInt(card.style.top) || 0 } });
    }
    head.onmousedown = (e) => {
      if (e.target.closest('.artifact-actions')) return;
      card.classList.add('dragging');
      startX = e.clientX; startY = e.clientY;
      origLeft = parseInt(card.style.left) || 0; origTop = parseInt(card.style.top) || 0;
      e.preventDefault();
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  }

  // --- Expand Popup ---
  let expandState = { artifactId: null, engine: null };

  function openArtifactExpand(artifactId) {
    const art = state.artifacts.find(a => a.id === artifactId);
    if (!art) return;
    expandState.artifactId = artifactId;

    const modal = document.getElementById('artifactExpandModal');
    const content = modal.querySelector('.expand-content');
    const header = modal.querySelector('.expand-header');

    header.querySelector('.expand-icon').textContent = art.icon || '📄';
    header.querySelector('.expand-title').textContent = art.title || 'Untitled';
    header.querySelector('.expand-type-badge').textContent = art.renderer || art.type;

    renderArtifact(art.renderer || art.type, art.data, content);

    if (expandState.engine) expandState.engine.destroy();
    const bodyWrap = modal.querySelector('.expand-body');
    const fakeCard = { querySelector: (sel) => sel === '.artifact-body' ? bodyWrap : null };
    if (window.InteractiveEngine) expandState.engine = new InteractiveEngine(fakeCard, art, socket);

    modal.classList.add('active');
    setupExpandToolbar(art);
    setupExpandAskBar(art);
  }

  function closeArtifactExpand() {
    const modal = document.getElementById('artifactExpandModal');
    modal.classList.remove('active');
    if (expandState.engine) { expandState.engine.destroy(); expandState.engine = null; }
    expandState.artifactId = null;
    const dd = modal.querySelector('.expand-transform-dropdown');
    if (dd) dd.remove();
  }

  App.refreshExpandPopup = function() {
    if (!expandState.artifactId) return;
    const art = state.artifacts.find(a => a.id === expandState.artifactId);
    if (!art) { closeArtifactExpand(); return; }

    const modal = document.getElementById('artifactExpandModal');
    const content = modal.querySelector('.expand-content');
    modal.querySelector('.expand-title').textContent = art.title || 'Untitled';
    renderArtifact(art.renderer || art.type, art.data, content);

    if (expandState.engine) expandState.engine.destroy();
    const bodyWrap = modal.querySelector('.expand-body');
    const fakeCard = { querySelector: (sel) => sel === '.artifact-body' ? bodyWrap : null };
    if (window.InteractiveEngine) {
      expandState.engine = new InteractiveEngine(fakeCard, art, socket);
      expandState.engine.forwardUpdate(art.data);
    }
    const loading = modal.querySelector('.expand-loading');
    if (loading) loading.remove();
  };

  function setupExpandToolbar(artifact) {
    const modal = document.getElementById('artifactExpandModal');

    modal.querySelector('[data-expand-action="ai-expand"]').onclick = () => {
      showExpandLoading();
      socket.emit('artifact-action', { roomId: state.roomId, artifactId: artifact.id, action: 'expand' });
    };

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
          dropdown.remove(); closeArtifactExpand();
          socket.emit('artifact-action', { roomId: state.roomId, artifactId: artifact.id, action: 'transform', payload: { targetType: agent.id } });
          showToast(`Transforming to ${agent.name}...`);
        };
        dropdown.appendChild(opt);
      });
      transformBtn.style.position = 'relative';
      transformBtn.appendChild(dropdown);
      setTimeout(() => { document.addEventListener('click', function close() { dropdown.remove(); document.removeEventListener('click', close); }, { once: true }); }, 0);
    };

    modal.querySelector('[data-expand-action="copy"]').onclick = () => {
      const art = state.artifacts.find(a => a.id === expandState.artifactId);
      if (art) navigator.clipboard.writeText(JSON.stringify(art.data, null, 2)).then(() => showToast('Copied to clipboard!'));
    };

    modal.querySelector('[data-expand-action="png"]').onclick = async () => {
      const art = state.artifacts.find(a => a.id === expandState.artifactId);
      if (!art) return;
      const content = modal.querySelector('.expand-content');
      try {
        if (typeof html2canvas === 'undefined') {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
          await new Promise((res, rej) => { script.onload = res; script.onerror = rej; document.head.appendChild(script); });
        }
        const canvas = await html2canvas(content, { backgroundColor: '#1a1d27', scale: 2 });
        const link = document.createElement('a');
        link.download = `${(art.title || 'artifact').replace(/[^a-z0-9]/gi, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('PNG saved!');
      } catch (err) { showToast('Screenshot failed'); }
    };

    modal.querySelector('[data-expand-action="delete"]').onclick = () => {
      const art = state.artifacts.find(a => a.id === expandState.artifactId);
      if (!art) return;
      if (confirm(`Delete "${art.title}"?`)) {
        closeArtifactExpand();
        socket.emit('delete-artifact', { roomId: state.roomId, artifactId: art.id });
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
      socket.emit('artifact-action', { roomId: state.roomId, artifactId: artifact.id, action: 'ask', payload: { question } });
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
    if (e.key === 'Escape' && document.getElementById('artifactExpandModal').classList.contains('active')) closeArtifactExpand();
  });

  // --- UI Helpers ---
  App.updateUserLists = function() {
    const names = state.users.map(u => u.name).join(', ');
    const el = document.getElementById('usersList');
    if (el) el.textContent = names;
  };

  App.updateRoomCode = function() {
    const el = document.getElementById('roomCode');
    if (el) el.textContent = state.roomId;
  };

  document.querySelectorAll('.room-code').forEach(el => {
    el.onclick = () => navigator.clipboard.writeText(state.roomId).then(() => showToast('Room code copied!'));
  });
})();
