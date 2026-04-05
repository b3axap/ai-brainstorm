const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// claude.cleanup() just clears Maps — no SDK call, safe to require directly
const { handleJoinRoom, handleDisconnect } = require('../../server/handlers/room');
const store = require('../../server/data/memory');
const config = require('../../config');
const { createMockSocket, createMockIo, createMockRoom } = require('../helpers');

describe('room handlers', () => {
  let socket, io;

  beforeEach(() => {
    for (const key of Object.keys(store.rooms)) delete store.rooms[key];
    socket = createMockSocket('sock-1');
    io = createMockIo();
  });

  afterEach(() => {
    // Clear any pending cleanup timers to prevent test from hanging
    for (const room of Object.values(store.rooms)) {
      if (room._cleanupTimer) {
        clearTimeout(room._cleanupTimer);
        room._cleanupTimer = null;
      }
    }
  });

  describe('handleJoinRoom — create new room', () => {
    it('creates a room when no roomId provided', () => {
      handleJoinRoom(socket, io, { roomId: null, userName: 'Alice' });

      const joined = socket.lastEmit('room-joined');
      assert.ok(joined);
      assert.ok(joined.room.id);
      assert.equal(joined.room.id.length, 6);
      assert.equal(joined.user.name, 'Alice');
    });

    it('stores room in memory', () => {
      handleJoinRoom(socket, io, { roomId: null, userName: 'Alice' });
      const joined = socket.lastEmit('room-joined');
      const room = store.getRoom(joined.room.id);
      assert.ok(room);
      assert.equal(room.users.length, 1);
    });

    it('sets socket.roomId and socket.userName', () => {
      handleJoinRoom(socket, io, { roomId: null, userName: 'Alice' });
      assert.ok(socket.roomId);
      assert.equal(socket.userName, 'Alice');
    });

    it('initializes per-user chat', () => {
      handleJoinRoom(socket, io, { roomId: null, userName: 'Alice' });
      const room = store.getRoom(socket.roomId);
      const userChat = room.userChats['sock-1'];
      assert.ok(userChat);
      assert.deepEqual(userChat.messages, []);
      assert.equal(userChat.phase.msgCount, 0);
    });
  });

  describe('handleJoinRoom — join existing room', () => {
    it('joins an existing room by roomId', () => {
      store.createRoom(createMockRoom());
      handleJoinRoom(socket, io, { roomId: 'TEST01', userName: 'Bob' });

      const joined = socket.lastEmit('room-joined');
      assert.equal(joined.room.id, 'TEST01');
      assert.equal(joined.user.name, 'Bob');
    });

    it('emits join-error for nonexistent roomId', () => {
      handleJoinRoom(socket, io, { roomId: 'BADID1', userName: 'Bob' });

      const error = socket.lastEmit('join-error');
      assert.ok(error);
      assert.ok(error.message.includes('not found'));
    });

    it('notifies existing users via socket.to', () => {
      store.createRoom(createMockRoom());
      handleJoinRoom(socket, io, { roomId: 'TEST01', userName: 'Bob' });

      const toEvents = socket.toRooms['TEST01'];
      assert.ok(toEvents);
      const userJoined = toEvents.find(e => e.event === 'user-joined');
      assert.ok(userJoined);
      assert.equal(userJoined.data.user.name, 'Bob');
    });

    it('prevents duplicate user entries for same socket', () => {
      store.createRoom(createMockRoom());
      handleJoinRoom(socket, io, { roomId: 'TEST01', userName: 'Bob' });
      handleJoinRoom(socket, io, { roomId: 'TEST01', userName: 'Bob' });

      const room = store.getRoom('TEST01');
      const socketUsers = room.users.filter(u => u.socketId === 'sock-1');
      assert.equal(socketUsers.length, 1);
    });
  });

  describe('handleJoinRoom — user colors', () => {
    it('assigns first color to first user', () => {
      handleJoinRoom(socket, io, { roomId: null, userName: 'Alice' });
      const joined = socket.lastEmit('room-joined');
      assert.equal(joined.user.color, config.userColors[0]);
    });

    it('assigns sequential colors', () => {
      store.createRoom(createMockRoom({
        users: [{ socketId: 'existing', name: 'Existing', color: config.userColors[0] }]
      }));
      handleJoinRoom(socket, io, { roomId: 'TEST01', userName: 'New' });
      const joined = socket.lastEmit('room-joined');
      assert.equal(joined.user.color, config.userColors[1]);
    });
  });

  describe('handleDisconnect', () => {
    it('removes user from room', () => {
      store.createRoom(createMockRoom({
        users: [
          { socketId: 'sock-1', name: 'Alice' },
          { socketId: 'sock-2', name: 'Bob' }
        ]
      }));
      socket.roomId = 'TEST01';

      handleDisconnect(socket, io);

      const room = store.getRoom('TEST01');
      assert.equal(room.users.length, 1);
      assert.equal(room.users[0].name, 'Bob');
    });

    it('emits user-left', () => {
      store.createRoom(createMockRoom({
        users: [{ socketId: 'sock-1', name: 'Alice' }]
      }));
      socket.roomId = 'TEST01';

      handleDisconnect(socket, io);

      const emitted = io.getEmitted('TEST01', 'user-left');
      assert.equal(emitted.length, 1);
      assert.equal(emitted[0].data.socketId, 'sock-1');
    });

    it('does not crash when no room', () => {
      socket.roomId = null;
      assert.doesNotThrow(() => handleDisconnect(socket, io));
    });

    it('schedules cleanup for empty room', () => {
      store.createRoom(createMockRoom({
        users: [{ socketId: 'sock-1', name: 'Alice' }]
      }));
      socket.roomId = 'TEST01';

      handleDisconnect(socket, io);

      const room = store.getRoom('TEST01');
      assert.ok(room, 'room should still exist (cleanup is delayed)');
      assert.ok(room._cleanupTimer, 'cleanup timer should be set');

      // Clean up timer to avoid test hanging
      clearTimeout(room._cleanupTimer);
    });

    it('cancels cleanup when user joins empty room', () => {
      store.createRoom(createMockRoom({
        users: [{ socketId: 'sock-1', name: 'Alice' }]
      }));
      socket.roomId = 'TEST01';

      handleDisconnect(socket, io);
      const room = store.getRoom('TEST01');
      assert.ok(room._cleanupTimer);

      // New user joins
      const socket2 = createMockSocket('sock-2');
      handleJoinRoom(socket2, io, { roomId: 'TEST01', userName: 'Bob' });

      assert.equal(room._cleanupTimer, null, 'timer should be cancelled');
    });
  });
});
