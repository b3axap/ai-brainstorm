# AI Brainstorm — Project Guide

## What is this project?

A collaborative brainstorming web app where users describe ideas in a chat with Claude, then Claude generates visual artifacts (mind maps, tables, slides, diagrams, timelines, SWOT analyses, kanban boards, charts, and more). Multiple users can join the same room, see each other's artifacts on a shared canvas, and continue brainstorming together.

## Architecture

**Stack:** Node.js + Express + Socket.IO + Anthropic SDK. Vanilla JS frontend, no React, no build step.

**Core concept: "Interpreter Agents"** — each agent is a JSON file in `agents/` that defines a specialized prompt for Claude to generate a specific type of visualization. Adding a new agent = adding a new JSON file + a renderer function + CSS.

**Layout:** Split-view workspace — chat panel (left, resizable ~350px) + canvas panel (right) displayed simultaneously. All interaction happens through chat (no header buttons). Chat input has 📎 (attach files) and ➕ (new idea) action icons. Mobile (<768px): bottom tab bar switches between panels.

## File Structure

```
server.js          — Backend: Express server + Socket.IO events + Claude API calls
agents.js          — Loads all JSON agent files from agents/ directory at startup
agents/            — One JSON file per interpreter agent (15 agents total)
agents/_schema.json — JSON Schema for validating agent files
public/
  index.html       — SPA: landing + workspace split-view (display:none switching)
  app.js           — Client logic: Socket.IO, state, resize handle, @ mentions, viz picker
  style.css        — Dark theme, split-view grid, artifact cards, interactive controls
  renderers.js     — Artifact rendering functions (15 renderers) + Brainstorm iframe SDK
  interactive.js   — InteractiveEngine: universal interactivity via data-attribute protocol
```

## Agent Catalog (15 agents)

### When to suggest each visualization

| Agent | ID | Icon | Best For |
|-------|-----|------|----------|
| **Mind Map** | `mindmap` | 🧠 | Idea breakdown, concept overview |
| **Table** | `table` | 📊 | Comparing options, structured analysis |
| **Presentation** | `presentation` | 🎬 | Pitching ideas, narratives |
| **Diagram** | `diagram` | 🔀 | Process flows, architecture |
| **HTML Guide** | `html_guide` | 📖 | Tutorials, documentation |
| **Image** | `image` | 🎨 | Visual illustrations (placeholder) |
| **Freeform** | `freeform` | ✨ | Creative HTML, custom widgets |
| **Timeline** | `timeline` | 📅 | Roadmaps, milestones |
| **SWOT Analysis** | `swot` | ⚡ | Strategic analysis |
| **Kanban Board** | `kanban` | 📋 | Task organization |
| **Pros & Cons** | `pros_cons` | ⚖️ | Tradeoff analysis |
| **Priority Matrix** | `matrix` | 🎯 | Effort/impact prioritization |
| **Checklist** | `checklist` | ✅ | Action items, task lists |
| **Donut Chart** | `donut_chart` | 🍩 | Proportions, distribution |
| **Insight Card** | `quote_card` | 💡 | Key takeaways |

### Agent JSON Output Schemas

**mindmap**: `{center, branches: [{label, children: [string]}]}`
**table**: `{title, columns: [string], rows: [[string | {text, tag}]]}`
**presentation**: `{title, slides: [{title, bullets: [string]}]}`
**diagram**: `{title, mermaid: "mermaid.js code string"}`
**html_guide**: `{html: "full HTML string"}`
**image**: `{prompt, style}` → external API
**freeform**: `{html: "full standalone HTML"}`
**timeline**: `{title, milestones: [{label, date, description, status: done|current|upcoming}]}`
**swot**: `{title, strengths: [], weaknesses: [], opportunities: [], threats: []}`
**kanban**: `{title, columns: [{name, cards: [{title, tag}]}]}`
**pros_cons**: `{title, pros: [], cons: [], verdict?}`
**matrix**: `{title, axisX, axisY, quadrants: [{label, items: []}]}`
**checklist**: `{title, items: [{text, done: bool}]}`
**donut_chart**: `{title, centerLabel, segments: [{label, value, color}]}`
**quote_card**: `{quote, author, tag, supporting?}`

## Data Flow

1. User creates/joins room → `join-room` → server creates room in memory → workspace split-view appears
2. User sends message → `send-message` → server calls Claude (streaming) → `claude-chunk` → `claude-done`
3. User clicks ➕ in chat → enters "new idea" mode → sends message with `isNewIdea: true` → Claude analyzes the new idea, connects it to existing brainstorm, and suggests visualizations
4. Claude may return `canvas_action` in JSON → client shows one-click action button → user confirms → `execute-canvas-action`
5. User picks visualization from picker modal (opened via Claude's "Choose more visualizations..." button) → `generate-artifact` → server uses agent prompt → Claude generates JSON → `artifact-created` → client renders on canvas
6. User interacts with artifact → action bar (Expand/Transform/Ask) → `artifact-action` → server calls Claude → `artifact-updated`
7. User edits inline (any visualization) → `artifact-data-patch` or `artifact-array-op` → server patches data → `artifact-updated` broadcast to all users

## Key Patterns

### Split-View Workspace
- CSS Grid: `grid-template-columns: 350px 4px 1fr`
- Resize handle between chat and canvas panels
- Mobile (<768px): absolute-positioned panels, bottom tab bar switches via `.show-canvas` class

### Artifact Interaction
Each artifact card has:
- **Action bar** (hover): Expand, Transform, Ask, Copy (JSON to clipboard), PNG (screenshot via html2canvas)
- **Universal inline editing** (via InteractiveEngine): all 15 visualizations are interactive — see "Interactivity System" section below
- **Ask bar**: mini input at bottom of card for artifact-specific questions

### Artifact Positioning
New artifacts are placed in a 2-column grid (540px card width + 40px gap) via `calcArtifactPosition(index)`. No random overlap.

### Chat Rendering
Claude messages render as Markdown (via marked.js CDN) — bold, lists, code blocks, headings all display correctly. User messages stay plain text. After `artifact-created`, canvas auto-scrolls to the new card.

### @ Mentions
User types `@` in chat → autocomplete dropdown shows artifacts from `state.artifacts` → selecting inserts `@Title`. Server resolves mentions to inject artifact data into Claude's context.

### Canvas Actions (Chat → Canvas)
Claude can detect canvas intent in messages and return `canvas_action` in JSON response:
- `{intent: "create", artifact_type: "mindmap"}` — create new artifact
- `{intent: "update", target_id: "<id>", instruction: "add X"}` — modify existing
- `{intent: "transform", target_id: "<id>", artifact_type: "presentation"}` — convert type

Client shows a confirmation button; user clicks to execute.

### Context Management
Every Claude call includes full room context via `buildContext(room, socketId)`:
- Per-user chat messages (trimmed to first 5 + last 30 if >50)
- List of existing artifacts (type + title + id)
- List of active users

### Chat Behavior (Adaptive, No Rigid Phases)
Claude acts as a creative brainstorming partner, not a questionnaire. One adaptive prompt governs all interactions:

- **First message**: Claude shows it understood the idea (1-2 sentences), adds its own angle or observation, asks 1-4 questions only if genuinely needed. If the idea is already detailed, can skip questions and suggest visualizations immediately.
- **Ongoing**: Claude develops ideas, suggests alternatives, plays devil's advocate. Questions only when actually needed (0-2 at a time). Visualizations suggested whenever enough context has accumulated — no timer or counter.
- **New idea** (➕ button): User introduces an additional idea. Claude analyzes it, finds connections with existing brainstorm, and suggests integrations + visualizations.
- **Questions with options**: If a question has obvious answer variants (yes/no, clear choices), Claude provides clickable option buttons. Open-ended questions have no options. The user can always type a custom answer regardless.
- **JSON is fully optional**: Claude includes `questions`, `suggest`, `offer_canvas`, `canvas_action` only when relevant. All fields are optional. No phase tracking.

### Agent System
Agents are JSON files auto-loaded from `agents/` directory. Each has: id, name, icon, description, keywords, renderer, systemPrompt, outputExample, externalAPI.

### Renderer System
`renderers.js` exports `renderArtifact(type, data, container)`. Pure functions — SVG, HTML tables, or vanilla DOM. Every renderer annotates its output with `data-*` attributes (see Interactivity System). `InteractiveEngine` reads these attributes and attaches handlers generically. Also contains `BRAINSTORM_SDK_SCRIPT` — a small JS SDK injected into freeform/html_guide iframes.

### Socket.IO Event Contract

**Client → Server:**
- `join-room { roomId?, userName }` — Create or join room
- `send-message { roomId, content, isNewIdea?, files? }` — Chat message → triggers Claude. `isNewIdea` activates new-idea agent. `files` is array of `{name, type, data (base64), isImage}` (max 5, max 10MB each). Images sent to Claude as vision; text files decoded and inlined.
- `generate-artifact { roomId, type, referenceIds?, customPrompt? }` — Generate visualization (optionally referencing other artifacts)
- `move-artifact { roomId, artifactId, position }` — Drag artifact
- `artifact-action { roomId, artifactId, action: 'expand'|'transform'|'ask', payload? }` — Artifact manipulation
- `artifact-data-patch { roomId, artifactId, patch: {path, value} }` — Inline edit (scalar value at dot-path)
- `artifact-array-op { roomId, artifactId, op: {type, path, value?, toPath?} }` — Array operations: insert/remove/move
- `execute-canvas-action { roomId, canvasAction }` — Execute Claude's suggested canvas action

**Server → Client:**
- `room-joined { room, user }` — Full room state (personal chat + shared artifacts)
- `user-joined / user-left` — Presence updates
- `new-message { message }` — Chat message
- `claude-chunk { chunk }` — Streaming token
- `claude-done { fullMessage, suggestedTypes, clarifyQuestions, offerCanvas, canvasAction }` — Final response (all fields optional)
- `artifact-created { artifact }` — New artifact for canvas
- `artifact-updated { artifactId, data, title }` — Updated artifact (re-render)
- `artifact-moved { artifactId, position }` — Position sync
- `generation-error { message }` — Error notification

## In-Memory Data Model

```js
rooms[roomId] = {
  id: string,
  messages: [],         // shared activity log (capped at 200)
  artifacts: [{
    id, type, title, data, author, renderer, icon, timestamp,
    position: { x, y }
  }],
  users: [{ socketId, name, color }],
  userChats: {          // per-user private chat
    [socketId]: {
      messages: [],     // capped at 200
      phase: { msgCount }
    }
  }
}
```

## Adding a New Agent

1. Create `agents/your_agent.json` following `agents/_schema.json`
2. Add `renderYourAgent(data, container)` to `public/renderers.js` and register in the `renderers` object
3. **Annotate your renderer's HTML output with data-attributes** for interactivity (see table below). No changes to `interactive.js` needed — the engine picks them up automatically.
4. Add CSS styles for your renderer in `public/style.css`
5. Restart server. The agent auto-loads and appears in the visualization picker.

## Running Locally

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY
npm install
npm start
# Open http://localhost:3000
```

## Environment Variables

- `ANTHROPIC_API_KEY` (required) — Anthropic API key for Claude
- `NANOBANANA_API_KEY` (optional) — Image generation API (placeholder)
- `PORT` (optional, default 5000 on Replit, 3000 locally)

## Design System

All renderers use CSS variables for theming:
```
--bg: #0f1117        --surface: #1a1d27      --surface2: #232733
--accent: #6c5ce7    --accent2: #a29bfe      --green: #00cec9
--orange: #fdcb6e    --pink: #fd79a8         --red: #ff6b6b
--blue: #74b9ff      --text: #e4e7f0         --text2: #9ea3b5
```

Placeholder color: `#6a7086` (dedicated, no opacity reduction).

Figma reference: see `design.md` for full frame map and Figma file link.

## Accessibility (WCAG 2.1 AA)

The app follows WCAG 2.1 AA guidelines:

- **Contrast**: `--text2` (#9ea3b5) achieves ≥4.5:1 on all surface colors. Placeholder text (#6a7086) achieves ≥3:1.
- **Focus indicators**: All interactive elements have `:focus-visible` outlines (2px solid `--accent2`, 2px offset). Inputs get a box-shadow ring.
- **Semantic HTML**: `<header>`, `<main>`, `<aside>`, `<section>`, `<nav>` landmarks. Room code is a `<button>` not a span.
- **ARIA attributes**: `aria-label` on inputs without visible labels, `aria-live="polite"` on chat messages and toast, `role="alert"` on error messages, `role="dialog" aria-modal="true"` on modals.
- **Touch targets**: Mobile buttons enforce `min-height: 44px` via media query.
- **Resize handle**: Has `role="separator"`, `tabindex="0"`, keyboard-accessible.

## Concurrency Model

- **Per-socket request lock**: only one Claude stream per user at a time
- **AbortController per stream**: in-flight calls aborted on disconnect
- **Duplicate user prevention**: `join-room` checks existing socketId
- **Message cap**: both shared and per-user histories trimmed to 200
- **Room cleanup**: cancellable 5-min timer for empty rooms

## Replit Deployment Notes

**Sync workflow:** Code is developed locally → pushed to GitHub (`b3axap/ai-brainstorm`, `master`) → Replit pulls from GitHub.

**If Replit code diverges from GitHub:**
1. `git pull origin master` — pull latest
2. `npm install` — in case deps changed
3. Restart server

**Do NOT modify on Replit without syncing back:**
- `CLAUDE.md`, `design.md` — documentation source of truth is local/GitHub
- `agents/*.json` — agent definitions are part of the architecture
- `.replit`, `replit.nix` — deployment config, change only if deploy breaks

**Replit Secrets required:** `ANTHROPIC_API_KEY`

**Quick smoke test:** Open app → enter name → Create Room → send a message → Claude should stream a response with questions → answer → generate visualization → it appears on canvas.

## Interactivity System (Data-Attribute Protocol)

All 15 visualization types are fully interactive. Instead of per-renderer handler functions, renderers **declare** what's interactive via `data-*` attributes, and `InteractiveEngine` (in `interactive.js`) provides the behavior generically.

### Data-Attribute Protocol

| Attribute | User Action | Effect | Example |
|-----------|-------------|--------|---------|
| `data-edit="path"` | Double-click | Inline text input, emits `artifact-data-patch` | `data-edit="branches.0.label"` |
| `data-edit-multiline="path"` | Double-click | Textarea input (Ctrl+Enter to save) | `data-edit-multiline="quote"` |
| `data-toggle="path"` | Click | Flips boolean value | `data-toggle="items.2.done"` |
| `data-cycle="path"` + `data-cycle-values='[...]'` | Click | Cycles to next value in array | `data-cycle="milestones.0.status"` |
| `data-add="arrayPath"` + `data-add-template='json'` | Click "+" | Appends template to array, emits `artifact-array-op` | `data-add="branches"` |
| `data-delete="path"` | Click "x" | Removes item from array, emits `artifact-array-op` | `data-delete="branches.2"` |
| `data-drag-item="path"` | Drag | Draggable element (HTML5 drag API) | `data-drag-item="columns.0.cards.1"` |
| `data-drag-target="arrayPath"` | Drop | Receives dragged items, emits `artifact-array-op` move | `data-drag-target="columns.1.cards"` |

### How to make a new renderer interactive

Just add these attributes in your renderer HTML. The engine handles everything:

```js
function renderMyViz(data, container) {
  let html = '<div class="my-viz">';

  // Editable title
  html += `<h3 data-edit="title">${escapeHtml(data.title)}</h3>`;

  // List with add/delete/edit
  data.items.forEach((item, i) => {
    html += `<div data-delete="items.${i}">
      <span data-edit="items.${i}.text">${escapeHtml(item.text)}</span>
      <span data-toggle="items.${i}.done">${item.done ? '✓' : '○'}</span>
    </div>`;
  });

  // Add button
  html += `<div data-add="items" data-add-template='${escapeHtml(JSON.stringify({text:"New",done:false}))}' class="bs-add-zone">+ Add</div>`;

  html += '</div>';
  container.innerHTML = html;
}
```

No changes to `interactive.js` needed. The engine scans the container after render.

### Interactivity per renderer

| Renderer | Edit | Toggle | Cycle | Add/Delete | Drag |
|----------|------|--------|-------|------------|------|
| **mindmap** | center, branch labels, child labels | — | — | branches, children | — |
| **table** | cells, column headers | — | — | rows | — |
| **presentation** | slide titles, bullets | — | — | bullets, slides | — |
| **diagram** | mermaid source (code editor overlay) | — | — | — | — |
| **timeline** | labels, dates, descriptions | — | status (upcoming→current→done) | milestones | — |
| **swot** | items per quadrant | — | — | items per quadrant | — |
| **kanban** | card titles, column names | — | — | cards per column | cards between columns |
| **checklist** | item text, title | done toggle | — | items | — |
| **pros_cons** | pros, cons, verdict, title | — | — | pros, cons | — |
| **matrix** | quadrant labels, items, axes | — | — | items per quadrant | items between quadrants |
| **donut_chart** | segment labels, values, center label | — | — | segments | — |
| **quote_card** | quote (multiline), author, supporting | — | tag type | — | — |
| **image** | prompt, style | — | — | — | — |
| **freeform** | via Brainstorm SDK | via SDK | — | via SDK | — |
| **html_guide** | via Brainstorm SDK | via SDK | — | via SDK | — |

### Server-side: `artifact-array-op`

Alongside the existing `artifact-data-patch` (scalar edits), the server handles `artifact-array-op`:

```
{ roomId, artifactId, op: { type: 'insert'|'remove'|'move', path, value?, toPath? } }
```

- **insert**: appends `value` to the array at `path`
- **remove**: splices item at `path` (e.g. `"branches.2"` removes index 2)
- **move**: removes from `path`, appends to `toPath` (used by drag-and-drop)

All ops broadcast `artifact-updated` with full data to the room.

### Brainstorm SDK (for freeform / html_guide iframes)

Iframes get a pre-injected `window.brainstorm` object that communicates with the parent via `postMessage`:

```js
// Make any element's text editable — on blur, sends patch to server
brainstorm.markEditable(element, 'path.to.field');

// Programmatic data changes
brainstorm.edit('path', value);           // scalar patch
brainstorm.add('arrayPath', newItem);     // append to array
brainstorm.delete('arrayPath', index);    // remove from array

// React to changes from other users
brainstorm.onUpdate(data => { /* re-render */ });

// Get current artifact data
const data = await brainstorm.getData();
```

The freeform agent's system prompt documents this SDK so Claude automatically uses `brainstorm.markEditable()` to make generated content interactive.

### InteractiveEngine lifecycle

1. Renderer outputs HTML with data-attributes into `.artifact-body`
2. `new InteractiveEngine(card, artifact, socket)` scans the body, attaches handlers
3. User interacts → engine emits `artifact-data-patch` or `artifact-array-op`
4. Server patches data, broadcasts `artifact-updated`
5. Client re-renders body, creates new `InteractiveEngine` (old one auto-destroyed)
6. For iframes: engine also forwards data via `postMessage` → SDK's `onUpdate` callbacks fire

### SVG editing (mindmap)

SVG `<text>` elements with `data-edit` get special handling: the engine injects a `<foreignObject>` with an `<input>` overlay. Same UX as DOM editing, but adapted for SVG coordinate system.

### CSS classes

| Class | Purpose |
|-------|---------|
| `.bs-input` | Inline edit input/textarea |
| `.bs-editing` | Element currently being edited (outline) |
| `.bs-add-btn` | Small "+" button (hover-reveal, positioned absolute) |
| `.bs-add-zone` | Dashed "+" area (click to add, used in renderers) |
| `.bs-delete-btn` | Small "x" button (hover-reveal, positioned absolute) |
| `.bs-dragging` | Element currently being dragged |
| `.bs-drag-over` | Drop target being hovered |
| `.bs-interactive` | Clickable toggle/cycle element |

## Gotchas & Common Mistakes

**Before changing anything, check these:**

1. **JSON parsing uses `extractLastJsonBlock()`** (server.js) — a brace-depth counter, NOT regex. Do not replace with regex — nested objects like `{"questions":[{"q":"...","options":["A","B"]}]}` break simple regex patterns.

2. **All API response access must use `extractResponseText(response)`** (server.js) — safely extracts `response.content[0].text`. Do NOT access `response.content[0].text` directly.

3. **All interactive CSS classes start with `.bs-`** — `.bs-input`, `.bs-editing`, `.bs-add-btn`, `.bs-add-zone`, `.bs-delete-btn`, `.bs-dragging`, `.bs-drag-over`, `.bs-interactive`, `.bs-edit-code-btn`, `.bs-add-slide-btn`. Check style.css before claiming they're missing.

4. **Interactivity is data-attribute driven** — renderers use `data-edit`, `data-toggle`, `data-add`, `data-delete`, `data-drag-item`, `data-drag-target`. `InteractiveEngine` (interactive.js) handles all of them generically. Do NOT add per-renderer handler code.

5. **Room code validation** — if `roomId` is provided but not found, server emits `join-error`, does NOT create a new room.

6. **Port is 5000** — `.replit` sets `PORT="5000"` and `localPort=5000`. server.js default is also 5000. Do not change to 3000.

7. **Source of truth is GitHub** — after making changes on Replit, always sync back. `CLAUDE.md`, `design.md`, and `agents/*.json` should not be modified on Replit without pushing to GitHub.

## Helper Functions Reference (server.js)

| Function | Purpose | Do NOT reinvent |
|----------|---------|-----------------|
| `extractLastJsonBlock(text)` | Finds last `{...}` in text via brace-depth counting | JSON extraction from Claude responses |
| `extractResponseText(response)` | Safe `response.content[0].text` access with null check | API response reading |
| `buildContext(room, socketId)` | Builds system prompt + message history for Claude calls | Context assembly |
| `generateId()` | Timestamp + random ID | Unique IDs for messages/artifacts |
| `generateRoomId()` | 6-char uppercase alphanumeric | Room codes |

## Current Limitations (MVP)

- In-memory storage only (rooms lost on server restart)
- No authentication (room code = access)
- No persistent history
- No live cursors
- Image agent is a placeholder
- No artifact versioning/forking
- No undo/redo for inline edits
