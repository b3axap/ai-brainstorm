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

  // Example chips populate textarea on click
  document.getElementById('vizExampleChips').onclick = (e) => {
    const chip = e.target.closest('.viz-example-chip');
    if (!chip) return;
    const textarea = document.getElementById('vizCustomTextarea');
    textarea.value = chip.dataset.prompt;
    textarea.focus();
    updateVizGenerateBtn();
  };

  // Textarea input updates button
  document.getElementById('vizCustomTextarea').oninput = updateVizGenerateBtn;

  // Ctrl+Enter in textarea triggers generate
  document.getElementById('vizCustomTextarea').onkeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('vizGenerateBtn').click();
    }
  };

  document.getElementById('vizGenerateBtn').onclick = () => {
    const selected = getSelectedVizTypes();
    const customText = document.getElementById('vizCustomTextarea').value.trim();
    const refIds = getSelectedRefIds();

    if (selected.length === 0 && !customText) return;
    closeVizPicker();

    selected.forEach(typeId => {
      socket.emit('generate-artifact', { roomId: state.roomId, type: typeId, referenceIds: refIds });
    });

    if (customText) {
      socket.emit('generate-artifact', { roomId: state.roomId, type: 'freeform', referenceIds: refIds, customPrompt: customText });
    }

    const count = selected.length + (customText ? 1 : 0);
    showToast(`Generating ${count} visualization${count > 1 ? 's' : ''}...`);
  };
}

export function openVizPicker(preSelected) {
  state.pendingSuggestions = preSelected || [];
  populateVizGrid();
  populateVizRefs();
  document.getElementById('vizCustomTextarea').value = '';
  const modal = document.getElementById('vizPickerModal');
  modal.classList.add('active');
  _releaseFocusTrap = trapFocus(modal);
  // Focus textarea by default for custom viz
  setTimeout(() => document.getElementById('vizCustomTextarea').focus(), 100);
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
    // Skip freeform from template grid — it's now the custom section
    if (agent.id === 'freeform') return;
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
  const hasCustom = document.getElementById('vizCustomTextarea').value.trim().length > 0;
  const count = selected.length + (hasCustom ? 1 : 0);
  const btn = document.getElementById('vizGenerateBtn');
  btn.disabled = count === 0;
  btn.textContent = count > 0 ? `Generate (${count})` : 'Generate (0)';
}
