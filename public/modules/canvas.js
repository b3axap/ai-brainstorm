// Canvas: artifact cards, actions, drag, expand popup, pan/zoom, resize
import { state, socket } from './state.js';
import { escHtml, showToast, trapFocus } from './utils.js';

// Expand popup state
let expandState = { artifactId: null, engine: null, releaseFocusTrap: null };

export function initCanvas() {
  initResizeHandle();
  initMobileTabs();
  initCanvasPanZoom();
  initExpandPopup();
}

// --- Artifact Card Rendering ---
export function renderArtifactCard(artifact) {
  const card = document.createElement('div');
  card.className = 'artifact-card';
  card.id = `artifact-${artifact.id}`;
  card.tabIndex = 0;
  card.setAttribute('aria-label', `${artifact.icon || ''} ${artifact.title}`);
  card.style.left = artifact.position.x + 'px';
  card.style.top = artifact.position.y + 'px';
  if (artifact.size) {
    card.style.width = artifact.size.w + 'px';
    card.style.height = artifact.size.h + 'px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
  }

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
  if (typeof renderArtifact === 'function') {
    try {
      renderArtifact(artifact.renderer || artifact.type, artifact.data, body);
    } catch (err) {
      console.error('[renderArtifactCard] Render error:', err);
      body.innerHTML = '<div style="padding:12px;color:#f87171;">Render error</div>';
    }
  }

  // Resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'artifact-resize-handle';
  card.appendChild(resizeHandle);

  setupArtifactActions(card, artifact);
  setupDrag(card, artifact);
  setupResize(card, artifact);

  // Setup interactive engine
  if (window.InteractiveEngine) {
    new InteractiveEngine(card, artifact, socket);
  }

  return card;
}

// --- Artifact Actions ---
function setupArtifactActions(card, artifact) {
  card.querySelector('[data-action="open"]').onclick = (e) => {
    e.stopPropagation();
    openArtifactExpand(artifact.id);
  };

  card.querySelector('.artifact-head').addEventListener('dblclick', (e) => {
    e.stopPropagation();
    e.preventDefault();
    openArtifactExpand(artifact.id);
  });

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
    } else {
      captureArtifactPNG(card, artifact);
    }
  };

  card.querySelector('[data-action="delete"]').onclick = (e) => {
    e.stopPropagation();
    if (confirm(`Delete "${artifact.title}"?`)) {
      socket.emit('delete-artifact', { roomId: state.roomId, artifactId: artifact.id });
      state.artifacts = state.artifacts.filter(a => a.id !== artifact.id);
      card.remove();
      showToast('Artifact deleted');
    }
  };

  // Ask bar
  const askBar = document.getElementById(`askbar-${artifact.id}`);
  const askInput = askBar.querySelector('input');
  const askBtn = askBar.querySelector('button');
  askBtn.onclick = () => submitAskQuestion(artifact, askInput, askBar, card);
  askInput.onkeypress = (e) => {
    if (e.key === 'Enter') submitAskQuestion(artifact, askInput, askBar, card);
  };
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

  setTimeout(() => {
    document.addEventListener('click', function closeDropdown() {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }, { once: true });
  }, 0);
}

export function showArtifactUpdating(card) {
  const overlay = document.createElement('div');
  overlay.className = 'artifact-updating';
  overlay.innerHTML = '<div class="gen-spinner"></div>';
  card.style.position = 'absolute';
  card.appendChild(overlay);
}

export function removeArtifactUpdating(card) {
  const overlay = card.querySelector('.artifact-updating');
  if (overlay) overlay.remove();
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
  } catch (err) {
    showToast('Screenshot failed');
    console.error('Screenshot error:', err);
  }
}

// --- Drag ---
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
    if (e.target.closest('.artifact-actions')) return;
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

// --- Resize ---
function setupResize(card, artifact) {
  const handle = card.querySelector('.artifact-resize-handle');
  if (!handle) return;

  const MIN_W = 280, MAX_W = 1200, MIN_H = 180, MAX_H = 900;
  let startX, startY, origW, origH;

  function onMouseMove(e) {
    const scale = window._canvasPanZoom ? window._canvasPanZoom.getScale() : 1;
    const newW = Math.min(MAX_W, Math.max(MIN_W, origW + (e.clientX - startX) / scale));
    const newH = Math.min(MAX_H, Math.max(MIN_H, origH + (e.clientY - startY) / scale));
    card.style.width = newW + 'px';
    card.style.height = newH + 'px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
  }

  function onMouseUp() {
    card.classList.remove('resizing');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    const size = {
      w: parseInt(card.style.width) || origW,
      h: parseInt(card.style.height) || origH,
    };
    artifact.size = size;
    socket.emit('resize-artifact', { roomId: state.roomId, artifactId: artifact.id, size });
  }

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    card.classList.add('resizing');
    startX = e.clientX;
    startY = e.clientY;
    origW = card.offsetWidth;
    origH = card.offsetHeight;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

// --- Expand Popup ---
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

  if (typeof renderArtifact === 'function') {
    renderArtifact(art.renderer || art.type, art.data, content);
  }

  if (expandState.engine) expandState.engine.destroy();
  const bodyWrap = modal.querySelector('.expand-body');
  const fakeCard = _makeFakeCard(bodyWrap);
  if (window.InteractiveEngine) {
    expandState.engine = new InteractiveEngine(fakeCard, art, socket);
  }

  modal.classList.add('active');
  expandState.releaseFocusTrap = trapFocus(modal);
  setupExpandToolbar(art);
  setupExpandAskBar(art);
}

export function closeArtifactExpand() {
  const modal = document.getElementById('artifactExpandModal');
  modal.classList.remove('active');
  if (expandState.releaseFocusTrap) { expandState.releaseFocusTrap(); expandState.releaseFocusTrap = null; }
  if (expandState.engine) {
    expandState.engine.destroy();
    expandState.engine = null;
  }
  expandState.artifactId = null;
  const dd = modal.querySelector('.expand-transform-dropdown');
  if (dd) dd.remove();
}

let _expandRefreshTimer = null;

export function refreshExpandPopup() {
  if (!expandState.artifactId) return;
  if (_expandRefreshTimer) clearTimeout(_expandRefreshTimer);
  _expandRefreshTimer = setTimeout(() => {
    _expandRefreshTimer = null;
    _doRefreshExpandPopup();
  }, 50);
}

function _makeFakeCard(bodyWrap) {
  return {
    querySelector: (sel) => sel === '.artifact-body' ? bodyWrap : null,
    querySelectorAll: () => [],
    closest: () => null
  };
}

function _doRefreshExpandPopup() {
  if (!expandState.artifactId) return;
  const art = state.artifacts.find(a => a.id === expandState.artifactId);
  if (!art) { closeArtifactExpand(); return; }

  const modal = document.getElementById('artifactExpandModal');
  const content = modal.querySelector('.expand-content');

  modal.querySelector('.expand-title').textContent = art.title || 'Untitled';

  if (typeof renderArtifact === 'function') {
    try {
      renderArtifact(art.renderer || art.type, art.data, content);
    } catch (err) {
      console.error('[refreshExpand] Render error:', err);
      content.innerHTML = '<div style="padding:20px;color:#f87171;">Render error</div>';
    }
  }

  if (expandState.engine) expandState.engine.destroy();
  const bodyWrap = modal.querySelector('.expand-body');
  const fakeCard = _makeFakeCard(bodyWrap);
  if (window.InteractiveEngine) {
    expandState.engine = new InteractiveEngine(fakeCard, art, socket);
    expandState.engine.forwardUpdate(art.data);
  }

  const loading = modal.querySelector('.expand-loading');
  if (loading) loading.remove();
}

export function getExpandArtifactId() {
  return expandState.artifactId;
}

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

function initExpandPopup() {
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
}

// --- Resize Handle ---
function initResizeHandle() {
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
}

// --- Mobile Tabs ---
function initMobileTabs() {
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
}

// --- Canvas Pan & Zoom (Miro-like) ---
function initCanvasPanZoom() {
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
    const rect = panel.getBoundingClientRect();
    const px = (cx !== undefined ? cx : rect.width / 2) - rect.left;
    const py = (cy !== undefined ? cy : rect.height / 2) - rect.top;
    panX = px - (px - panX) * (clamped / scale);
    panY = py - (py - panY) * (clamped / scale);
    scale = clamped;
    applyTransform();
  }

  panel.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoomTo(scale * delta, e.clientX, e.clientY);
    } else {
      panX -= e.deltaX;
      panY -= e.deltaY;
      applyTransform();
    }
  }, { passive: false });

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
  panel.addEventListener('pointerup', () => {
    if (isPanning) {
      isPanning = false;
      panel.classList.remove('panning');
      panel.style.cursor = spaceDown ? 'grab' : '';
    }
  });

  panel.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });

  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  if (zoomIn) zoomIn.onclick = () => zoomTo(scale * 1.2);
  if (zoomOut) zoomOut.onclick = () => zoomTo(scale / 1.2);
  if (zoomLevel) zoomLevel.onclick = () => { scale = 1; panX = 0; panY = 0; applyTransform(); };

  window._canvasPanZoom = { zoomTo, applyTransform, getScale: () => scale, panTo(x, y) { panX = -x; panY = -y; applyTransform(); } };
}

// --- UI Helpers ---
export function updateUserLists() {
  const names = state.users.map(u => u.name).join(', ');
  const el = document.getElementById('usersList');
  if (el) el.textContent = names;
}

export function updateRoomCode() {
  const el = document.getElementById('roomCode');
  if (el) el.textContent = state.roomId;
  document.querySelectorAll('.room-code').forEach(el => {
    el.onclick = () => {
      navigator.clipboard.writeText(state.roomId).then(() => showToast('Room code copied!'));
    };
  });
}
