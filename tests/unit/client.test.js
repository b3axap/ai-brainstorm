const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Import only concurrency primitives — skip getClient (requires API key)
const claude = require('../../server/claude/client');

describe('claude client concurrency', () => {
  beforeEach(() => {
    // Clean up state between tests
    claude.cleanup('s1');
    claude.cleanup('s2');
  });

  describe('lock/unlock', () => {
    it('starts unlocked', () => {
      assert.equal(claude.isLocked('s1'), false);
    });

    it('locks a socket', () => {
      claude.lock('s1');
      assert.equal(claude.isLocked('s1'), true);
    });

    it('unlocks a socket', () => {
      claude.lock('s1');
      claude.unlock('s1');
      assert.equal(claude.isLocked('s1'), false);
    });

    it('isolates between sockets', () => {
      claude.lock('s1');
      assert.equal(claude.isLocked('s1'), true);
      assert.equal(claude.isLocked('s2'), false);
    });
  });

  describe('abort controllers', () => {
    it('stores and retrieves abort controller', () => {
      const ac = new AbortController();
      claude.setAbort('s1', ac);
      assert.equal(claude.getAbort('s1'), ac);
    });

    it('clears abort controller', () => {
      claude.setAbort('s1', new AbortController());
      claude.clearAbort('s1');
      assert.equal(claude.getAbort('s1'), undefined);
    });

    it('returns undefined for unset socket', () => {
      assert.equal(claude.getAbort('s99'), undefined);
    });
  });

  describe('cleanup', () => {
    it('aborts active controller', () => {
      const ac = new AbortController();
      claude.setAbort('s1', ac);
      claude.lock('s1');
      claude.cleanup('s1');
      assert.equal(ac.signal.aborted, true);
    });

    it('clears both lock and abort', () => {
      claude.lock('s1');
      claude.setAbort('s1', new AbortController());
      claude.cleanup('s1');
      assert.equal(claude.isLocked('s1'), false);
      assert.equal(claude.getAbort('s1'), undefined);
    });

    it('does not throw when nothing is active', () => {
      assert.doesNotThrow(() => claude.cleanup('s99'));
    });
  });
});
