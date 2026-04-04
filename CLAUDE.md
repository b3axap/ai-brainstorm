# AI Brainstorm — Project Guide for Claude Code

## What is this project?

A collaborative brainstorming web app where users describe ideas in a chat with Claude, then Claude generates visual artifacts (mind maps, tables, slides, diagrams, timelines, SWOT analyses, kanban boards, charts, and more). Multiple users can join the same room, see each other's artifacts on a shared canvas, and continue brainstorming together.

## Architecture

**Stack:** Node.js + Express + Socket.IO + Anthropic SDK. Vanilla JS frontend, no React, no build step.

**Core concept: "Interpreter Agents"** — each agent is a JSON file in `agents/` that defines a specialized prompt for Claude to generate a specific type of visualization. Adding a new agent = adding a new JSON file + a renderer function + CSS.

## File Structure

```
server.js          — Backend: Express server + Socket.IO events + Claude API calls
agents.js          — Loads all JSON agent files from agents/ directory at startup
agents/            — One JSON file per interpreter agent (15 agents total)
agents/_schema.json — JSON Schema for validating agent files
public/
  index.html       — SPA: landing, chat, canvas screens (display:none switching)
  app.js           — Client logic: Socket.IO, state, screen transitions, UI events
  style.css        — Dark theme, artifact cards, all renderer styles
  renderers.js     — Artifact rendering functions (15 renderers)
```

## Agent Catalog (15 agents)

### When to suggest each visualization

| Agent | ID | Icon | Best For | Trigger Keywords |
|-------|-----|------|----------|-----------------|
| **Mind Map** | `mindmap` | 🧠 | Idea breakdown, brainstorming, concept overview | structure, breakdown, brainstorm, overview, map |
| **Table** | `table` | 📊 | Comparing options, structured analysis | compare, vs, analysis, criteria, options |
| **Presentation** | `presentation` | 🎬 | Pitching ideas, stakeholder narratives | pitch, slides, present, explain, story |
| **Diagram** | `diagram` | 🔀 | Process flows, architecture, sequences | flow, process, architecture, pipeline, steps |
| **HTML Guide** | `html_guide` | 📖 | Tutorials, documentation, how-to guides | guide, tutorial, howto, documentation |
| **Image** | `image` | 🎨 | Visual illustrations (placeholder API) | image, picture, visual, illustration |
| **Freeform** | `freeform` | ✨ | Creative HTML visualizations, surprise me | anything, creative, surprise, best, auto |
| **Timeline** | `timeline` | 📅 | Roadmaps, milestones, chronological plans | timeline, roadmap, milestones, schedule, phases |
| **SWOT Analysis** | `swot` | ⚡ | Strategic analysis, evaluation | swot, strengths, weaknesses, strategic, evaluate |
| **Kanban Board** | `kanban` | 📋 | Task organization, status tracking | kanban, tasks, board, organize, status, backlog |
| **Pros & Cons** | `pros_cons` | ⚖️ | Binary comparison, tradeoff analysis | pros, cons, tradeoffs, advantages, drawbacks |
| **Priority Matrix** | `matrix` | 🎯 | Effort/impact prioritization, 2x2 grids | priority, prioritize, matrix, effort, impact |
| **Checklist** | `checklist` | ✅ | Action items, step-by-step task lists | checklist, action items, steps, todo, launch |
| **Donut Chart** | `donut_chart` | 🍩 | Proportions, distribution, composition | chart, pie, donut, distribution, percentage |
| **Insight Card** | `quote_card` | 💡 | Key takeaways, highlighted insights | insight, quote, takeaway, highlight, summary |

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
**matrix**: `{title, axisX, axisY, quadrants: [{label, items: []}]}` (order: top-left, top-right, bottom-left, bottom-right)
**checklist**: `{title, items: [{text, done: bool}]}`
**donut_chart**: `{title, centerLabel, segments: [{label, value, color}]}`
**quote_card**: `{quote, author, tag, supporting?}`

## Data Flow

1. User creates/joins room → `join-room` → server creates room in memory
2. User sends message → `send-message` → server calls Claude (streaming) → `claude-chunk` → `claude-done` with `suggestedTypes[]`, `clarifyQuestions[]`, `autoGenerate[]`
3. User picks visualization → `generate-artifact` → server uses agent prompt → Claude generates JSON → `artifact-created` → client renders on canvas
4. Other users see events in real-time via Socket.IO room broadcast

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
  "id": "timeline",
  "name": "Timeline",
  "icon": "📅",
  "description": "Chronological roadmap or milestone timeline",
  "keywords": ["timeline", "roadmap", "milestones"],
  "renderer": "timeline",
  "systemPrompt": "...",
  "outputExample": { ... },
  "externalAPI": null
}
```

### Renderer System
`renderers.js` exports `renderArtifact(type, data, container)`. Each renderer takes parsed JSON from Claude and renders into a DOM container. Renderers are pure functions: SVG, HTML tables, or vanilla DOM — no external dependencies except Mermaid.js for diagrams.

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
- `claude-done { fullMessage, suggestedTypes, clarifyQuestions, autoGenerate, confidence, reasoning }` — Final response + ranked suggestions with confidence
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
2. Add `renderYourAgent(data, container)` to `public/renderers.js` and register it in the `renderers` object
3. Add CSS styles for your renderer in `public/style.css`
4. If your agent calls an external API, handle it in `server.js:handleArtifactGeneration()` under `if (agent.externalAPI)`
5. Restart server. The agent auto-loads and appears in Chat suggestions + Canvas "New Idea" modal

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

## Design System

All renderers use CSS variables for theming:
```
--bg: #0f1117        --surface: #1a1d27      --surface2: #232733
--accent: #6c5ce7    --accent2: #a29bfe      --green: #00cec9
--orange: #fdcb6e    --pink: #fd79a8         --red: #ff6b6b
--blue: #74b9ff      --text: #e4e7f0         --text2: #8b90a0
```

Figma reference: "AI Brainstorm — Visualization Examples" contains mockups for all 12 core visualization types.

## Current Limitations (MVP)

- In-memory storage only (rooms lost on server restart)
- No authentication (room code = access)
- No persistent history
- No live cursors
- Image agent is a placeholder (no actual generation API connected)
- No artifact versioning/forking
