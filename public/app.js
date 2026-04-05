// app.js — Entry point (ES module)
// CDN scripts (socket.io, marked, mermaid) must load before this via <script> tags

import { socket, agentsReady } from './modules/state.js';
import { initLanding } from './modules/landing.js';
import { initChat } from './modules/chat.js';
import { initCanvas } from './modules/canvas.js';
import { initVizPicker } from './modules/viz-picker.js';
import { initMentions } from './modules/mentions.js';
import { initSocketHandlers } from './modules/socket-handlers.js';
import { initSession } from './modules/session.js';

// Initialize mermaid
if (typeof mermaid !== 'undefined') {
  mermaid.initialize({ startOnLoad: false, theme: 'dark' });
}

// Wire up all modules (register handlers before socket connects)
initLanding();
initChat();
initCanvas();
initVizPicker();
initMentions();
initSocketHandlers();
initSession();

// Connect socket AFTER all handlers registered, agents loaded (best-effort)
agentsReady.finally(() => {
  socket.connect();
});
