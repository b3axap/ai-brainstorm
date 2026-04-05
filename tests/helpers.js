// Shared mock factories for integration tests

function createMockSocket(id = 'socket-1') {
  const emitted = [];
  const toRooms = {};

  return {
    id,
    roomId: null,
    userName: null,
    emitted,
    toRooms,
    join(roomId) { this._joined = roomId; },
    emit(event, data) { emitted.push({ event, data }); },
    to(roomId) {
      if (!toRooms[roomId]) toRooms[roomId] = [];
      const bucket = toRooms[roomId];
      return {
        emit(event, data) { bucket.push({ event, data }); }
      };
    },
    lastEmit(event) {
      for (let i = emitted.length - 1; i >= 0; i--) {
        if (emitted[i].event === event) return emitted[i].data;
      }
      return undefined;
    }
  };
}

function createMockIo() {
  const rooms = {};
  return {
    rooms,
    to(roomId) {
      if (!rooms[roomId]) rooms[roomId] = [];
      const bucket = rooms[roomId];
      return {
        emit(event, data) { bucket.push({ event, data }); }
      };
    },
    getEmitted(roomId, event) {
      return (rooms[roomId] || []).filter(e => e.event === event);
    }
  };
}

function createMockRoom(overrides = {}) {
  return {
    id: 'TEST01',
    messages: [],
    artifacts: [],
    users: [],
    userChats: {},
    ...overrides
  };
}

function createTestArtifact(overrides = {}) {
  return {
    id: 'art-1',
    type: 'mindmap',
    title: 'Test Mindmap',
    author: 'Tester',
    position: { x: 40, y: 40 },
    data: {
      center: 'Main Idea',
      branches: [
        { label: 'Branch A', children: ['a1', 'a2'] },
        { label: 'Branch B', children: ['b1'] }
      ]
    },
    ...overrides
  };
}

module.exports = {
  createMockSocket,
  createMockIo,
  createMockRoom,
  createTestArtifact,
};
