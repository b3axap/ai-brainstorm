# 🧠 AI Brainstorm

Collaborative brainstorming app with AI-powered visualization. Describe your idea in a chat with Claude → get mind maps, tables, slides, diagrams, and more → share a canvas with your team.

## Quick Start

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
npm install
npm start
```

Open http://localhost:3000

## How It Works

1. **Create a room** — enter your name, get a 6-character room code
2. **Describe your idea** — chat with Claude, who analyzes it and suggests visualizations
3. **Pick a visualization** — Claude generates it as a structured artifact
4. **Canvas** — all artifacts appear on a shared canvas, drag to organize
5. **Collaborate** — share your room code, others join and add their own ideas

## Interpreter Agents

Each visualization type is powered by an "interpreter agent" — a JSON config in `agents/`:

| Agent | Output | Status |
|-------|--------|--------|
| 🧠 Mind Map | SVG graph | ✅ Active |
| 📊 Table | HTML table | ✅ Active |
| 📽️ Slides | Slide deck | ✅ Active |
| 📐 Diagram | Mermaid chart | ✅ Active |
| 📖 Guide | HTML document | ✅ Active |
| 🎨 Image | Generated image | 🔜 Placeholder |
| ✨ Freeform | Any HTML/CSS/JS | ✅ Active |

### Adding a New Agent

Create a JSON file in `agents/`:

```json
{
  "id": "your_agent",
  "name": "Your Agent",
  "icon": "🔮",
  "description": "What it does",
  "keywords": ["when", "to", "suggest", "it"],
  "renderer": "existing_renderer_or_new",
  "systemPrompt": "Prompt for Claude...",
  "externalAPI": null
}
```

Restart server. Done.

## Tech Stack

- **Backend:** Express + Socket.IO + Anthropic SDK
- **Frontend:** Vanilla JS (no build step)
- **Real-time:** Socket.IO for multi-user sync
- **AI:** Claude Sonnet via Anthropic API
- **Diagrams:** Mermaid.js (CDN)

## Deploy on Replit

1. Import from GitHub
2. Add `ANTHROPIC_API_KEY` to Secrets
3. Run

## License

MIT
