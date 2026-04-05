// Session export/import module
import { state, socket } from './state.js';
import { showToast } from './utils.js';

function validateSessionData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.artifacts)) return false;
  // At least one artifact with type and data
  return data.artifacts.length === 0 || data.artifacts.some(a => a.type && a.data);
}

export function exportSession() {
  if (!state.artifacts || state.artifacts.length === 0) {
    showToast('Nothing to export — canvas is empty');
    return;
  }

  const session = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    artifacts: state.artifacts.map(a => ({
      type: a.type,
      title: a.title,
      data: a.data,
      author: a.author,
      renderer: a.renderer,
      icon: a.icon,
      timestamp: a.timestamp,
      position: a.position
    })),
    messages: state.messages
      .filter(m => m.role && m.content)
      .map(m => ({
        role: m.role,
        content: m.content,
        userName: m.userName,
        timestamp: m.timestamp
      }))
  };

  const json = JSON.stringify(session, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const link = document.createElement('a');
  link.download = `brainstorm-${state.roomId || 'session'}-${date}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);

  showToast('Session exported!');
}

function readFileAsJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function importSessionAsNewRoom(file, userName) {
  readFileAsJson(file).then(data => {
    if (!validateSessionData(data)) {
      showToast('Invalid session file');
      return;
    }
    socket.emit('import-session', {
      userName,
      artifacts: data.artifacts,
      messages: data.messages || []
    });
  }).catch(() => showToast('Failed to read session file'));
}

export function importToCurrentRoom(file) {
  readFileAsJson(file).then(data => {
    if (!validateSessionData(data)) {
      showToast('Invalid session file');
      return;
    }
    socket.emit('import-to-room', {
      roomId: state.roomId,
      artifacts: data.artifacts
    });
  }).catch(() => showToast('Failed to read session file'));
}

export function initSession() {
  // Landing: import session button
  const importBtn = document.getElementById('importSessionBtn');
  const sessionFileInput = document.getElementById('sessionFileInput');

  if (importBtn && sessionFileInput) {
    importBtn.addEventListener('click', () => sessionFileInput.click());
    sessionFileInput.addEventListener('change', () => {
      const file = sessionFileInput.files[0];
      if (!file) return;
      const nameInput = document.getElementById('nameInput');
      const userName = nameInput ? nameInput.value.trim() || 'User' : 'User';
      importSessionAsNewRoom(file, userName);
      sessionFileInput.value = '';
    });
  }

  // Workspace: export button
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportSession);
  }

  // Workspace: import to room button
  const importToRoomBtn = document.getElementById('importToRoomBtn');
  const roomFileInput = document.getElementById('roomFileInput');

  if (importToRoomBtn && roomFileInput) {
    importToRoomBtn.addEventListener('click', () => roomFileInput.click());
    roomFileInput.addEventListener('change', () => {
      const file = roomFileInput.files[0];
      if (!file) return;
      importToCurrentRoom(file);
      roomFileInput.value = '';
    });
  }

  // Server responses
  socket.on('import-error', ({ message }) => showToast('Import error: ' + message));
  socket.on('import-complete', ({ count }) => showToast(`${count} artifact${count !== 1 ? 's' : ''} imported!`));
}
