const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const store = require('../../server/data/memory');

describe('memory store', () => {
  beforeEach(() => {
    // Clear shared state between tests
    for (const key of Object.keys(store.rooms)) {
      delete store.rooms[key];
    }
  });

  describe('createRoom', () => {
    it('stores and returns the room', () => {
      const room = { id: 'ABC123', users: [], artifacts: [] };
      const result = store.createRoom(room);
      assert.equal(result, room);
      assert.equal(store.rooms['ABC123'], room);
    });
  });

  describe('getRoom', () => {
    it('returns null for nonexistent room', () => {
      assert.equal(store.getRoom('NOPE'), null);
    });

    it('returns room after creation', () => {
      const room = { id: 'XYZ789' };
      store.createRoom(room);
      assert.equal(store.getRoom('XYZ789'), room);
    });
  });

  describe('deleteRoom', () => {
    it('removes room from store', () => {
      store.createRoom({ id: 'DEL001' });
      store.deleteRoom('DEL001');
      assert.equal(store.getRoom('DEL001'), null);
    });

    it('does not throw for nonexistent room', () => {
      assert.doesNotThrow(() => store.deleteRoom('NOPE'));
    });
  });

  describe('getAllRooms', () => {
    it('returns empty object when no rooms', () => {
      const all = store.getAllRooms();
      assert.deepEqual(all, {});
    });

    it('reflects current state', () => {
      store.createRoom({ id: 'A' });
      store.createRoom({ id: 'B' });
      const all = store.getAllRooms();
      assert.ok(all['A']);
      assert.ok(all['B']);
      assert.equal(Object.keys(all).length, 2);
    });

    it('reflects deletions', () => {
      store.createRoom({ id: 'C' });
      store.deleteRoom('C');
      assert.equal(Object.keys(store.getAllRooms()).length, 0);
    });
  });
});
