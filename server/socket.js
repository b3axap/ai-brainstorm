// Socket.IO event router — thin dispatcher, no business logic
const { handleJoinRoom, handleDisconnect } = require('./handlers/room');
const { handleSendMessage } = require('./handlers/chat');
const {
  handleGenerateArtifact,
  handleMoveArtifact,
  handleArtifactAction,
  handleDataPatch,
  handleArrayOp,
  handleDeleteArtifact,
  handleExecuteCanvasAction,
} = require('./handlers/artifact');

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (data) => handleJoinRoom(socket, io, data));
    socket.on('send-message', (data) => handleSendMessage(socket, io, data));
    socket.on('generate-artifact', (data) => handleGenerateArtifact(socket, io, data));
    socket.on('move-artifact', (data) => handleMoveArtifact(socket, io, data));
    socket.on('artifact-action', (data) => handleArtifactAction(socket, io, data));
    socket.on('artifact-data-patch', (data) => handleDataPatch(socket, io, data));
    socket.on('artifact-array-op', (data) => handleArrayOp(socket, io, data));
    socket.on('delete-artifact', (data) => handleDeleteArtifact(socket, io, data));
    socket.on('execute-canvas-action', (data) => handleExecuteCanvasAction(socket, io, data));
    socket.on('disconnect', () => handleDisconnect(socket, io));
  });
}

module.exports = { initSocket };
