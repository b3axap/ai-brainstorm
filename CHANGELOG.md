# Changelog

## v1.0.0 — Modular Architecture (2026-04-05)

Major refactor: monolithic codebase decomposed into clean modules.

**Server:** `server.js` (864 lines) → 12 modules in `server/`
- `server/index.js` — Express entry point
- `server/socket.js` — thin event router
- `server/handlers/` — room, chat, artifact handlers
- `server/claude/` — client, chat-analysis, artifact-ops, generation
- `server/data/memory.js` — persistence-ready store interface
- `config.js` — all hardcoded values centralized

**Client:** `app.js` (1,437 lines) → 8 ES modules in `public/modules/`
- state, utils, landing, chat, canvas, viz-picker, mentions, socket-handlers
- Native ES modules (`import`/`export`), not `window.App` globals

**Docs:** 5 files in `docs/`
- architecture.md, agents.md, interactivity.md, design-system.md, socket-api.md

**Cleanup:** Removed `server.js`, `design.md`, `prototype.html`, `app.legacy.js`, `versions/`

**Fixes:** `renderArtifact` window export, port 5000 consistency, stale references

**Branches:** `deploy` (default), `development`, `archive`

---

## v0.6.0 — Full Interactivity (2026-04-05)

- Mindmap SVG drag, diagram code editor, expand popup for all types
- InteractiveEngine: universal data-attribute protocol
- Artifact actions: expand, transform, ask, copy, PNG, delete
- AbortController signal fix for Anthropic SDK

## v0.5.x — Documentation & Polish (2026-04-05)

- Split CLAUDE.md into layered docs (interactivity, design-system, socket-api)
- Bug fixes for drag, inline editing, streaming

## v0.4.0 — Chat-First Architecture (2026-04-05)

- Adaptive Claude behavior (no rigid phases)
- Per-user chat history, structured JSON responses
- Questions with clickable options, canvas actions

## v0.3.0 — Design Sync (2026-04-04)

- Figma-matched dark theme, CSS variables
- Mobile responsive layout, bottom tab bar
- Resize handle for chat/canvas split

## v0.2.0 — Split-View Workspace (2026-04-04)

- Chat left + canvas right layout
- File attachments (images + text)
- @ mention autocomplete
- Visualization picker modal

## v0.1.0 — Initial Prototype (2026-04-04)

- Basic chat with Claude
- Mind map generation
- Canvas with artifact cards
