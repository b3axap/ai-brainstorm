// Shared state and socket — single source of truth
// CDN globals: io (socket.io), mermaid, marked, html2canvas are loaded before this module

export const socket = io();

export const state = {
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
  newIdeaMode: false,
};

// Load agents list
fetch('/api/agents')
  .then(r => r.json())
  .then(agents => { state.agents = agents; })
  .catch(err => {
    console.error('Failed to load agents:', err);
  });
