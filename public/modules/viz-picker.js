// Visualization picker modal
import { state, socket } from './state.js';
import { escHtml, showToast, trapFocus } from './utils.js';

let _releaseFocusTrap = null;

export function initVizPicker() {
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
}

export function openVizPicker(preSelected) {
  state.pendingSuggestions = preSelected || [];
  populateVizGrid();
  populateVizRefs();
  document.getElementById('vizCustomCheck').checked = false;
  document.getElementById('vizCustomInput').value = '';
  document.getElementById('vizCustomInput').disabled = true;
  const modal = document.getElementById('vizPickerModal');
  modal.classList.add('active');
  _releaseFocusTrap = trapFocus(modal);
  updateVizGenerateBtn();
}

function closeVizPicker() {
  document.getElementById('vizPickerModal').classList.remove('active');
  if (_releaseFocusTrap) { _releaseFocusTrap(); _releaseFocusTrap = null; }
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
