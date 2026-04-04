# Replit Sync Review Checklist

Use this prompt to verify the Replit deployment matches the latest GitHub commit.

---

## Pre-check

- [ ] Run `git log --oneline -1` on GitHub (repo: `b3axap/ai-brainstorm`, branch: `master`) — note the latest commit hash
- [ ] Compare with what's running on Replit — check if Replit's code matches that commit
- [ ] If Replit has a `.git` folder, run `git log --oneline -1` there too and compare hashes

---

## File Inventory (must all exist and match GitHub)

### Root files
- [ ] `server.js` — main backend (~746 lines)
- [ ] `agents.js` — agent loader (~39 lines)
- [ ] `package.json` — deps: `@anthropic-ai/sdk`, `dotenv`, `express`, `socket.io`
- [ ] `package-lock.json`
- [ ] `.replit` — run = `npm start`, entrypoint = `server.js`
- [ ] `replit.nix` — node-20_x
- [ ] `.env.example`
- [ ] `.gitignore` — must include `node_modules/`, `.env`, `.DS_Store`
- [ ] `CLAUDE.md`
- [ ] `README.md`

### `public/` (5 files)
- [ ] `public/index.html` — SPA: landing screen + workspace split-view
- [ ] `public/app.js` — client logic (~846 lines)
- [ ] `public/renderers.js` — 15 renderers (~511 lines)
- [ ] `public/interactive.js` — InteractiveLayer class (~232 lines)
- [ ] `public/style.css` — dark theme styles (~358 lines)

### `agents/` (16 files)
- [ ] `agents/_schema.json`
- [ ] `agents/mindmap.json`
- [ ] `agents/table.json`
- [ ] `agents/presentation.json`
- [ ] `agents/diagram.json`
- [ ] `agents/html_guide.json`
- [ ] `agents/image.json`
- [ ] `agents/freeform.json`
- [ ] `agents/timeline.json`
- [ ] `agents/swot.json`
- [ ] `agents/kanban.json`
- [ ] `agents/pros_cons.json`
- [ ] `agents/matrix.json`
- [ ] `agents/checklist.json`
- [ ] `agents/donut_chart.json`
- [ ] `agents/quote_card.json`

---

## Critical Code Checks

### server.js
- [ ] Concurrency: `activeLocks` Map exists — per-socket request lock
- [ ] Concurrency: `activeAborts` Map exists — AbortController per stream
- [ ] Concurrency: `MAX_MESSAGES = 200` constant exists
- [ ] `send-message` handler: rejects if `activeLocks.get(socket.id)` is true
- [ ] `handleChatAnalysis()`: creates AbortController, stores in `activeAborts`
- [ ] `handleChatAnalysis()`: has `finally` block that clears `activeLocks` and `activeAborts`
- [ ] `disconnect` handler: calls `abort()` on active stream, clears locks
- [ ] `disconnect` handler: room cleanup uses `room._cleanupTimer` (single timer, cancellable)
- [ ] `join-room` handler: checks for duplicate socketId before `room.users.push()`
- [ ] `join-room` handler: clears `room._cleanupTimer` if it exists
- [ ] Error handler in `handleChatAnalysis`: emits to `socket` only, NOT `io.to(room.id)`
- [ ] `buildContext`: artifact list includes `id` — format: `(id:${a.id})`
- [ ] Canvas actions: `handleArtifactExpand`, `handleArtifactTransform`, `handleArtifactAsk` functions exist
- [ ] Socket events: `artifact-action`, `artifact-data-patch`, `execute-canvas-action` handlers exist
- [ ] `claude-done` emits: `canvasAction` field included
- [ ] Free phase prompt includes CANVAS COMMANDS section

### public/app.js
- [ ] Socket.IO error handling: `connect_error`, `disconnect`, `reconnect` handlers exist
- [ ] Fetch `/api/agents` has `.catch()` handler
- [ ] `streamingActive` flag exists alongside `streamingMsgId`
- [ ] `setupDrag()`: listeners added on `mousedown`, removed on `mouseup` (NOT permanent)
- [ ] Resize handle: `setupResizeHandle()` IIFE exists
- [ ] Mobile tabs: `setupMobileTabs()` IIFE exists
- [ ] @ mention support: `closeMentionDropdown()` called in `sendChatMessage()`
- [ ] Viz picker: `populateVizRefs()` function exists (artifact references)
- [ ] `generate-artifact` emits include `referenceIds`
- [ ] `artifact-updated` socket handler exists (for expand/transform/ask responses)
- [ ] `artifact-data-patch` socket emit exists (for inline edits)
- [ ] Canvas action confirmation UI: handler for `canvasAction` in `claude-done`

### public/interactive.js
- [ ] `InteractiveLayer` class exists
- [ ] Action bar: Expand, Transform, Ask buttons
- [ ] Inline editing for: mindmap labels, table cells, checklist toggles, kanban cards

### public/renderers.js
- [ ] All 15 renderers registered in `renderers` object
- [ ] Mermaid render: `document.contains(container)` guard before async update
- [ ] Freeform render: `document.contains(wrapper)` guard in error timeout

### public/index.html
- [ ] Layout: split-view workspace (NOT separate chat/canvas screens)
- [ ] Loads: `app.js`, `renderers.js`, `interactive.js`
- [ ] Resize handle element: `#resizeHandle`
- [ ] Mobile tab bar elements: `#mobileTabChat`, `#mobileTabCanvas`
- [ ] Viz picker modal: `#vizPickerModal` with references section `#vizReferences`

### public/style.css
- [ ] CSS Grid: `grid-template-columns` for split-view
- [ ] Mobile breakpoint at 768px
- [ ] Resize handle styles
- [ ] Action bar styles (`.action-bar`)
- [ ] @ mention dropdown styles

---

## Functional Smoke Test

After confirming files match:

1. **Landing** — open the app, verify landing page loads with name input + Create/Join buttons
2. **Create room** — enter a name, click Create → should switch to workspace split-view (chat left, canvas right)
3. **Room code** — verify room code appears and is copyable
4. **Chat** — send a message → Claude streams a response with 4 mandatory questions + clickable options
5. **Answer flow** — click option buttons → they populate the input field
6. **Canvas offer** — after answering 4 questions → "Push to Canvas" button appears with suggested viz types
7. **Generate** — click a suggested viz type → artifact appears on canvas
8. **Artifact interaction** — hover artifact → action bar appears (Expand/Transform/Ask)
9. **Drag** — drag artifact by header → moves smoothly, no console errors
10. **Viz picker** — click "New Visualization" button → modal with all 15 agents + reference section
11. **Rapid messages** — send 2 messages quickly → second one rejected with "please wait" toast (not interleaved)
12. **Resize** — drag the handle between chat and canvas → panels resize
13. **Multi-user** — open in 2 tabs, join same room code → both see each other in user list, artifacts sync

---

## Environment

- [ ] `ANTHROPIC_API_KEY` is set in Replit Secrets
- [ ] `node_modules/` exists (run `npm install` if not)
- [ ] Server starts without crash on `npm start`
- [ ] Port 3000 is accessible

---

## If Something Is Missing

Priority order for fixing:
1. Pull latest from GitHub: `git pull origin master`
2. Run `npm install` (in case deps changed)
3. Restart the Replit server
4. If Replit has manual edits that diverged — compare with `git diff` and resolve
