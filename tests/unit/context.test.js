const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildContext } = require('../../server/context');
const config = require('../../config');

function makeRoom(overrides = {}) {
  return {
    id: 'TEST01',
    users: [{ name: 'Alice', socketId: 's1' }],
    artifacts: [],
    userChats: {
      s1: { messages: [], phase: { msgCount: 0 } }
    },
    messages: [],
    ...overrides
  };
}

describe('buildContext', () => {
  it('includes user names in system prompt', () => {
    const room = makeRoom({
      users: [{ name: 'Alice', socketId: 's1' }, { name: 'Bob', socketId: 's2' }]
    });
    const { systemBase } = buildContext(room, 's1');
    assert.ok(systemBase.includes('Alice, Bob'));
  });

  it('lists artifacts in system prompt', () => {
    const room = makeRoom({
      artifacts: [{ type: 'mindmap', title: 'Ideas', id: 'a1', author: 'Alice' }]
    });
    const { systemBase } = buildContext(room, 's1');
    assert.ok(systemBase.includes('[mindmap] "Ideas"'));
    assert.ok(systemBase.includes('id:a1'));
  });

  it('shows "none yet" when no artifacts', () => {
    const room = makeRoom();
    const { systemBase } = buildContext(room, 's1');
    assert.ok(systemBase.includes('none yet'));
  });

  it('returns messages under trim threshold as-is', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg ${i}`
    }));
    const room = makeRoom({ userChats: { s1: { messages: msgs, phase: {} } } });
    const { messages } = buildContext(room, 's1');
    assert.equal(messages.length, 10);
  });

  it('trims messages above threshold', () => {
    const count = config.messageTrimThreshold + 1; // 51
    const msgs = Array.from({ length: count }, (_, i) => ({
      role: 'user',
      content: `msg ${i}`
    }));
    const room = makeRoom({ userChats: { s1: { messages: msgs, phase: {} } } });
    const { messages } = buildContext(room, 's1');

    // first 5 + trim marker + last 30 = 36
    const expected = config.messageTrimKeepFirst + 1 + config.messageTrimKeepLast;
    assert.equal(messages.length, expected);
    assert.equal(messages[0].content, 'msg 0');
    assert.equal(messages[config.messageTrimKeepFirst].content, '[... earlier messages trimmed ...]');
    assert.equal(messages[messages.length - 1].content, `msg ${count - 1}`);
  });

  it('builds multimodal content for image files', () => {
    const msgs = [{
      role: 'user',
      content: 'check this',
      files: [{ isImage: true, data: 'abc123', type: 'image/png', name: 'pic.png' }]
    }];
    const room = makeRoom({ userChats: { s1: { messages: msgs, phase: {} } } });
    const { messages } = buildContext(room, 's1');

    assert.ok(Array.isArray(messages[0].content));
    const imageBlock = messages[0].content.find(b => b.type === 'image');
    assert.ok(imageBlock);
    assert.equal(imageBlock.source.media_type, 'image/png');
  });

  it('decodes text files to plain text blocks', () => {
    const encoded = Buffer.from('hello world').toString('base64');
    const msgs = [{
      role: 'user',
      content: 'see file',
      files: [{ isImage: false, data: encoded, type: 'text/plain', name: 'note.txt' }]
    }];
    const room = makeRoom({ userChats: { s1: { messages: msgs, phase: {} } } });
    const { messages } = buildContext(room, 's1');

    assert.ok(Array.isArray(messages[0].content));
    const textBlock = messages[0].content.find(b => b.type === 'text' && b.text.includes('hello world'));
    assert.ok(textBlock);
    assert.ok(textBlock.text.includes('[File: note.txt]'));
  });

  it('maps non-assistant roles to user', () => {
    const msgs = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hey' },
      { role: 'system', content: 'sys' }  // edge case
    ];
    const room = makeRoom({ userChats: { s1: { messages: msgs, phase: {} } } });
    const { messages } = buildContext(room, 's1');
    assert.equal(messages[0].role, 'user');
    assert.equal(messages[1].role, 'assistant');
    assert.equal(messages[2].role, 'user'); // non-assistant → user
  });

  it('handles missing userChats for socket', () => {
    const room = makeRoom({ userChats: {} });
    const { messages } = buildContext(room, 's1');
    assert.deepEqual(messages, []);
  });
});
