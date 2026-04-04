// state.js — Global state, socket init, utilities

window.App = window.App || {};

// Mermaid init
if (typeof mermaid !== 'undefined') mermaid.initialize({ startOnLoad: false, theme: 'dark' });

// --- Socket ---
App.socket = io();

// --- State ---
App.state = {
  screen: 'landing',
  roomId: null,
  userName: null,
  messages: [],
  artifacts: [],
  users: [],
  generating: false,
  agents: [],
  pendingSuggestions: [],
  pendingFiles: [],
  newIdeaMode: false
};

// --- Utilities ---
App.escHtml = function(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
};

App.renderMarkdown = function(text) {
  if (!text) return '';
  if (typeof marked !== 'undefined' && marked.parse) {
    try { return marked.parse(text, { breaks: true, gfm: true }); }
    catch (e) { return App.escHtml(text); }
  }
  return App.escHtml(text);
};

App.showToast = function(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2500);
};

App.showScreen = function(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  App.state.screen = name;
  if (name === 'workspace') document.getElementById('chatInput').focus();
};

App.generateId = function() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
};

// --- Load agents ---
fetch('/api/agents')
  .then(r => r.json())
  .then(agents => { App.state.agents = agents; })
  .catch(err => {
    console.error('Failed to load agents:', err);
    App.showToast('Failed to load visualization types');
  });

// --- Socket connection handling ---
App.socket.on('connect_error', () => App.showToast('Connection error — retrying...'));

App.socket.on('disconnect', (reason) => {
  App.state.generating = false;
  document.getElementById('typingIndicator').classList.remove('visible');
  if (reason !== 'io client disconnect') App.showToast('Disconnected — reconnecting...');
});

App.socket.on('reconnect', () => {
  App.showToast('Reconnected!');
  if (App.state.roomId && App.state.userName) {
    App.socket.emit('join-room', { userName: App.state.userName, roomId: App.state.roomId });
  }
});
