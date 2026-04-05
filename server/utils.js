const config = require('../config');

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

// Extract last JSON object from text using brace-depth matching
function extractLastJsonBlock(text) {
  let lastClose = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '}') { lastClose = i; break; }
  }
  if (lastClose === -1) return null;

  let depth = 0;
  for (let i = lastClose; i >= 0; i--) {
    if (text[i] === '}') depth++;
    else if (text[i] === '{') depth--;
    if (depth === 0) return text.slice(i, lastClose + 1);
  }
  return null;
}

// Safely extract text from Claude API response
function extractResponseText(response) {
  if (!response || !response.content || !response.content[0]) return null;
  return response.content[0].text || null;
}

// Grid-based positioning for artifacts
function calcArtifactPosition(index) {
  const { cols, cardWidth, cardHeight, gap, offsetX, offsetY } = config.grid;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: offsetX + col * (cardWidth + gap),
    y: offsetY + row * (cardHeight + gap)
  };
}

// Apply simple path-based patch to object: e.g. 'branches.0.label' → obj.branches[0].label
function applyPatch(data, path, value) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let obj = data;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
}

// Navigate to value at path
function getByPath(obj, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  for (const p of parts) {
    if (obj == null) return undefined;
    obj = obj[p];
  }
  return obj;
}

// Get parent object and key for a path
function getParentAndKey(obj, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  const key = parts.pop();
  for (const p of parts) {
    if (obj == null) return { parent: null, key };
    obj = obj[p];
  }
  return { parent: obj, key };
}

module.exports = {
  generateRoomId,
  generateId,
  extractLastJsonBlock,
  extractResponseText,
  calcArtifactPosition,
  applyPatch,
  getByPath,
  getParentAndKey,
};
