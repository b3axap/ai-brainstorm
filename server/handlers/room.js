const config = require('../../config');
const { generateRoomId } = require('../utils');
const store = require('../data/memory');
const claude = require('../claude/client');

function handleJoinRoom(socket, io, { roomId, userName }) {
  let room;

  if (roomId && store.getRoom(roomId)) {
    room = store.getRoom(roomId);
  } else if (roomId && !store.getRoom(roomId)) {
    socket.emit('join-error', { message: 'Room not found. Check the code and try again.' });
    return;
  } else {
    const id = generateRoomId();
    room = {
      id,
      messages: [],
      artifacts: [],
      users: [],
      userChats: {}
    };
    store.createRoom(room);
  }

  // Prevent duplicate user entries for same socket
  const existingUser = room.users.find(u => u.socketId === socket.id);
  const user = existingUser || {
    socketId: socket.id,
    name: userName,
    color: config.userColors[room.users.length % config.userColors.length]
  };
  if (!existingUser) room.users.push(user);
  socket.join(room.id);

  // Cancel any pending room cleanup
  if (room._cleanupTimer) {
    clearTimeout(room._cleanupTimer);
    room._cleanupTimer = null;
  }

  // Initialize per-user chat
  if (!room.userChats[socket.id]) {
    room.userChats[socket.id] = {
      messages: [],
      phase: { mandatoryDone: false, mandatoryDoneAtMsg: 0, msgCount: 0 }
    };
  }

  // Send room state
  socket.emit('room-joined', {
    room: {
      id: room.id,
      artifacts: room.artifacts,
      users: room.users,
      messages: room.userChats[socket.id].messages
    },
    user
  });

  socket.to(room.id).emit('user-joined', { user });

  // Store room reference on socket for disconnect
  socket.roomId = room.id;
  socket.userName = userName;
}

function handleDisconnect(socket, io) {
  // Abort any in-flight Claude stream
  claude.cleanup(socket.id);

  const roomId = socket.roomId;
  const room = roomId ? store.getRoom(roomId) : null;
  if (!room) return;

  room.users = room.users.filter(u => u.socketId !== socket.id);
  io.to(roomId).emit('user-left', { socketId: socket.id });

  // Clean up empty rooms after delay
  if (room.users.length === 0) {
    if (room._cleanupTimer) clearTimeout(room._cleanupTimer);
    room._cleanupTimer = setTimeout(() => {
      const current = store.getRoom(roomId);
      if (current && current.users.length === 0) {
        store.deleteRoom(roomId);
        console.log(`Room ${roomId} cleaned up`);
      }
    }, config.roomCleanupDelayMs);
  }
}

module.exports = { handleJoinRoom, handleDisconnect };
