// Claude API client with lazy init and concurrency control
const config = require('../../config');

let anthropic = null;

function getClient() {
  if (!anthropic) {
    const Anthropic = require('@anthropic-ai/sdk');
    const AnthropicClass = Anthropic.default || Anthropic;
    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    anthropic = new AnthropicClass({ apiKey: apiKey || undefined });
  }
  return anthropic;
}

// Per-socket concurrency: locks and abort controllers
const activeLocks = new Map();   // socketId -> boolean
const activeAborts = new Map();  // socketId -> AbortController

function isLocked(socketId) {
  return !!activeLocks.get(socketId);
}

function lock(socketId) {
  activeLocks.set(socketId, true);
}

function unlock(socketId) {
  activeLocks.delete(socketId);
}

function getAbort(socketId) {
  return activeAborts.get(socketId);
}

function setAbort(socketId, controller) {
  activeAborts.set(socketId, controller);
}

function clearAbort(socketId) {
  activeAborts.delete(socketId);
}

function cleanup(socketId) {
  const abort = activeAborts.get(socketId);
  if (abort) abort.abort();
  activeLocks.delete(socketId);
  activeAborts.delete(socketId);
}

module.exports = {
  getClient,
  isLocked, lock, unlock,
  getAbort, setAbort, clearAbort,
  cleanup,
};
