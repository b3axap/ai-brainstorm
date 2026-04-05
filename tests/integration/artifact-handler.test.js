const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// No mocking needed — handleMoveArtifact, handleDataPatch, handleArrayOp,
// handleDeleteArtifact don't call Claude. The SDK is lazy-loaded only in getClient().
const {
  handleMoveArtifact,
  handleDataPatch,
  handleArrayOp,
  handleDeleteArtifact,
} = require('../../server/handlers/artifact');

const store = require('../../server/data/memory');
const { createMockSocket, createMockIo, createMockRoom, createTestArtifact } = require('../helpers');

describe('artifact handlers', () => {
  let socket, io;

  beforeEach(() => {
    for (const key of Object.keys(store.rooms)) delete store.rooms[key];
    socket = createMockSocket();
    io = createMockIo();
  });

  describe('handleMoveArtifact', () => {
    it('updates artifact position', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      handleMoveArtifact(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1', position: { x: 100, y: 200 }
      });

      assert.deepEqual(art.position, { x: 100, y: 200 });
    });

    it('emits artifact-moved to room via socket.to', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      handleMoveArtifact(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1', position: { x: 0, y: 0 }
      });

      const moved = socket.toRooms['TEST01'];
      assert.ok(moved);
      assert.equal(moved[0].event, 'artifact-moved');
      assert.equal(moved[0].data.artifactId, 'art-1');
    });

    it('silently returns for nonexistent room', () => {
      assert.doesNotThrow(() => {
        handleMoveArtifact(socket, io, {
          roomId: 'NOPE', artifactId: 'art-1', position: { x: 0, y: 0 }
        });
      });
    });
  });

  describe('handleDataPatch', () => {
    it('patches artifact data and emits update', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      handleDataPatch(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1',
        patch: { path: 'center', value: 'New Center' }
      });

      assert.equal(art.data.center, 'New Center');
      const emitted = io.getEmitted('TEST01', 'artifact-updated');
      assert.equal(emitted.length, 1);
      assert.equal(emitted[0].data.data.center, 'New Center');
    });

    it('patches nested path', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      handleDataPatch(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1',
        patch: { path: 'branches.0.label', value: 'Updated' }
      });

      assert.equal(art.data.branches[0].label, 'Updated');
    });

    it('silently returns for missing artifact', () => {
      store.createRoom(createMockRoom());
      assert.doesNotThrow(() => {
        handleDataPatch(socket, io, {
          roomId: 'TEST01', artifactId: 'nope',
          patch: { path: 'x', value: 1 }
        });
      });
      assert.equal(io.getEmitted('TEST01', 'artifact-updated').length, 0);
    });

    it('handles invalid patch path without crashing', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      assert.doesNotThrow(() => {
        handleDataPatch(socket, io, {
          roomId: 'TEST01', artifactId: 'art-1',
          patch: { path: 'nonexistent.deep.path', value: 'x' }
        });
      });
      assert.equal(io.getEmitted('TEST01', 'artifact-updated').length, 0);
    });
  });

  describe('handleArrayOp', () => {
    it('inserts value into array', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      handleArrayOp(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1',
        op: { type: 'insert', path: 'branches.0.children', value: 'a3' }
      });

      assert.deepEqual(art.data.branches[0].children, ['a1', 'a2', 'a3']);
    });

    it('inserts empty string when value is null', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      handleArrayOp(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1',
        op: { type: 'insert', path: 'branches.0.children', value: null }
      });

      assert.equal(art.data.branches[0].children[2], '');
    });

    it('removes element from array', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      handleArrayOp(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1',
        op: { type: 'remove', path: 'branches.0.children.0' }
      });

      assert.deepEqual(art.data.branches[0].children, ['a2']);
    });

    it('ignores out-of-bounds remove', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));
      const before = [...art.data.branches[0].children];

      handleArrayOp(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1',
        op: { type: 'remove', path: 'branches.0.children.99' }
      });

      assert.deepEqual(art.data.branches[0].children, before);
    });

    it('moves element between arrays', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      handleArrayOp(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1',
        op: { type: 'move', path: 'branches.0.children.0', toPath: 'branches.1.children' }
      });

      assert.deepEqual(art.data.branches[0].children, ['a2']);
      assert.deepEqual(art.data.branches[1].children, ['b1', 'a1']);
    });

    it('emits artifact-updated after operation', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      handleArrayOp(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1',
        op: { type: 'insert', path: 'branches.0.children', value: 'new' }
      });

      assert.equal(io.getEmitted('TEST01', 'artifact-updated').length, 1);
    });
  });

  describe('handleDeleteArtifact', () => {
    it('removes artifact from room', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      handleDeleteArtifact(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1'
      });

      assert.equal(store.getRoom('TEST01').artifacts.length, 0);
    });

    it('emits artifact-deleted', () => {
      const art = createTestArtifact();
      store.createRoom(createMockRoom({ artifacts: [art] }));

      handleDeleteArtifact(socket, io, {
        roomId: 'TEST01', artifactId: 'art-1'
      });

      const emitted = io.getEmitted('TEST01', 'artifact-deleted');
      assert.equal(emitted.length, 1);
      assert.equal(emitted[0].data.artifactId, 'art-1');
    });

    it('silently returns for nonexistent artifact', () => {
      store.createRoom(createMockRoom());
      assert.doesNotThrow(() => {
        handleDeleteArtifact(socket, io, {
          roomId: 'TEST01', artifactId: 'nope'
        });
      });
      assert.equal(io.getEmitted('TEST01', 'artifact-deleted').length, 0);
    });
  });
});
