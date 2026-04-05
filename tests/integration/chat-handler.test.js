const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Patch handleChatAnalysis BEFORE requiring chat handler:
// chat.js does require('../claude/chat-analysis') which lazy-requires the SDK.
// We pre-load and replace the export to prevent Claude API calls.
const chatAnalysisModule = require('../../server/claude/chat-analysis');
let chatAnalysisCalls = [];
const originalChatAnalysis = chatAnalysisModule.handleChatAnalysis;
chatAnalysisModule.handleChatAnalysis = function (...args) {
  chatAnalysisCalls.push(args);
};

// Patch isLocked to be controllable
const claudeClient = require('../../server/claude/client');
let isLockedReturn = false;
const originalIsLocked = claudeClient.isLocked;
claudeClient.isLocked = () => isLockedReturn;

const { handleSendMessage } = require('../../server/handlers/chat');
const store = require('../../server/data/memory');
const config = require('../../config');
const { createMockSocket, createMockIo, createMockRoom } = require('../helpers');

describe('chat handler', () => {
  let socket, io;

  beforeEach(() => {
    for (const key of Object.keys(store.rooms)) delete store.rooms[key];
    socket = createMockSocket('sock-1');
    socket.roomId = 'TEST01';
    socket.userName = 'Alice';
    io = createMockIo();
    chatAnalysisCalls = [];
    isLockedReturn = false;
  });

  function setupRoom(overrides = {}) {
    const room = createMockRoom({
      userChats: {
        'sock-1': {
          messages: [],
          phase: { mandatoryDone: false, mandatoryDoneAtMsg: 0, msgCount: 0 }
        }
      },
      ...overrides
    });
    store.createRoom(room);
    return room;
  }

  describe('basic message flow', () => {
    it('stores message in user chat', () => {
      setupRoom();
      handleSendMessage(socket, io, {
        roomId: 'TEST01', content: 'hello', isNewIdea: false
      });

      const room = store.getRoom('TEST01');
      assert.equal(room.userChats['sock-1'].messages.length, 1);
      assert.equal(room.userChats['sock-1'].messages[0].content, 'hello');
    });

    it('stores message in shared log', () => {
      setupRoom();
      handleSendMessage(socket, io, {
        roomId: 'TEST01', content: 'hello', isNewIdea: false
      });

      const room = store.getRoom('TEST01');
      assert.equal(room.messages.length, 1);
      assert.equal(room.messages[0].content, 'hello');
    });

    it('emits new-message to sender', () => {
      setupRoom();
      handleSendMessage(socket, io, {
        roomId: 'TEST01', content: 'hello', isNewIdea: false
      });

      const msg = socket.lastEmit('new-message');
      assert.ok(msg);
      assert.equal(msg.message.content, 'hello');
    });

    it('emits sidebar-message to room', () => {
      setupRoom();
      handleSendMessage(socket, io, {
        roomId: 'TEST01', content: 'hello', isNewIdea: false
      });

      const toEvents = socket.toRooms['TEST01'];
      assert.ok(toEvents);
      const sidebar = toEvents.find(e => e.event === 'sidebar-message');
      assert.ok(sidebar);
    });

    it('increments phase.msgCount', () => {
      setupRoom();
      handleSendMessage(socket, io, { roomId: 'TEST01', content: 'a' });
      handleSendMessage(socket, io, { roomId: 'TEST01', content: 'b' });

      const room = store.getRoom('TEST01');
      assert.equal(room.userChats['sock-1'].phase.msgCount, 2);
    });

    it('triggers handleChatAnalysis', () => {
      setupRoom();
      handleSendMessage(socket, io, {
        roomId: 'TEST01', content: 'hello', isNewIdea: true
      });

      assert.equal(chatAnalysisCalls.length, 1);
      assert.equal(chatAnalysisCalls[0][2], true); // isNewIdea
    });
  });

  describe('concurrency lock', () => {
    it('rejects when Claude is locked', () => {
      setupRoom();
      isLockedReturn = true;

      handleSendMessage(socket, io, {
        roomId: 'TEST01', content: 'hello'
      });

      const error = socket.lastEmit('generation-error');
      assert.ok(error);
      assert.ok(error.message.includes('wait'));
      const room = store.getRoom('TEST01');
      assert.equal(room.userChats['sock-1'].messages.length, 0);
    });
  });

  describe('file validation', () => {
    it('caps files to maxFiles', () => {
      setupRoom();
      const files = Array.from({ length: 8 }, (_, i) => ({
        name: `f${i}.txt`, type: 'text/plain', data: 'abc', isImage: false
      }));

      handleSendMessage(socket, io, {
        roomId: 'TEST01', content: 'files', files
      });

      const room = store.getRoom('TEST01');
      const stored = room.userChats['sock-1'].messages[0].files;
      assert.equal(stored.length, config.maxFiles);
    });

    it('filters out oversized files', () => {
      setupRoom();
      const bigData = 'x'.repeat(Math.ceil(config.maxFileSizeBase64) + 1);
      const files = [
        { name: 'small.txt', type: 'text/plain', data: 'abc', isImage: false },
        { name: 'big.txt', type: 'text/plain', data: bigData, isImage: false }
      ];

      handleSendMessage(socket, io, {
        roomId: 'TEST01', content: 'files', files
      });

      const room = store.getRoom('TEST01');
      const stored = room.userChats['sock-1'].messages[0].files;
      assert.equal(stored.length, 1);
      assert.equal(stored[0].name, 'small.txt');
    });

    it('strips file data from shared log', () => {
      setupRoom();
      const files = [{
        name: 'pic.png', type: 'image/png', data: 'base64data', isImage: true
      }];

      handleSendMessage(socket, io, {
        roomId: 'TEST01', content: 'img', files
      });

      const room = store.getRoom('TEST01');
      const sharedFile = room.messages[0].files[0];
      assert.equal(sharedFile.name, 'pic.png');
      assert.equal(sharedFile.data, undefined);
    });
  });

  describe('message capping', () => {
    it('caps user chat to maxMessages', () => {
      setupRoom();
      for (let i = 0; i < config.maxMessages + 5; i++) {
        handleSendMessage(socket, io, {
          roomId: 'TEST01', content: `msg ${i}`
        });
      }

      const room = store.getRoom('TEST01');
      assert.equal(room.userChats['sock-1'].messages.length, config.maxMessages);
    });

    it('caps shared log to maxMessages', () => {
      setupRoom();
      for (let i = 0; i < config.maxMessages + 5; i++) {
        handleSendMessage(socket, io, {
          roomId: 'TEST01', content: `msg ${i}`
        });
      }

      const room = store.getRoom('TEST01');
      assert.equal(room.messages.length, config.maxMessages);
    });
  });

  describe('edge cases', () => {
    it('returns early for nonexistent room', () => {
      assert.doesNotThrow(() => {
        handleSendMessage(socket, io, {
          roomId: 'NOPE', content: 'hello'
        });
      });
    });

    it('returns early for missing userChat', () => {
      store.createRoom(createMockRoom({ userChats: {} }));
      assert.doesNotThrow(() => {
        handleSendMessage(socket, io, {
          roomId: 'TEST01', content: 'hello'
        });
      });
    });
  });
});
