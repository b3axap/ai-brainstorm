# AI Brainstorm — Project Guide for Claude Code

## What is this project?

A collaborative brainstorming web app where users describe ideas in a chat with Claude, then Claude generates visual artifacts (mind maps, tables, slides, diagrams, HTML guides, images). Multiple users can join the same room, see each other's artifacts on a shared canvas, and continue brainstorming together.

## Architecture

**Stack:** Node.js + Express + Socket.IO + Anthropic SDK. Vanilla JS frontend, no React, no build step.

**Core concept: "Interpreter Agents"** — each agent is a JSON file in `agents/` that defines a specialized prompt for Claude to generate a specific type of visualization. Adding a new agent = adding a new JSON file.

## File Structure

```
server.js         — Entire backend: Express static server + Socket.IO events + Claude API calls
agents.js         — Loads all JSON agent files from agents/ directory at startup
agents/           — One JSON file per interpreter agent (mindmap, table, presentation, diagram, html_guide, image, freeform)
agents/_schema.json — JSON Schema for validating agent files
public/
  index.html      — SPA with 3 screens: landing, chat, canvas (no routing, display:none switching)
  app.js          — All client logic: Socket.IO, state management, screen transitions, UI events
  style.css       — Dark theme styles, artifact cards, renderers
  renderers.js    — Artifact rendering functions (mind map SVG, table HTML, slides, mermaid diagrams, iframes)
```

## Data Flow

1. User creates/joins room → `join-room` socket event → server creates room in memory
2. User sends message → `send-message` → server calls Claude (streaming) → `claude-chunk` events → `claude-done` with suggested visualization types
3. User picks visualization type → `generate-artifact` → server uses agent prompt → Claude generates structured JSON → `artifact-created` → client renders on canvas
4. Other users see all events in real-time via Socket.IO room broadcast

## Key Patterns

### Context Management
Every Claude call includes full room context via `buildContext(room)`:
- All chat messages (trimmed to first 5 + last 30 if >50)
- List of existing artifacts (type + title)
- List of active users

### Agent System
Agents are JSON files auto-loaded from `agents/` directory:
```json
{
  "id": "mindmap",
  "name": "Mind Map",
  "icon": "🧠",
  "systemPrompt": "...",     // Claude prompt
  "renderer": "mindmap",      // Key in renderers.js
  "externalAPI": null          // Or { provider, endpoint, envKey }
}
```

### Renderer System
`renderers.js` exports a `renderArtifact(type, data, container)` function. Each renderer takes parsed JSON from Claude and renders it into a DOM container.

### Socket.IO Event Contract

**Client → Server:**
- `join-room { roomId?, userName }` — Create or join room
- `send-message { roomId, content }` — Chat message → triggers Claude
- `generate-artifact { roomId, type }` — Generate visualization
- `move-artifact { roomId, artifactId, position }` — Drag artifact
- `canvas-message { roomId, content }` — Mini-chat on canvas

**Server → Client:**
- `room-joined { room, user }` — Full room state
- `user-joined / user-left` — Presence updates
- `new-message { message }` — Chat message broadcast
- `claude-chunk { chunk }` — Streaming token
- `claude-done { fullMessage, suggestedTypes }` — Final response + suggested agents
- `artifact-created { artifact }` — New artifact for canvas
- `artifact-moved { artifactId, position }` — Position sync

## In-Memory Data Model

```js
rooms[roomId] = {
  id: string,           // 6-char alphanumeric
  messages: [{
    id, role, content, userName, timestamp
  }],
  artifacts: [{
    id, type, title, data, author, renderer, icon, timestamp,
    position: { x, y }
  }],
  users: [{ socketId, name, color }]
}
```

## Adding a New Agent

1. Create `agents/your_agent.json` following `agents/_schema.json`
2. If your agent needs a new renderer, add `renderYourAgent(data, container)` to `public/renderers.js` and register it in the `renderers` object
3. If your agent calls an external API, add the API key name to `.env.example` and handle it in `server.js:handleArtifactGeneration()` under the `if (agent.externalAPI)` branch
4. Restart server. The agent auto-loads and appears in Chat suggestions + Canvas "New Idea" modal

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
- `PORT` (optional, default 3000)

## Current Limitations (MVP)

- In-memory storage only (rooms lost on server restart)
- No authentication (room code = access)
- No persistent history
- No live cursors
- Image agent is a placeholder (no actual generation API connected)
- No artifact versioning/forking
