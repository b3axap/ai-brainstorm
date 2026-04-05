# Testing Strategy

## Framework

Built-in Node.js test runner (`node:test` + `node:assert`). Zero dev dependencies — matches the project's minimal-deps philosophy.

Requires Node 18+.

## Running Tests

```bash
npm test              # all tests
npm run test:unit     # unit tests only
npm run test:integration  # integration tests only
npm run test:watch    # watch mode
```

## Test Structure

```
tests/
  helpers.js                    — Mock factories (socket, io, room, artifact)
  unit/
    utils.test.js               — 8 pure functions from server/utils.js
    memory.test.js              — CRUD operations on in-memory store
    context.test.js             — buildContext: message trimming + multimodal
    client.test.js              — Lock/unlock/abort concurrency primitives
    agents.test.js              — Agent loading and lookup
  integration/
    artifact-handler.test.js    — Patch, array-op, move, delete mutations
    room-handler.test.js        — Join/disconnect/cleanup timer lifecycle
    chat-handler.test.js        — Concurrency lock, file validation, message cap
```

## What's Tested

### Unit Tests (pure functions, no mocking)

| File | Tests | What |
|------|-------|------|
| `utils.test.js` | extractLastJsonBlock, extractResponseText, calcArtifactPosition, applyPatch, getByPath, getParentAndKey, generateId, generateRoomId | All 8 exports |
| `memory.test.js` | createRoom, getRoom, deleteRoom, getAllRooms | Full CRUD cycle |
| `context.test.js` | System prompt assembly, message trimming (threshold 50), multimodal content blocks (image + text files), role mapping | buildContext |
| `client.test.js` | Lock/unlock state, multi-socket isolation, AbortController lifecycle, cleanup cascades | Concurrency primitives |
| `agents.test.js` | 15 agents loaded, required fields present, getAgent lookup, summaries exclude systemPrompt | Agent loading |

### Integration Tests (with mock socket/io)

| File | Tests | What |
|------|-------|------|
| `artifact-handler.test.js` | Move position, patch data (top-level + nested), array ops (insert/remove/move), delete | Artifact CRUD without Claude |
| `room-handler.test.js` | Create room, join existing, join-error for bad code, duplicate prevention, color assignment, disconnect + cleanup timer, timer cancellation | Room lifecycle |
| `chat-handler.test.js` | Message storage (personal + shared), concurrency lock rejection, file cap (5), size filter, data stripping from shared log, message cap (200) | Chat flow |

## Adding Tests

1. **Unit test for a new utility:** Add to `tests/unit/`, import the function, use `describe`/`it`/`assert`.
2. **Integration test for a handler:** Use helpers from `tests/helpers.js`:
   ```javascript
   const { createMockSocket, createMockIo, createMockRoom, createTestArtifact } = require('../helpers');
   ```
3. **Need to mock Claude API calls?** Patch the module export before requiring the handler:
   ```javascript
   const chatAnalysisModule = require('../../server/claude/chat-analysis');
   chatAnalysisModule.handleChatAnalysis = function (...args) { /* mock */ };
   ```

## Not Yet Tested (deferred)

- **Claude API integration** (generation.js, chat-analysis.js, artifact-ops.js) — requires complex streaming mocks
- **Client-side renderers** — would need JSDOM dependency
- **E2E tests** — would need socket.io-client
