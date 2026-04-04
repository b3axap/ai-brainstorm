// interactive.js — Interactive layer for artifact renderers
// Adds inline editing, click-to-expand, and drag capabilities to rendered artifacts

class InteractiveLayer {
  constructor(card, artifact, socket) {
    this.card = card;
    this.artifact = artifact;
    this.socket = socket;
    this.roomId = null; // set from state

    // Get roomId from global state
    if (typeof state !== 'undefined' && state.roomId) {
      this.roomId = state.roomId;
    }

    this.attachRendererInteractivity();
  }

  emitPatch(path, value) {
    if (!this.roomId) return;
    this.socket.emit('artifact-data-patch', {
      roomId: this.roomId,
      artifactId: this.artifact.id,
      patch: { path, value }
    });
  }

  attachRendererInteractivity() {
    const type = this.artifact.renderer || this.artifact.type;
    switch (type) {
      case 'mindmap': this.setupMindmapInteractivity(); break;
      case 'table': this.setupTableInteractivity(); break;
      case 'checklist': this.setupChecklistInteractivity(); break;
      case 'kanban': this.setupKanbanInteractivity(); break;
    }
  }

  // --- MIND MAP: double-click to edit labels ---
  setupMindmapInteractivity() {
    const body = this.card.querySelector('.artifact-body');
    if (!body) return;

    body.addEventListener('dblclick', (e) => {
      const textEl = e.target.closest('text');
      if (!textEl) return;
      e.stopPropagation();

      const svg = body.querySelector('svg');
      if (!svg) return;

      const currentText = textEl.textContent;
      const bbox = textEl.getBBox();

      // Create foreignObject with input
      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('x', bbox.x - 4);
      fo.setAttribute('y', bbox.y - 2);
      fo.setAttribute('width', Math.max(bbox.width + 20, 80));
      fo.setAttribute('height', bbox.height + 8);

      const input = document.createElement('input');
      input.className = 'node-editing';
      input.value = currentText;
      input.style.cssText = 'width:100%;height:100%;background:var(--surface2);border:1px solid var(--accent);color:var(--text);border-radius:4px;padding:1px 4px;font-size:inherit;outline:none;';

      fo.appendChild(input);
      svg.appendChild(fo);
      input.focus();
      input.select();

      const finish = () => {
        const newVal = input.value.trim();
        fo.remove();
        if (newVal && newVal !== currentText) {
          textEl.textContent = newVal;
          // Find which branch/child this text belongs to and patch
          this.patchMindmapLabel(currentText, newVal);
        }
      };

      input.onblur = finish;
      input.onkeydown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); finish(); }
        if (ev.key === 'Escape') { fo.remove(); }
      };
    });
  }

  patchMindmapLabel(oldLabel, newLabel) {
    const data = this.artifact.data;
    if (!data || !data.branches) return;

    if (data.center === oldLabel) {
      this.emitPatch('center', newLabel);
      return;
    }

    for (let i = 0; i < data.branches.length; i++) {
      const branch = data.branches[i];
      if (branch.label === oldLabel) {
        this.emitPatch(`branches.${i}.label`, newLabel);
        return;
      }
      if (branch.children) {
        for (let j = 0; j < branch.children.length; j++) {
          const child = branch.children[j];
          const childLabel = typeof child === 'string' ? child : child.label;
          if (childLabel === oldLabel) {
            if (typeof child === 'string') {
              this.emitPatch(`branches.${i}.children.${j}`, newLabel);
            } else {
              this.emitPatch(`branches.${i}.children.${j}.label`, newLabel);
            }
            return;
          }
        }
      }
    }
  }

  // --- TABLE: double-click to edit cells, add row/column ---
  setupTableInteractivity() {
    const body = this.card.querySelector('.artifact-body');
    if (!body) return;
    const data = this.artifact.data;
    if (!data || !data.rows) return;

    // Double-click to edit cells
    body.addEventListener('dblclick', (e) => {
      const td = e.target.closest('td');
      if (!td || td.querySelector('input')) return;
      e.stopPropagation();

      const tr = td.parentElement;
      const table = tr.closest('table');
      const rowIdx = Array.from(table.querySelectorAll('tbody tr')).indexOf(tr);
      const colIdx = Array.from(tr.children).indexOf(td);
      if (rowIdx < 0 || colIdx < 0) return;

      const currentVal = td.textContent;
      td.classList.add('cell-editing');

      const input = document.createElement('input');
      input.className = 'input';
      input.value = currentVal;
      input.style.cssText = 'font-size:12px;padding:4px 6px;width:100%;';
      td.textContent = '';
      td.appendChild(input);
      input.focus();
      input.select();

      const finish = () => {
        const newVal = input.value.trim();
        td.classList.remove('cell-editing');
        td.textContent = newVal || currentVal;
        if (newVal && newVal !== currentVal) {
          const cell = data.rows[rowIdx][colIdx];
          if (typeof cell === 'object' && cell !== null) {
            this.emitPatch(`rows.${rowIdx}.${colIdx}.text`, newVal);
          } else {
            this.emitPatch(`rows.${rowIdx}.${colIdx}`, newVal);
          }
        }
      };

      input.onblur = finish;
      input.onkeydown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); finish(); }
        if (ev.key === 'Escape') { td.textContent = currentVal; td.classList.remove('cell-editing'); }
      };
    });
  }

  // --- CHECKLIST: click to toggle done ---
  setupChecklistInteractivity() {
    const body = this.card.querySelector('.artifact-body');
    if (!body) return;
    const data = this.artifact.data;
    if (!data || !data.items) return;

    body.querySelectorAll('.checklist-check').forEach((check, idx) => {
      check.classList.add('interactive');
      check.onclick = (e) => {
        e.stopPropagation();
        const item = data.items[idx];
        if (!item) return;
        const newDone = !item.done;
        this.emitPatch(`items.${idx}.done`, newDone);
      };
    });
  }

  // --- KANBAN: drag cards between columns ---
  setupKanbanInteractivity() {
    const body = this.card.querySelector('.artifact-body');
    if (!body) return;
    const data = this.artifact.data;
    if (!data || !data.columns) return;

    const cards = body.querySelectorAll('.kanban-card');
    const cols = body.querySelectorAll('.kanban-cards');

    cards.forEach(card => {
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.querySelector('.kanban-card-title').textContent);
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });

    cols.forEach((col, colIdx) => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const dragging = body.querySelector('.kanban-card.dragging');
        if (!dragging) return;
        col.appendChild(dragging);
        // Note: full data sync happens via artifact-action expand/ask
        // This is visual-only for now; a proper implementation would track card indices
      });
    });
  }
}

// Expose globally
window.InteractiveLayer = InteractiveLayer;
