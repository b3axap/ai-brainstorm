# AI Brainstorm — Project Guide

## What is this project?

Collaborative brainstorming web app: users describe ideas in chat with Claude → Claude generates visual artifacts (mind maps, tables, diagrams, etc.) → shared canvas for teams.

## Architecture

**Stack:** Node.js + Express + Socket.IO + Anthropic SDK. Vanilla JS frontend, no build step.

**Layout:** Split-view workspace — chat (left, resizable ~350px) + canvas (right). Mobile (<768px): bottom tab bar. All interaction through chat input (📎 attach, ➕ new idea).

**Core concept:** "Interpreter Agents" — JSON files in `agents/` define prompts for each visualization type. Adding an agent = JSON + renderer function + CSS.

## File Structure (v1.0.0 — Modular Monolith)

```
config.js              — Centralized constants (model, grid, limits, ports)
agents.js              — Auto-loads agent JSON files at startup
agents/                — 15 agent JSON files + _schema.json
server/
  index.js             — Express + HTTP server setup, static serving
  socket.js            — Socket.IO event router (thin dispatcher)
  context.js           — buildContext (system prompt + message history)
  utils.js             — Shared utilities (ID gen, JSON parser, path ops)
  handlers/
    room.js            — join-room, disconnect, room lifecycle
    chat.js            — send-message, file validation, streaming trigger
    artifact.js        — generate, move, delete, patch, array-op, actions
  claude/
    client.js          — Anthropic SDK wrapper, lazy init, concurrency
    chat-analysis.js   — handleChatAnalysis (prompt building + streaming)
    artifact-ops.js    — expand, transform, ask
    generation.js      — handleArtifactGeneration with retry
  data/
    memory.js          — In-memory store (persistence-ready interface)
public/
  index.html           — SPA: landing + workspace (display:none switching)
  app.js               — ES module entry point (imports all modules)
  style.css            — Dark theme, split-view, artifact cards, .bs-* classes
  renderers.js         — 15 renderers with data-attribute annotations + SDK
  interactive.js       — InteractiveEngine: universal interactivity via data-attributes
  modules/
    state.js           — Shared state + socket (single source of truth)
    utils.js           — escHtml, renderMarkdown, showToast, showScreen
    landing.js         — Landing screen logic
    chat.js            — Chat UI, streaming, file attachment, new idea mode
    canvas.js          — Artifact cards, actions, drag, expand popup, pan/zoom
    viz-picker.js      — Visualization picker modal
    mentions.js        — @ mention autocomplete
    socket-handlers.js — All socket.on event handlers
```

## Detailed Documentation

| Topic | File | When to read |
|-------|------|-------------|
| **Architecture** | [`docs/architecture.md`](docs/architecture.md) | Understanding module structure, data flow, adding new features |
| **Adding agents** | [`docs/agents.md`](docs/agents.md) | Creating new visualization types (JSON + renderer + CSS) |
| **Interactivity system** | [`docs/interactivity.md`](docs/interactivity.md) | Editing renderers, data-attribute protocol, InteractiveEngine |
| **Design system** | [`docs/design-system.md`](docs/design-system.md) | CSS changes, styling, Figma reference, accessibility, animations, component states, keyboard shortcuts, feedback states |
| **Socket.IO API** | [`docs/socket-api.md`](docs/socket-api.md) | Client-server communication, event payloads, data model |

## Agent Catalog (15 agents)

| ID | Icon | Best For |
|----|------|----------|
| `mindmap` | 🧠 | Idea breakdown |
| `table` | 📊 | Comparison |
| `presentation` | 🎬 | Pitching |
| `diagram` | 🔀 | Process flows |
| `html_guide` | 📖 | Tutorials |
| `image` | 🎨 | Illustrations (placeholder) |
| `freeform` | ✨ | Creative HTML |
| `timeline` | 📅 | Roadmaps |
| `swot` | ⚡ | Strategic analysis |
| `kanban` | 📋 | Task boards |
| `pros_cons` | ⚖️ | Tradeoffs |
| `matrix` | 🎯 | Prioritization |
| `checklist` | ✅ | Action items |
| `donut_chart` | 🍩 | Proportions |
| `quote_card` | 💡 | Takeaways |

Output schemas: each agent's JSON file contains `outputExample`. Key schemas:
- **mindmap**: `{center, branches: [{label, children: [string]}]}`
- **table**: `{title, columns: [string], rows: [[string | {text, tag}]]}`
- **kanban**: `{title, columns: [{name, cards: [{title, tag}]}]}`
- Full list in agent JSON files under `agents/`.

## Data Flow

1. Create/join room → `join-room` → workspace appears
2. Send message → Claude streams response → `claude-done` with optional questions/suggestions
3. ➕ new idea → `isNewIdea: true` → Claude connects it to existing brainstorm
4. Claude may return `canvas_action` → confirmation button → `execute-canvas-action`
5. Pick visualization → `generate-artifact` → Claude generates JSON → renders on canvas
6. Interact with artifact → action bar or inline edit → `artifact-data-patch` / `artifact-array-op`

## Key Patterns

**Chat behavior:** Adaptive, no rigid phases. Claude acts as a brainstorming partner. Questions only when needed, with clickable options. JSON fields (`questions`, `suggest`, `offer_canvas`, `canvas_action`) all optional.

**Artifact interaction:** Action bar (hover: Open/AI Expand/Transform/Ask/Copy/PNG) + inline editing via data-attributes + expand popup (dblclick header or "Open"). See [`docs/interactivity.md`](docs/interactivity.md).

**Artifact positioning:** 2-column grid via `calcArtifactPosition(index)`, 540px width + 40px gap.

**Canvas pan/zoom:** Miro-like navigation via `_canvasPanZoom` (IIFE in `app.js`). Scroll = pan, Ctrl+Wheel = zoom (0.2x-2x), middle-click or Space+drag = pan. Zoom controls in bottom-right (#zoomControls). Canvas uses `transform: translate() scale()` on `.canvas-area` with `overflow: hidden` on `.canvas-panel`.

**Chat rendering:** Markdown via marked.js CDN. Auto-scroll to new artifacts. Question options always include a "Другое..." button (dashed style, focuses chat input).

**@ Mentions:** Type `@` → autocomplete dropdown → inserts `@Title` → server resolves to artifact data in Claude context.

**Concurrency:** Per-socket request lock, AbortController per stream, message cap (200), cancellable room cleanup (5 min).

## Adding a New Agent

1. Create `agents/your_agent.json` (follow `agents/_schema.json`)
2. Add renderer to `renderers.js`, register in `renderers` object
3. Add `data-*` attributes for interactivity (see [`docs/interactivity.md`](docs/interactivity.md))
4. Add CSS to `style.css`
5. Restart. Auto-loads.

## Environment

```bash
cp .env.example .env   # Add ANTHROPIC_API_KEY
npm install && npm start  # http://localhost:5000
```

| Variable | Required | Default |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | — |
| `PORT` | No | 5000 |
| `NANOBANANA_API_KEY` | No | — (image placeholder) |

## Gotchas & Common Mistakes

1. **JSON parsing uses `extractLastJsonBlock()`** — brace-depth counter, NOT regex. Nested objects break regex.
2. **API responses: use `extractResponseText(response)`** — never access `response.content[0].text` directly.
3. **Anthropic SDK `signal`** goes in the **second** argument (options), NOT in the request body: `.stream({model, ...}, { signal })`. Putting it in body causes `Extra inputs are not permitted`.
4. **Interactive CSS classes start with `.bs-`** — check `style.css` before claiming they're missing.
5. **Interactivity is data-attribute driven** — do NOT add per-renderer handler code. See [`docs/interactivity.md`](docs/interactivity.md).
6. **Room code validation** — server emits `join-error` if code not found, does NOT create new room.
7. **Port is 5000** on Replit (`.replit`), 3000 locally (`.env`). Check `config.js` for default.
8. **GitHub is source of truth** — don't modify docs/agents on Replit without syncing back.
9. **Canvas uses transform pan/zoom** — `.canvas-panel` has `overflow: hidden`, `.canvas-area` uses `transform: translate() scale()`. Do NOT use `scrollTo` — use `window._canvasPanZoom.panTo(x, y)`.
10. **"Другое..." button is auto-added** — don't add it in Claude's prompt or options array, it's appended client-side in `modules/socket-handlers.js`.
11. **Entry point is `server/index.js`** — not `server.js` (legacy). `package.json` scripts point here.
12. **Client uses ES modules** — `<script type="module" src="app.js">`. Use `import`/`export`, NOT `window.App` globals (that approach was reverted in commit d378843).
13. **All config in `config.js`** — model name, grid layout, limits, ports. Don't hardcode these values in handlers.

## Helper Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `extractLastJsonBlock(text)` | `server/utils.js` | Find last `{...}` via brace-depth counting |
| `extractResponseText(response)` | `server/utils.js` | Safe `response.content[0].text` with null check |
| `buildContext(room, socketId)` | `server/context.js` | System prompt + message history for Claude |
| `generateId()` | `server/utils.js` | Timestamp + random unique ID |
| `generateRoomId()` | `server/utils.js` | 6-char uppercase alphanumeric |
| `applyPatch(data, path, value)` | `server/utils.js` | Path-based object patching |
| `getByPath(obj, path)` | `server/utils.js` | Navigate to value at dot-separated path |
| `getClient()` | `server/claude/client.js` | Lazy-init Anthropic SDK |

## Replit Deployment

**Sync:** Local → GitHub (`b3axap/ai-brainstorm`, `deploy` branch) → Replit pulls.

**If diverged:** `git pull origin deploy` → `npm install` → restart.

**Branches:** `deploy` = production (default), `development` = active work, `archive` = v0.6 snapshot.

**Do NOT modify on Replit:** `CLAUDE.md`, `docs/*`, `agents/*.json`.

**Smoke test:** Create Room → send message → Claude responds with questions → answer → generate viz → appears on canvas.

## Current Limitations

- In-memory only (rooms lost on restart)
- No auth (room code = access)
- No persistent history / live cursors
- Image agent is placeholder
- No artifact versioning / undo
