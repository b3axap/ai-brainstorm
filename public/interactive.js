// interactive.js — InteractiveEngine: universal interactivity via data-attributes
// Renderers declare WHAT is interactive, engine handles HOW

class InteractiveEngine {
  constructor(card, artifact, socket) {
    this.card = card;
    this.artifact = artifact;
    this.socket = socket;
    this.roomId = (typeof state !== 'undefined' && state.roomId) ? state.roomId : null;
    this.body = card.querySelector('.artifact-body');
    if (!this.body) return;

    // Clean up previous engine instance
    if (this.body._bsEngine) {
      this.body._bsEngine.destroy();
    }
    this.body._bsEngine = this;

    this._listeners = [];
    this.scan();
  }

  // --- Core: emit patch to server ---
  emitPatch(path, value) {
    if (!this.roomId) return;
    this.socket.emit('artifact-data-patch', {
      roomId: this.roomId,
      artifactId: this.artifact.id,
      patch: { path, value }
    });
  }

  // --- Core: emit array operation to server ---
  emitArrayOp(type, path, value, toPath) {
    if (!this.roomId) return;
    this.socket.emit('artifact-array-op', {
      roomId: this.roomId,
      artifactId: this.artifact.id,
      op: { type, path, value, toPath }
    });
  }

  // --- Resolve a dot-path on artifact data ---
  getByPath(path) {
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let obj = this.artifact.data;
    for (const p of parts) {
      if (obj == null) return undefined;
      obj = obj[p];
    }
    return obj;
  }

  // --- Scan container for data-attributes and attach handlers ---
  scan() {
    this.attachEditHandlers();
    this.attachMultilineEditHandlers();
    this.attachToggleHandlers();
    this.attachCycleHandlers();
    this.attachAddHandlers();
    this.attachDeleteHandlers();
    this.attachDragHandlers();
    this.attachIframeHandlers();
    this.attachCustomEvents();
  }

  // --- INLINE EDIT: data-edit="path" ---
  attachEditHandlers() {
    const els = this.body.querySelectorAll('[data-edit]');
    els.forEach(el => {
      const handler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (el.querySelector('.bs-input') || el.closest('.bs-editing')) return;
        this.startInlineEdit(el, el.dataset.edit, false);
      };
      el.addEventListener('dblclick', handler);
      this._listeners.push([el, 'dblclick', handler]);
      el.style.cursor = 'text';
      el.title = 'Double-click to edit';
    });
  }

  // --- MULTILINE EDIT: data-edit-multiline="path" ---
  attachMultilineEditHandlers() {
    const els = this.body.querySelectorAll('[data-edit-multiline]');
    els.forEach(el => {
      const handler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (el.querySelector('.bs-input') || el.closest('.bs-editing')) return;
        this.startInlineEdit(el, el.dataset.editMultiline, true);
      };
      el.addEventListener('dblclick', handler);
      this._listeners.push([el, 'dblclick', handler]);
      el.style.cursor = 'text';
      el.title = 'Double-click to edit';
    });
  }

  startInlineEdit(el, path, multiline) {
    // Detect SVG context
    if (el instanceof SVGElement || el.closest('svg')) {
      this.startSvgEdit(el, path);
      return;
    }

    el.classList.add('bs-editing');
    const currentVal = this.getByPath(path);
    const displayVal = currentVal != null ? String(currentVal) : el.textContent;

    const input = multiline
      ? document.createElement('textarea')
      : document.createElement('input');
    input.className = 'bs-input';
    input.value = displayVal;
    if (multiline) {
      input.rows = Math.max(3, displayVal.split('\n').length + 1);
    }

    // Save original content
    const originalHTML = el.innerHTML;
    el.innerHTML = '';
    el.appendChild(input);
    input.focus();
    input.select();

    const finish = (save) => {
      if (input._finished) return;
      input._finished = true;
      const newVal = input.value.trim();
      el.classList.remove('bs-editing');

      if (save && newVal && newVal !== displayVal) {
        // Check if value should be numeric
        const numVal = Number(newVal);
        const isNumericPath = typeof currentVal === 'number';
        this.emitPatch(path, isNumericPath && !isNaN(numVal) ? numVal : newVal);
      } else {
        el.innerHTML = originalHTML;
      }
    };

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !multiline) { ev.preventDefault(); finish(true); }
      if (ev.key === 'Enter' && multiline && ev.ctrlKey) { ev.preventDefault(); finish(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    });
  }

  startSvgEdit(el, path) {
    const svg = el.closest('svg');
    if (!svg) return;

    const currentVal = this.getByPath(path);
    const displayVal = currentVal != null ? String(currentVal) : el.textContent;
    const bbox = el.getBBox();

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', bbox.x - 4);
    fo.setAttribute('y', bbox.y - 2);
    fo.setAttribute('width', Math.max(bbox.width + 30, 80));
    fo.setAttribute('height', bbox.height + 8);

    const input = document.createElement('input');
    input.className = 'bs-input bs-svg-input';
    input.value = displayVal;
    fo.appendChild(input);
    svg.appendChild(fo);
    input.focus();
    input.select();

    const finish = (save) => {
      if (input._finished) return;
      input._finished = true;
      fo.remove();
      const newVal = input.value.trim();
      if (save && newVal && newVal !== displayVal) {
        this.emitPatch(path, newVal);
      }
    };

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    });
  }

  // --- TOGGLE: data-toggle="path" ---
  attachToggleHandlers() {
    const els = this.body.querySelectorAll('[data-toggle]');
    els.forEach(el => {
      el.classList.add('bs-interactive');
      el.style.cursor = 'pointer';
      const handler = (e) => {
        e.stopPropagation();
        const path = el.dataset.toggle;
        const current = this.getByPath(path);
        this.emitPatch(path, !current);
      };
      el.addEventListener('click', handler);
      this._listeners.push([el, 'click', handler]);
    });
  }

  // --- CYCLE: data-cycle="path" data-cycle-values='["a","b","c"]' ---
  attachCycleHandlers() {
    const els = this.body.querySelectorAll('[data-cycle]');
    els.forEach(el => {
      el.classList.add('bs-interactive');
      el.style.cursor = 'pointer';
      const handler = (e) => {
        e.stopPropagation();
        const path = el.dataset.cycle;
        let values;
        try { values = JSON.parse(el.dataset.cycleValues); } catch { return; }
        if (!Array.isArray(values) || !values.length) return;
        const current = this.getByPath(path);
        const idx = values.indexOf(current);
        const next = values[(idx + 1) % values.length];
        this.emitPatch(path, next);
      };
      el.addEventListener('click', handler);
      this._listeners.push([el, 'click', handler]);
    });
  }

  // --- ADD: data-add="arrayPath" data-add-template='json' ---
  attachAddHandlers() {
    const els = this.body.querySelectorAll('[data-add]');
    els.forEach(el => {
      const doAdd = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const arrayPath = el.dataset.add;
        let template = '';
        try {
          template = el.dataset.addTemplate ? JSON.parse(el.dataset.addTemplate) : '';
        } catch {
          template = '';
        }
        this.emitArrayOp('insert', arrayPath, template);
      };

      // If it's a bs-add-zone, the whole element is the click target
      if (el.classList.contains('bs-add-zone') || el.classList.contains('bs-svg-add')) {
        el.addEventListener('click', doAdd);
        this._listeners.push([el, 'click', doAdd]);
      } else {
        // For other elements, append a small "+" button
        if (el.querySelector('.bs-add-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'bs-add-btn';
        btn.textContent = '+';
        btn.title = 'Add item';
        btn.addEventListener('click', doAdd);
        el.style.position = 'relative';
        el.appendChild(btn);
      }
    });
  }

  // --- DELETE: data-delete="path" ---
  attachDeleteHandlers() {
    const els = this.body.querySelectorAll('[data-delete]');
    els.forEach(el => {
      // Skip SVG elements — can't append HTML buttons to SVG <g>
      if (el instanceof SVGElement) return;

      if (el.querySelector('.bs-delete-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'bs-delete-btn';
      btn.textContent = '\u00d7';
      btn.title = 'Remove';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const path = el.dataset.delete;
        this.emitArrayOp('remove', path);
      });
      el.style.position = 'relative';
      el.appendChild(btn);
    });
  }

  // --- DRAG: data-drag-item="path" + data-drag-target="arrayPath" ---
  attachDragHandlers() {
    const items = this.body.querySelectorAll('[data-drag-item]');
    const targets = this.body.querySelectorAll('[data-drag-target]');

    items.forEach(el => {
      el.draggable = true;
      el.classList.add('bs-draggable');

      const dragStart = (e) => {
        el.classList.add('bs-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', el.dataset.dragItem);
      };
      const dragEnd = () => el.classList.remove('bs-dragging');

      el.addEventListener('dragstart', dragStart);
      el.addEventListener('dragend', dragEnd);
      this._listeners.push([el, 'dragstart', dragStart]);
      this._listeners.push([el, 'dragend', dragEnd]);
    });

    targets.forEach(container => {
      const dragOver = (e) => {
        e.preventDefault();
        container.classList.add('bs-drag-over');
      };
      const dragLeave = () => container.classList.remove('bs-drag-over');
      const drop = (e) => {
        e.preventDefault();
        container.classList.remove('bs-drag-over');
        const fromPath = e.dataTransfer.getData('text/plain');
        const toPath = container.dataset.dragTarget;
        if (fromPath && toPath) {
          this.emitArrayOp('move', fromPath, null, toPath);
        }
      };

      container.addEventListener('dragover', dragOver);
      container.addEventListener('dragleave', dragLeave);
      container.addEventListener('drop', drop);
      this._listeners.push([container, 'dragover', dragOver]);
      this._listeners.push([container, 'dragleave', dragLeave]);
      this._listeners.push([container, 'drop', drop]);
    });
  }

  // --- IFRAME: listen for postMessage from freeform/html_guide iframes ---
  attachIframeHandlers() {
    const type = this.artifact.renderer || this.artifact.type;
    if (type !== 'freeform' && type !== 'html_guide') return;

    const iframe = this.body.querySelector('iframe');
    if (!iframe) return;

    const handler = (e) => {
      // Verify message comes from our iframe
      if (e.source !== iframe.contentWindow) return;
      const msg = e.data;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'bs-patch':
          if (msg.path != null && msg.value !== undefined) {
            this.emitPatch(msg.path, msg.value);
          }
          break;
        case 'bs-array-op':
          if (msg.op) {
            this.emitArrayOp(msg.op.type, msg.op.path, msg.op.value, msg.op.toPath);
          }
          break;
        case 'bs-get-data':
          iframe.contentWindow.postMessage({
            type: 'bs-data-response',
            data: this.artifact.data
          }, '*');
          break;
      }
    };

    window.addEventListener('message', handler);
    this._listeners.push([window, 'message', handler]);

    // Forward updates to iframe
    this._iframeForward = (data) => {
      try {
        iframe.contentWindow.postMessage({ type: 'bs-data-update', data }, '*');
      } catch {}
    };
  }

  // --- Custom events from renderers (e.g. presentation add-slide) ---
  attachCustomEvents() {
    const handler = (e) => {
      if (e.type === 'bs-add-slide') {
        this.emitArrayOp('insert', 'slides', { title: 'New Slide', bullets: ['Point 1'] });
      }
    };
    this.body.addEventListener('bs-add-slide', handler);
    this._listeners.push([this.body, 'bs-add-slide', handler]);
  }

  // Forward data update to iframe if applicable
  forwardUpdate(data) {
    if (this._iframeForward) this._iframeForward(data);
  }

  // --- Cleanup ---
  destroy() {
    this._listeners.forEach(([el, evt, fn]) => {
      el.removeEventListener(evt, fn);
    });
    this._listeners = [];
    if (this.body) this.body._bsEngine = null;
  }
}

// Backward compatibility alias
window.InteractiveLayer = InteractiveEngine;
window.InteractiveEngine = InteractiveEngine;
