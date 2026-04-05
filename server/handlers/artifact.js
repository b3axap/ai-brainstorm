const store = require('../data/memory');
const { applyPatch, getByPath, getParentAndKey } = require('../utils');
const { handleArtifactGeneration } = require('../claude/generation');
const { handleArtifactExpand, handleArtifactTransform, handleArtifactAsk } = require('../claude/artifact-ops');

function handleGenerateArtifact(socket, io, { roomId, type, referenceIds, customPrompt }) {
  const room = store.getRoom(roomId);
  if (!room) return;
  handleArtifactGeneration(room, type, socket.userName, socket, io, referenceIds, customPrompt);
}

function handleMoveArtifact(socket, io, { roomId, artifactId, position }) {
  const room = store.getRoom(roomId);
  if (!room) return;
  const art = room.artifacts.find(a => a.id === artifactId);
  if (art) art.position = position;
  socket.to(roomId).emit('artifact-moved', { artifactId, position });
}

async function handleArtifactAction(socket, io, { roomId, artifactId, action, payload }) {
  const room = store.getRoom(roomId);
  if (!room) return;
  const artifact = room.artifacts.find(a => a.id === artifactId);
  if (!artifact) return;

  try {
    if (action === 'expand') {
      await handleArtifactExpand(room, artifact, socket, io);
    } else if (action === 'transform' && payload && payload.targetType) {
      await handleArtifactTransform(room, artifact, payload.targetType, socket, io);
    } else if (action === 'ask' && payload && payload.question) {
      await handleArtifactAsk(room, artifact, payload.question, socket, io);
    }
  } catch (error) {
    console.error(`Artifact action ${action} error:`, error.message);
    socket.emit('generation-error', { roomId, message: error.message });
  }
}

function handleDataPatch(socket, io, { roomId, artifactId, patch }) {
  const room = store.getRoom(roomId);
  if (!room) return;
  const artifact = room.artifacts.find(a => a.id === artifactId);
  if (!artifact || !patch) return;

  try {
    applyPatch(artifact.data, patch.path, patch.value);
  } catch (e) {
    console.error('Patch apply error:', e.message);
    return;
  }

  io.to(roomId).emit('artifact-updated', {
    roomId, artifactId, data: artifact.data, title: artifact.title
  });
}

function handleArrayOp(socket, io, { roomId, artifactId, op }) {
  const room = store.getRoom(roomId);
  if (!room) return;
  const artifact = room.artifacts.find(a => a.id === artifactId);
  if (!artifact || !op) return;

  try {
    if (op.type === 'insert') {
      const arr = getByPath(artifact.data, op.path);
      if (Array.isArray(arr)) {
        arr.push(op.value != null ? op.value : '');
      }
    } else if (op.type === 'remove') {
      const { parent, key } = getParentAndKey(artifact.data, op.path);
      if (Array.isArray(parent)) {
        const idx = parseInt(key);
        if (!isNaN(idx) && idx >= 0 && idx < parent.length) {
          parent.splice(idx, 1);
        }
      }
    } else if (op.type === 'move') {
      const { parent: srcParent, key: srcKey } = getParentAndKey(artifact.data, op.path);
      const destArr = getByPath(artifact.data, op.toPath);
      if (Array.isArray(srcParent) && Array.isArray(destArr)) {
        const idx = parseInt(srcKey);
        if (!isNaN(idx) && idx >= 0 && idx < srcParent.length) {
          const [item] = srcParent.splice(idx, 1);
          destArr.push(item);
        }
      }
    }
  } catch (e) {
    console.error('Array op error:', e.message);
    return;
  }

  io.to(roomId).emit('artifact-updated', {
    roomId, artifactId, data: artifact.data, title: artifact.title
  });
}

function handleDeleteArtifact(socket, io, { roomId, artifactId }) {
  const room = store.getRoom(roomId);
  if (!room) return;
  const idx = room.artifacts.findIndex(a => a.id === artifactId);
  if (idx === -1) return;
  room.artifacts.splice(idx, 1);
  io.to(roomId).emit('artifact-deleted', { artifactId });
}

function handleExecuteCanvasAction(socket, io, { roomId, canvasAction }) {
  const room = store.getRoom(roomId);
  if (!room || !canvasAction) return;

  try {
    if (canvasAction.intent === 'create' && canvasAction.artifact_type) {
      handleArtifactGeneration(room, canvasAction.artifact_type, socket.userName, socket, io);
    } else if (canvasAction.intent === 'update' && canvasAction.target_id) {
      const artifact = room.artifacts.find(a => a.id === canvasAction.target_id);
      if (artifact) {
        handleArtifactAsk(room, artifact, canvasAction.instruction || 'expand and improve', socket, io);
      }
    } else if (canvasAction.intent === 'transform' && canvasAction.target_id && canvasAction.artifact_type) {
      const artifact = room.artifacts.find(a => a.id === canvasAction.target_id);
      if (artifact) {
        handleArtifactTransform(room, artifact, canvasAction.artifact_type, socket, io);
      }
    }
  } catch (error) {
    socket.emit('generation-error', { roomId, message: error.message });
  }
}

module.exports = {
  handleGenerateArtifact,
  handleMoveArtifact,
  handleArtifactAction,
  handleDataPatch,
  handleArrayOp,
  handleDeleteArtifact,
  handleExecuteCanvasAction,
};
