# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [1.1.0] — 2026-04-06

### Added
- **Custom Visualization agent** (`freeform`) — any HTML/CSS/JS, 12K token limit, state+render architecture
- **Per-agent `maxTokens`** override in agent JSON schema
- **Testing infrastructure** — 110 unit + integration tests (`node:test` + `node:assert`)
- **Session export/import** — download/upload room as JSON, import into new or existing room
- **12 visualization component docs** in `design-system.md` (Timeline, Donut, Kanban, Matrix, SWOT, Pros/Cons, Checklist, Quote Card, Presentation, File Chips, Mentions, Tags)

### Changed
- **Chat behavior tuning** — first message: clarifying questions; ongoing: always suggest viz
- **Question UX redesign** — self-contained answers with toggle options, auto-resizing `<textarea>`, send gating
- **Viz picker redesign** — textarea-first with example chips, template agents below
- **Design system docs** — removed raw hex/rgba duplication, all values via tokens
- **Standardized metadata** — `package.json` fields, agent `_schema.json`, `.env.example`, `README.md`

### Fixed
- **XSS vulnerabilities** — DOMPurify sanitization for all user content, MIME type escaping
- **UI instability** — InteractiveEngine lifecycle, streaming race conditions, socket init order
- **Legacy room safety** — guard for rooms without `memory` field

### Security
- Added DOMPurify CDN for HTML sanitization
- Escaped file MIME types in attachment display

---

## [1.0.0] — 2026-04-05

### Changed
- **Server:** Decomposed `server.js` (864 lines) into 12 modules in `server/`
- **Client:** Decomposed `app.js` (1,437 lines) into 8 ES modules in `public/modules/`
- **Config:** All hardcoded values centralized in `config.js`
- **Entry point:** `server.js` → `server/index.js`
- **Port:** Standardized to 5000 everywhere
- **Branches:** `deploy` (default), `development`, `archive` — removed `master`

### Added
- `docs/architecture.md` — module structure, data flow, dependency rules
- `docs/agents.md` — step-by-step guide for new agents
- `CHANGELOG.md` — consolidated release history
- `window.renderArtifact` export for ES module compatibility

### Removed
- `server.js` — replaced by `server/index.js`
- `design.md` — stub, content moved to `docs/design-system.md`
- `prototype.html` — unused early prototype
- `versions/` — 12 files, replaced by this changelog
- `window.InteractiveLayer` — dead alias

### Fixed
- `renderArtifact` not exported to window (artifacts would render blank)
- Port 3000/5000 inconsistency across `.env.example`, `.replit`, `config.js`
- Stale references to deleted files in `CLAUDE.md`

---

## [0.6.0] — 2026-04-05

### Added
- Mindmap SVG node dragging with real-time line updates
- Diagram Mermaid code editor (textarea overlay, Ctrl+S save)
- Expand popup for all artifact types (90vw×85vh modal)
- Artifact actions: AI Expand, Transform, Ask, Copy JSON, PNG export, Delete
- Delete key shortcut on focused artifact cards

### Fixed
- `AbortController.signal` placement in Anthropic SDK (2nd arg, not body)

---

## [0.5.0] — 2026-04-05

### Changed
- Split monolithic `CLAUDE.md` into layered docs (`interactivity.md`, `design-system.md`, `socket-api.md`)

### Fixed
- Drag-and-drop edge cases
- Inline editing state sync
- Streaming message cleanup

---

## [0.4.0] — 2026-04-05

### Changed
- Chat-first architecture: adaptive Claude behavior, no rigid question phases
- Per-user chat history (private context per socket)

### Added
- Structured JSON responses: `questions`, `suggest`, `offer_canvas`, `canvas_action`
- Clickable question options with "Другое..." fallback
- Canvas actions from Claude (create, update, transform)

---

## [0.3.0] — 2026-04-04

### Added
- Figma-matched dark theme with CSS variables
- Mobile responsive layout (375×812) with bottom tab bar
- Chat/canvas resize handle
- Visualization picker modal with reference artifacts

---

## [0.2.0] — 2026-04-04

### Added
- Split-view workspace: chat left + canvas right
- File attachments (images + text, max 5 files, 10MB each)
- @ mention autocomplete for artifacts in chat
- Room code sharing and join flow
- 15 visualization agent types

---

## [0.1.0] — 2026-04-04

### Added
- Basic chat with Claude API
- Mind map generation
- Canvas with draggable artifact cards
- Room creation with 6-character codes
