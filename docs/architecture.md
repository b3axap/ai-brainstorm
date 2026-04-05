# Architecture (v1.0.0 — Modular Monolith)

## Overview

AI Brainstorm is a collaborative brainstorming app where users chat with Claude and generate visual artifacts on a shared canvas. The architecture follows a **modular monolith** pattern: one deployable unit, but with clear module boundaries and explicit dependencies.

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│                                                         │
│  app.js (entry) ──imports──▶ modules/                   │
│    ├── state.js        shared state + socket            │
│    ├── landing.js      landing screen                   │
│    ├── chat.js         messages, streaming, files        │
│    ├── canvas.js       artifact cards, drag, pan/zoom   │
│    ├── viz-picker.js   visualization modal              │
│    ├── mentions.js     @ autocomplete                   │
│    └── socket-handlers.js  all socket.on events         │
│                                                         │
│  renderers.js    15 visualization renderers (global)    │
│  interactive.js  InteractiveEngine (global)             │
│                                                         │
│  CDN: socket.io, marked.js, mermaid.js                  │
└────────────────────────┬────────────────────────────────┘
                         │ Socket.IO
┌────────────────────────▼────────────────────────────────┐
│                     Node.js Server                      │
│                                                         │
│  server/index.js (entry) ── Express + HTTP + static     │
│    └── socket.js ── event router (thin dispatcher)      │
│          ├── handlers/room.js       join, disconnect    │
│          ├── handlers/chat.js       messages, files     │
│          └── handlers/artifact.js   CRUD, patches       │
│                │                                        │
│                ▼                                        │
│          claude/                                        │
│            ├── client.js           SDK, concurrency     │
│            ├── chat-analysis.js    streaming chat       │
│            ├── artifact-ops.js     expand/transform/ask │
│            └── generation.js       JSON generation      │
│                │                                        │
│                ▼                                        │
│          context.js    ── buildContext (prompts)         │
│          data/memory.js ── in-memory store              │
│                                                         │
│  config.js   ── all constants                           │
│  agents.js   ── loads agent JSON files                  │
└─────────────────────────────────────────────────────────┘
```

## Module Dependency Rules

1. **`config.js`** has no dependencies — imported by everything
2. **`server/utils.js`** depends only on `config.js`
3. **Handlers** depend on `data/memory.js` + `claude/*` — never on each other
4. **`claude/*` modules** depend on `utils.js`, `context.js`, `agents.js` — never on handlers
5. **`socket.js`** is a thin router — imports handlers, no business logic
6. **Client modules** import from `state.js` and `utils.js` — never from each other's internal state

## Data Flow

### Chat Message → Claude Response

```
User types → chat.js sendChatMessage()
  → socket.emit('send-message')
    → server: handlers/chat.js
      → validates files, stores message
      → claude/chat-analysis.js handleChatAnalysis()
        → context.js buildContext() (system prompt + per-user history)
        → claude/client.js getClient().messages.stream()
        → streaming: socket.emit('claude-chunk') per token
        → parse JSON block at end (extractLastJsonBlock)
        → socket.emit('claude-done') with structured data
  → client: socket-handlers.js
    → chat.js endStreaming() renders final markdown
    → renders questions as clickable buttons
    → renders visualization suggestions
```

### Artifact Generation

```
User picks visualization type → viz-picker.js
  → socket.emit('generate-artifact')
    → server: handlers/artifact.js
      → claude/generation.js handleArtifactGeneration()
        → loads agent JSON (systemPrompt + outputExample)
        → Claude generates JSON data
        → retry logic if JSON parsing fails
        → calcArtifactPosition() for 2-column grid
        → io.to(roomId).emit('artifact-created')
  → client: socket-handlers.js
    → canvas.js renderArtifactCard()
      → renderers.js renders HTML/SVG with data-* attributes
      → new InteractiveEngine(card, artifact, socket)
      → pan canvas to new artifact
```

### Inline Edit

```
User double-clicks text → InteractiveEngine detects data-edit="path"
  → creates inline <input> overlay
  → user types, presses Enter
    → socket.emit('artifact-data-patch', { path, value })
      → server: handlers/artifact.js handleDataPatch()
        → utils.js applyPatch() modifies artifact.data
        → io.to(roomId).emit('artifact-updated')
  → client: socket-handlers.js
    → re-renders artifact body
    → new InteractiveEngine (old destroyed)
```

## Server Module Details

### `server/index.js`
Express app, static file serving, health check, `/api/agents` endpoint. Calls `initSocket(io)`.

### `server/socket.js`
Thin event router. Maps socket events to handler functions. No business logic — just dispatch.

### `server/handlers/`
- **room.js**: Room lifecycle (create, join, disconnect, cleanup timer)
- **chat.js**: Message validation, file caps, triggers Claude
- **artifact.js**: All artifact CRUD + delegates to `claude/*` for AI operations

### `server/claude/`
- **client.js**: Lazy Anthropic SDK init, per-socket concurrency locks + AbortController
- **chat-analysis.js**: Builds the big system prompt, streams response, parses JSON block
- **artifact-ops.js**: expand (add detail), transform (convert type), ask (modify by question)
- **generation.js**: Generates artifact JSON from agent prompt, with retry on parse failure

### `server/context.js`
Builds Claude's context: system prompt with room info + per-user message history (multimodal support for images/text files).

### `server/data/memory.js`
In-memory rooms store. Exports: `getRoom`, `createRoom`, `deleteRoom`. Interface is ready for a persistence layer (SQLite).

## Client Module Details

### `public/app.js`
Entry point. Imports and initializes all modules. `<script type="module">`.

### `public/modules/state.js`
Single source of truth: `state` object + `socket` instance. Loaded first via import chain.

### `public/modules/utils.js`
Pure utility functions: `escHtml`, `renderMarkdown`, `showToast`, `showScreen`.

### `public/modules/landing.js`
Landing screen: Create Room / Join Room buttons, name/code inputs.

### `public/modules/chat.js`
Chat UI: message rendering, streaming (start/append/end), file attachment, new idea mode.

### `public/modules/canvas.js`
The largest module. Handles:
- Artifact card rendering + action bar
- Drag to reposition
- Expand popup (full-screen artifact view)
- Transform dropdown
- Pan/zoom (Miro-like: scroll=pan, Ctrl+wheel=zoom, Space+drag=pan)
- Resize handle (chat/canvas split)
- Mobile tabs

### `public/modules/viz-picker.js`
Modal for choosing visualization types. Checkbox grid, reference artifact selector, custom prompt.

### `public/modules/mentions.js`
@ mention autocomplete dropdown in chat input. Filters artifacts by title/type.

### `public/modules/socket-handlers.js`
All `socket.on(...)` event handlers. Wires server events to UI updates. Renders Claude's structured responses (questions, suggestions, canvas actions).

### `public/renderers.js` (global script)
15 renderer functions, each takes `(data, container)` and outputs HTML/SVG with `data-*` attributes. Registered in `renderers` object, accessed as `renderArtifact(type, data, container)`.

### `public/interactive.js` (global script)
`InteractiveEngine` class. Scans `data-*` attributes, attaches event handlers for inline editing, toggles, drag-and-drop. See [`interactivity.md`](interactivity.md).

## Configuration

All constants live in `config.js`:

| Group | Values |
|-------|--------|
| **Claude API** | model name, token limits (chat: 1500, generation: 3000) |
| **Canvas grid** | 2 columns, 540px width, 360px height, 40px gap |
| **Limits** | 200 messages cap, 5 files max, 10MB file size |
| **Room cleanup** | 5 minutes after empty |
| **User colors** | 8 preset colors for user avatars |

## Adding New Functionality

### New socket event
1. Add handler function in `server/handlers/` (existing file or new)
2. Register event in `server/socket.js`
3. Add client handler in `public/modules/socket-handlers.js`

### New Claude operation
1. Add function in `server/claude/` (existing file or new)
2. Use `claude.getClient()` for API calls, `config.claude.model` for model
3. Call from handler in `server/handlers/`

### New client feature
1. Create module in `public/modules/`
2. Import `{ state, socket }` from `./state.js`
3. Export `init*()` function
4. Import and call in `public/app.js`

### New agent
See [`agents.md`](agents.md).
