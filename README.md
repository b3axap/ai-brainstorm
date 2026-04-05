# 🧠 AI Brainstorm

Collaborative brainstorming app with AI-powered visualization. Describe your idea in a chat with Claude → get mind maps, tables, slides, diagrams, and more → share a canvas with your team.

## Quick Start

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
npm install
npm start
```

Open http://localhost:5000

## How It Works

1. **Create a room** — enter your name, get a 6-character room code
2. **Describe your idea** — chat with Claude, who analyzes it and suggests visualizations
3. **Pick a visualization** — Claude generates it as a structured artifact
4. **Canvas** — all artifacts appear on a shared canvas, drag to organize
5. **Collaborate** — share your room code, others join and add their own ideas

## 15 Visualization Agents

Each visualization type is powered by an "interpreter agent" — a JSON config in `agents/`:

| Agent | Type | Status |
|-------|------|--------|
| 🧠 Mind Map | SVG graph | Active |
| 📊 Table | HTML table | Active |
| 🎬 Presentation | Slide deck | Active |
| 🔀 Diagram | Mermaid chart | Active |
| 📖 Guide | HTML document | Active |
| 🎨 Image | Generated image | Placeholder |
| ✨ Freeform | Any HTML/CSS/JS | Active |
| 📅 Timeline | Roadmaps | Active |
| ⚡ SWOT | Strategic analysis | Active |
| 📋 Kanban | Task boards | Active |
| ⚖️ Pros & Cons | Tradeoffs | Active |
| 🎯 Matrix | Prioritization | Active |
| ✅ Checklist | Action items | Active |
| 🍩 Donut Chart | Proportions | Active |
| 💡 Quote Card | Takeaways | Active |

See [`docs/agents.md`](docs/agents.md) for how to add new agents.

## Architecture (v1.0.0)

Modular monolith: Node.js + Express + Socket.IO + Anthropic SDK. Vanilla JS frontend with ES modules.

```
config.js              — centralized constants
server/
  index.js             — Express entry point
  socket.js            — Socket.IO event router
  handlers/            — room, chat, artifact handlers
  claude/              — Claude API operations
  data/                — persistence layer
public/
  app.js               — ES module entry point
  modules/             — state, chat, canvas, viz-picker, etc.
  renderers.js         — 15 visualization renderers
  interactive.js       — universal interactivity engine
agents/                — 15 agent JSON configs
docs/                  — architecture, API, design system
```

See [`docs/architecture.md`](docs/architecture.md) for full details.

## Deploy on Replit

1. Import from GitHub (branch: `deploy`)
2. Add `ANTHROPIC_API_KEY` to Secrets
3. Run

## Branches

| Branch | Purpose |
|--------|---------|
| `deploy` | Production (default) |
| `development` | Active work |
| `archive` | v0.6 snapshot |

## License

MIT
