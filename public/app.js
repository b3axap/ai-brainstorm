// app.js — Entry point (ES module)
// CDN scripts (socket.io, marked, mermaid) must load before this via <script> tags

import { initLanding } from './modules/landing.js';
import { initChat } from './modules/chat.js';
import { initCanvas } from './modules/canvas.js';
import { initVizPicker } from './modules/viz-picker.js';
import { initMentions } from './modules/mentions.js';
import { initSocketHandlers } from './modules/socket-handlers.js';

// Initialize mermaid
if (typeof mermaid !== 'undefined') {
  mermaid.initialize({ startOnLoad: false, theme: 'dark' });
}

// Wire up all modules
initLanding();
initChat();
initCanvas();
initVizPicker();
initMentions();
initSocketHandlers();
