// Landing screen logic
import { state, socket } from './state.js';

export function initLanding() {
  document.getElementById('createBtn').onclick = () => {
    const name = document.getElementById('nameInput').value.trim();
    if (!name) return showLandingError('Please enter your name');
    state.userName = name;
    socket.emit('join-room', { userName: name });
  };

  document.getElementById('joinBtn').onclick = () => {
    const name = document.getElementById('nameInput').value.trim();
    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    if (!name) return showLandingError('Please enter your name');
    if (!code) return showLandingError('Please enter a room code');
    state.userName = name;
    socket.emit('join-room', { userName: name, roomId: code });
  };

  document.getElementById('nameInput').onkeypress = (e) => {
    if (e.key === 'Enter') document.getElementById('createBtn').click();
  };
  document.getElementById('codeInput').onkeypress = (e) => {
    if (e.key === 'Enter') document.getElementById('joinBtn').click();
  };
}

function showLandingError(msg) {
  const el = document.getElementById('landingError');
  el.textContent = msg;
  el.style.display = 'block';
}

export { showLandingError };
