// In-memory data store — same as current behavior, extracted as module
// Will be replaced/supplemented by sqlite.js in Phase 3

const rooms = {};

function getRoom(roomId) {
  return rooms[roomId] || null;
}

function createRoom(room) {
  rooms[room.id] = room;
  return room;
}

function deleteRoom(roomId) {
  delete rooms[roomId];
}

function getAllRooms() {
  return rooms;
}

module.exports = {
  rooms,
  getRoom,
  createRoom,
  deleteRoom,
  getAllRooms,
};
