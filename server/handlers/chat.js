const config = require('../../config');
const { generateId } = require('../utils');
const store = require('../data/memory');
const claude = require('../claude/client');
const { handleChatAnalysis } = require('../claude/chat-analysis');

function handleSendMessage(socket, io, { roomId, content, isNewIdea, files }) {
  const room = store.getRoom(roomId);
  if (!room) return;

  const userChat = room.userChats[socket.id];
  if (!userChat) return;

  // Reject if a Claude call is already in-flight for this user
  if (claude.isLocked(socket.id)) {
    socket.emit('generation-error', { roomId, message: 'Please wait for the current response to finish.' });
    return;
  }

  // Validate and cap files
  let validFiles = null;
  if (files && Array.isArray(files) && files.length > 0) {
    validFiles = files.slice(0, config.maxFiles).filter(
      f => f.data && f.type && f.data.length < config.maxFileSizeBase64
    );
  }

  const message = {
    id: generateId(),
    role: 'user',
    content,
    userName: socket.userName,
    timestamp: Date.now(),
    files: validFiles || undefined
  };

  // Store in personal chat (with cap)
  userChat.messages.push(message);
  if (userChat.messages.length > config.maxMessages) {
    userChat.messages.splice(0, userChat.messages.length - config.maxMessages);
  }
  userChat.phase.msgCount++;

  // Store in shared log (without file data to save memory)
  const sharedMsg = {
    ...message,
    files: validFiles ? validFiles.map(f => ({ name: f.name, type: f.type, isImage: f.isImage })) : undefined
  };
  room.messages.push(sharedMsg);
  if (room.messages.length > config.maxMessages) {
    room.messages.splice(0, room.messages.length - config.maxMessages);
  }

  // Send to this user only (personal chat)
  socket.emit('new-message', { message });

  // Notify others via sidebar (without file data)
  socket.to(roomId).emit('sidebar-message', { message: sharedMsg });

  // Trigger Claude analysis
  handleChatAnalysis(room, socket, isNewIdea);
}

module.exports = { handleSendMessage };
