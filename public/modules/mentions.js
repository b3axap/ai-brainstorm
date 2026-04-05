// @ Mention autocomplete
import { state } from './state.js';
import { escHtml } from './utils.js';

let mentionActive = false;
let mentionStart = -1;

export function initMentions() {
  const input = document.getElementById('chatInput');
  const dropdown = document.getElementById('mentionDropdown');
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const val = input.value;
    const pos = input.selectionStart;
    const before = val.substring(0, pos);
    const atIdx = before.lastIndexOf('@');

    if (atIdx >= 0 && (atIdx === 0 || before[atIdx - 1] === ' ')) {
      const query = before.substring(atIdx + 1).toLowerCase();
      const matches = state.artifacts.filter(a =>
        (a.title || '').toLowerCase().includes(query) ||
        (a.type || '').toLowerCase().includes(query)
      ).slice(0, 5);

      if (matches.length > 0) {
        mentionActive = true;
        mentionStart = atIdx;
        showMentionDropdown(matches, input, dropdown);
        return;
      }
    }
    closeMentionDropdown();
  });

  input.addEventListener('keydown', (e) => {
    if (!mentionActive) return;
    if (e.key === 'Escape') {
      closeMentionDropdown();
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const active = dropdown.querySelector('.mention-item.active') || dropdown.querySelector('.mention-item');
      if (active && mentionActive) {
        selectMention(active.dataset.artifactId, input);
        e.preventDefault();
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = dropdown.querySelectorAll('.mention-item');
      if (items.length === 0) return;
      const current = dropdown.querySelector('.mention-item.active');
      if (current) { current.classList.remove('active'); current.setAttribute('aria-selected', 'false'); }
      let idx = Array.from(items).indexOf(current);
      idx = e.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
      items[idx].classList.add('active');
      items[idx].setAttribute('aria-selected', 'true');
      e.preventDefault();
    }
  });
}

function showMentionDropdown(matches, inputEl, dropdown) {
  dropdown.innerHTML = '';
  matches.forEach((art, i) => {
    const item = document.createElement('div');
    item.className = `mention-item${i === 0 ? ' active' : ''}`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    item.dataset.artifactId = art.id;
    item.innerHTML = `
      <span class="mention-icon">${art.icon || '📄'}</span>
      <span class="mention-title">${escHtml(art.title || 'Untitled')}</span>
      <span class="mention-type">${escHtml(art.type)}</span>
    `;
    item.onclick = () => selectMention(art.id, inputEl);
    dropdown.appendChild(item);
  });

  const rect = inputEl.getBoundingClientRect();
  dropdown.style.left = rect.left + 'px';
  dropdown.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
  dropdown.classList.add('visible');
}

function selectMention(artifactId, inputEl) {
  const art = state.artifacts.find(a => a.id === artifactId);
  if (!art) return;
  const val = inputEl.value;
  const before = val.substring(0, mentionStart);
  const after = val.substring(inputEl.selectionStart);
  inputEl.value = before + '@' + (art.title || art.type) + ' ' + after;
  closeMentionDropdown();
  inputEl.focus();
}

export function closeMentionDropdown() {
  mentionActive = false;
  const dropdown = document.getElementById('mentionDropdown');
  if (dropdown) dropdown.classList.remove('visible');
}
