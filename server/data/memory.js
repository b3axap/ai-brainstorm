// In-memory data store — clean CRUD interface
// Persistence deferred pending auth. Interface is ready for drop-in replacement.

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
