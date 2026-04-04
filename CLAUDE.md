# AI Brainstorm — Project Guide

## What is this project?

Collaborative brainstorming web app: users describe ideas in chat with Claude → Claude generates visual artifacts (mind maps, tables, diagrams, etc.) → shared canvas for teams.

## Architecture

**Stack:** Node.js + Express + Socket.IO + Anthropic SDK. Vanilla JS frontend, no build step.

**Layout:** Split-view workspace — chat (left, resizable ~350px) + canvas (right). Mobile (<768px): bottom tab bar. All interaction through chat input (📎 attach, ➕ new idea).

**Core concept:** "Interpreter Agents" — JSON files in `agents/` define prompts for each visualization type. Adding an agent = JSON + renderer function + CSS.

## File Structure

```
server.js          — Express + Socket.IO + Claude API + data patching
agents.js          — Auto-loads agent JSON files at startup
agents/            — 15 agent JSON files + _schema.json
public/
  index.html       — SPA: landing + workspace (display:none switching)
  app.js           — Client: state, Socket.IO, resize, mentions, viz picker
  style.css        — Dark theme, split-view, artifact cards, .bs-* classes
  renderers.js     — 15 renderers with data-attribute annotations + SDK
  interactive.js   — InteractiveEngine: universal interactivity via data-attributes
```

## Detailed Documentation

| Topic | File | When to read |
|-------|------|-------------|
| **Interactivity system** | [`docs/interactivity.md`](docs/interactivity.md) | Editing renderers, adding new agents, debugging inline editing |
| **Design system** | [`docs/design-system.md`](docs/design-system.md) | CSS changes, styling, Figma reference, accessibility |
| **Socket.IO API** | [`docs/socket-api.md`](docs/socket-api.md) | Changing client-server communication, data model |

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

**Artifact interaction:** Action bar (hover: Expand/Transform/Ask/Copy/PNG) + inline editing via data-attributes. See [`docs/interactivity.md`](docs/interactivity.md).

**Artifact positioning:** 2-column grid via `calcArtifactPosition(index)`, 540px width + 40px gap.

**Chat rendering:** Markdown via marked.js CDN. Auto-scroll to new artifacts.

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
3. **Interactive CSS classes start with `.bs-`** — check `style.css` before claiming they're missing.
4. **Interactivity is data-attribute driven** — do NOT add per-renderer handler code. See [`docs/interactivity.md`](docs/interactivity.md).
5. **Room code validation** — server emits `join-error` if code not found, does NOT create new room.
6. **Port is 5000** — `.replit`, `server.js`, `.claude/launch.json` all use 5000.
7. **GitHub is source of truth** — don't modify docs/agents on Replit without syncing back.

## Helper Functions (server.js)

| Function | Purpose |
|----------|---------|
| `extractLastJsonBlock(text)` | Find last `{...}` via brace-depth counting |
| `extractResponseText(response)` | Safe `response.content[0].text` with null check |
| `buildContext(room, socketId)` | System prompt + message history for Claude |
| `generateId()` | Timestamp + random unique ID |
| `generateRoomId()` | 6-char uppercase alphanumeric |

## Replit Deployment

**Sync:** Local → GitHub (`b3axap/ai-brainstorm`, `master`) → Replit pulls.

**If diverged:** `git pull origin master` → `npm install` → restart.

**Do NOT modify on Replit:** `CLAUDE.md`, `docs/*`, `design.md`, `agents/*.json`.

**Smoke test:** Create Room → send message → Claude responds with questions → answer → generate viz → appears on canvas.

## Current Limitations

- In-memory only (rooms lost on restart)
- No auth (room code = access)
- No persistent history / live cursors
- Image agent is placeholder
- No artifact versioning / undo
