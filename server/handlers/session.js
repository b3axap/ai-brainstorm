const config = require('../../config');
const { generateRoomId, generateId, calcArtifactPosition } = require('../utils');
const store = require('../data/memory');

function handleImportSession(socket, io, { userName, artifacts, messages }) {
  if (!Array.isArray(artifacts)) {
    socket.emit('import-error', { message: 'Invalid session file: missing artifacts array.' });
    return;
  }

  const roomId = generateRoomId();
  const room = {
    id: roomId,
    messages: [],
    artifacts: [],
    users: [],
    userChats: {}
  };
  store.createRoom(room);

  // Import artifacts with fresh IDs and recalculated positions
  artifacts.forEach((art, i) => {
    if (!art.type || !art.data) return;
    room.artifacts.push({
      id: generateId(),
      type: art.type,
      title: art.title || 'Untitled',
      data: art.data,
      author: art.author || userName || 'Imported',
      renderer: art.renderer || art.type,
      icon: art.icon || '📄',
      timestamp: art.timestamp || Date.now(),
      position: art.position || calcArtifactPosition(i)
    });
  });

  // Restore shared messages (without files — they're not exported)
  if (Array.isArray(messages)) {
    messages.forEach(msg => {
      if (!msg.content && !msg.role) return;
      room.messages.push({
        id: msg.id || generateId(),
        role: msg.role || 'user',
        content: msg.content || '',
        userName: msg.userName || 'Imported',
        timestamp: msg.timestamp || Date.now()
      });
    });
  }

  // Set up user
  const user = {
    socketId: socket.id,
    name: userName || 'User',
    color: config.userColors[0]
  };
  room.users.push(user);
  socket.join(roomId);

  room.userChats[socket.id] = {
    messages: [...room.messages],
    phase: { mandatoryDone: false, mandatoryDoneAtMsg: 0, msgCount: 0 }
  };

  socket.roomId = roomId;
  socket.userName = userName;

  socket.emit('room-joined', {
    room: {
      id: room.id,
      artifacts: room.artifacts,
      users: room.users,
      messages: room.userChats[socket.id].messages
    },
    user
  });
}

function handleImportToRoom(socket, io, { roomId, artifacts }) {
  const room = store.getRoom(roomId);
  if (!room) {
    socket.emit('import-error', { message: 'Room not found.' });
    return;
  }
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    socket.emit('import-error', { message: 'No artifacts to import.' });
    return;
  }

  const startIndex = room.artifacts.length;
  const imported = [];

  artifacts.forEach((art, i) => {
    if (!art.type || !art.data) return;
    const artifact = {
      id: generateId(),
      type: art.type,
      title: art.title || 'Untitled',
      data: art.data,
      author: art.author || socket.userName || 'Imported',
      renderer: art.renderer || art.type,
      icon: art.icon || '📄',
      timestamp: Date.now(),
      position: calcArtifactPosition(startIndex + i)
    };
    room.artifacts.push(artifact);
    imported.push(artifact);
  });

  // Broadcast each artifact to all clients in the room
  imported.forEach(artifact => {
    io.to(roomId).emit('artifact-created', { artifact });
  });

  socket.emit('import-complete', { count: imported.length });
}

module.exports = { handleImportSession, handleImportToRoom };
