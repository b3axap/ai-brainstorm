const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  generateRoomId,
  generateId,
  extractLastJsonBlock,
  extractResponseText,
  calcArtifactPosition,
  applyPatch,
  getByPath,
  getParentAndKey,
} = require('../../server/utils');
const config = require('../../config');

// --- generateRoomId ---
describe('generateRoomId', () => {
  it('returns 6-char uppercase alphanumeric string', () => {
    const id = generateRoomId();
    assert.equal(id.length, 6);
    assert.match(id, /^[A-Z0-9]+$/);
  });

  it('produces different values across calls', () => {
    const ids = new Set(Array.from({ length: 20 }, generateRoomId));
    assert.ok(ids.size > 1, 'expected multiple unique IDs');
  });
});

// --- generateId ---
describe('generateId', () => {
  it('returns non-empty string', () => {
    assert.ok(generateId().length > 0);
  });

  it('produces unique values', () => {
    const a = generateId();
    const b = generateId();
    assert.notEqual(a, b);
  });
});

// --- extractLastJsonBlock ---
describe('extractLastJsonBlock', () => {
  it('extracts clean JSON string', () => {
    const json = '{"title":"hello"}';
    assert.equal(extractLastJsonBlock(json), json);
  });

  it('extracts JSON embedded in prose', () => {
    const text = 'Here is my response: {"key": "value"} Done.';
    assert.equal(extractLastJsonBlock(text), '{"key": "value"}');
  });

  it('handles nested braces', () => {
    const text = '{"outer": {"inner": {"deep": 1}}}';
    const result = extractLastJsonBlock(text);
    assert.deepEqual(JSON.parse(result), { outer: { inner: { deep: 1 } } });
  });

  it('returns last JSON block when multiple present', () => {
    const text = '{"first": 1} some text {"second": 2}';
    assert.deepEqual(JSON.parse(extractLastJsonBlock(text)), { second: 2 });
  });

  it('returns null for no JSON', () => {
    assert.equal(extractLastJsonBlock('no json here'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(extractLastJsonBlock(''), null);
  });

  it('returns null for unbalanced braces', () => {
    assert.equal(extractLastJsonBlock('{{{'), null);
  });

  it('handles JSON with string braces', () => {
    const text = '{"msg": "a {b} c"}';
    const result = extractLastJsonBlock(text);
    assert.ok(result !== null);
    assert.deepEqual(JSON.parse(result), { msg: 'a {b} c' });
  });
});

// --- extractResponseText ---
describe('extractResponseText', () => {
  it('extracts text from valid response', () => {
    const resp = { content: [{ text: 'hello' }] };
    assert.equal(extractResponseText(resp), 'hello');
  });

  it('returns null for null response', () => {
    assert.equal(extractResponseText(null), null);
  });

  it('returns null for missing content', () => {
    assert.equal(extractResponseText({}), null);
  });

  it('returns null for empty content array', () => {
    assert.equal(extractResponseText({ content: [] }), null);
  });

  it('returns null when text field is missing', () => {
    assert.equal(extractResponseText({ content: [{}] }), null);
  });
});

// --- calcArtifactPosition ---
describe('calcArtifactPosition', () => {
  const { cols, cardWidth, cardHeight, gap, offsetX, offsetY } = config.grid;

  it('calculates position for index 0', () => {
    const pos = calcArtifactPosition(0);
    assert.deepEqual(pos, { x: offsetX, y: offsetY });
  });

  it('calculates position for index 1 (second column)', () => {
    const pos = calcArtifactPosition(1);
    assert.deepEqual(pos, { x: offsetX + (cardWidth + gap), y: offsetY });
  });

  it('wraps to next row at index 2', () => {
    const pos = calcArtifactPosition(2);
    assert.deepEqual(pos, { x: offsetX, y: offsetY + (cardHeight + gap) });
  });

  it('calculates position for larger index', () => {
    const pos = calcArtifactPosition(5);
    const col = 5 % cols;
    const row = Math.floor(5 / cols);
    assert.deepEqual(pos, {
      x: offsetX + col * (cardWidth + gap),
      y: offsetY + row * (cardHeight + gap)
    });
  });
});

// --- applyPatch ---
describe('applyPatch', () => {
  it('patches top-level key', () => {
    const data = { title: 'old' };
    applyPatch(data, 'title', 'new');
    assert.equal(data.title, 'new');
  });

  it('patches nested dotted path', () => {
    const data = { branches: [{ label: 'A' }] };
    applyPatch(data, 'branches.0.label', 'B');
    assert.equal(data.branches[0].label, 'B');
  });

  it('patches bracket notation', () => {
    const data = { items: ['a', 'b', 'c'] };
    applyPatch(data, 'items[1]', 'x');
    assert.equal(data.items[1], 'x');
  });

  it('mutates original object', () => {
    const data = { a: 1 };
    const ref = data;
    applyPatch(data, 'a', 2);
    assert.equal(ref.a, 2);
  });
});

// --- getByPath ---
describe('getByPath', () => {
  it('navigates to nested value', () => {
    const obj = { a: { b: { c: 42 } } };
    assert.equal(getByPath(obj, 'a.b.c'), 42);
  });

  it('navigates with bracket notation', () => {
    const obj = { items: [10, 20, 30] };
    assert.equal(getByPath(obj, 'items[2]'), 30);
  });

  it('returns undefined for null intermediate', () => {
    const obj = { a: null };
    assert.equal(getByPath(obj, 'a.b.c'), undefined);
  });

  it('returns top-level value', () => {
    const obj = { title: 'hello' };
    assert.equal(getByPath(obj, 'title'), 'hello');
  });
});

// --- getParentAndKey ---
describe('getParentAndKey', () => {
  it('returns parent object and key', () => {
    const obj = { a: { b: { c: 1 } } };
    const { parent, key } = getParentAndKey(obj, 'a.b.c');
    assert.equal(parent, obj.a.b);
    assert.equal(key, 'c');
  });

  it('returns null parent for broken path', () => {
    const obj = { a: null };
    const { parent, key } = getParentAndKey(obj, 'a.b.c');
    assert.equal(parent, null);
    assert.equal(key, 'c');
  });

  it('handles top-level key', () => {
    const obj = { title: 'x' };
    const { parent, key } = getParentAndKey(obj, 'title');
    assert.equal(parent, obj);
    assert.equal(key, 'title');
  });
});
