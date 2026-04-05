# Design System

> Figma file: https://www.figma.com/design/hWXymOh1105g7U1u9PTwnV

## Color Tokens

### Backgrounds & Surfaces
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#0f1117` | Page background, canvas |
| `--surface` | `#1a1d27` | Cards, headers, sidebars |
| `--surface2` | `#232733` | Inputs, secondary cards |
| `--surface3` | `#2a2f3d` | Tertiary, scrollbar thumb |
| `--border` | `#2e3345` | Borders, dividers |

### Text
| Token | Hex | Usage |
|-------|-----|-------|
| `--text` | `#e4e7f0` | Primary text, headings |
| `--text2` | `#9ea3b5` | Labels, secondary text |
| `--placeholder` | `#6a7086` | Input placeholder (no opacity) |

### Accents
| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#6c5ce7` | Primary action, user bubbles |
| `--accent2` | `#a29bfe` | Hover states, links |
| `--green` | `#00cec9` | Success, positive |
| `--orange` | `#fdcb6e` | Warning |
| `--pink` | `#fd79a8` | Decorative |
| `--red` | `#ff6b6b` | Errors |
| `--blue` | `#74b9ff` | Info |

### Accent Alpha Overlays (CSS variables)
| Token | Value | Usage |
|-------|-------|-------|
| `--accent-a10` | `rgba(108,92,231,.1)` | Hover backgrounds, subtle tints |
| `--accent-a15` | `rgba(108,92,231,.15)` | Selected states |
| `--accent-a20` | `rgba(108,92,231,.2)` | Active/pressed states |
| `--accent-a25` | `rgba(108,92,231,.25)` | Strong hover |
| `--accent-a30` | `rgba(108,92,231,.3)` | Focus rings |
| `--green-a10` | `rgba(0,206,201,.12)` | Green tinted backgrounds |
| `--green-a25` | `rgba(0,184,148,.25)` | Green hover |

## Typography

Font: `Inter` (Figma) / `Segoe UI, system-ui` (web)

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--text-2xl` | 28px | 700 | Page title |
| `--text-xl` | 16px | 600 | Section title |
| `--text-lg` | 14px | 400 | Subtitle |
| `--text-base` | 13px | 400 | Body text |
| `--text-md` | 12px | 400 | Suggest buttons, small text |
| `--text-sm` | 11px | 600, uppercase, 0.8px spacing | Labels |
| `--text-xs` | 10px | 400 | Caption |

## Spacing (base: 4px)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Tight gaps |
| `--space-sm` | 6px | Mini-chat gaps |
| `--space-md` | 8px | Button/grid gaps |
| `--space-lg` | 12px | Header padding |
| `--space-xl` | 16px | Message gaps |
| `--space-2xl` | 20px | Section padding |
| `--space-3xl` | 24px | Modal padding |
| `--space-4xl` | 32px | Large spacing |
| `--space-5xl` | 40px | Landing card padding |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 4px | Message bubble corners, badges |
| `--radius-sm` | 6px | Room code badge, code blocks |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 10px | Artifact cards (`--radius` alias) |
| `--radius-xl` | 12px | Modals, message bubbles |
| `--radius-2xl` | 16px | Landing card, pills |

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow` | `0 4px 24px rgba(0,0,0,.4)` | Cards, modals |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,.5)` | Hover elevation |
| `--shadow-xl` | `0 24px 80px rgba(0,0,0,.6)` | Expand popup |

## Easing & Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-out` | `ease-out` | Entry animations |
| `--ease-in-out` | `ease-in-out` | Pulsing, typing |
| `--duration-fast` | `0.1s` | Micro interactions |
| `--duration-normal` | `0.15s` | Buttons, inputs |
| `--duration-smooth` | `0.2s` | Cards, modals |
| `--duration-slow` | `0.3s` | Toast, mobile panel |

## Components

### Buttons
- **Default** `.btn`: `--surface2` bg, `--border` border, `--radius-md` (8px)
- **Primary** `.btn-primary`: `--accent` bg, white text, hover `#7c6ef0`
- **Suggest** `.suggest-btn`: `--accent-a10` bg, `--accent` border
- **Disabled**: opacity 0.5, bg `--surface3`, border `--border`, color `--text2`, `cursor: not-allowed`

### Inputs
- Default: `--surface2` bg, `--border` border, `--radius-md` (8px)
- Focus: border `--accent` + box-shadow ring `--accent-a30`
- Focus-visible: `outline: 2px solid --accent2`, 2px offset

### Cards
- `--surface` bg, `--border` border, 10px radius, shadow
- Hover: purple border glow `rgba(108,92,231,.4)`

## Accessibility (WCAG 2.1 AA)

- `--text2` (#9ea3b5): 4.5:1+ contrast on surfaces
- Placeholder (`--placeholder` #6a7086): 3:1+ contrast
- Focus-visible outlines on all interactive elements
- Semantic HTML landmarks: `<header>`, `<main>`, `<aside>`, `<nav>`
- ARIA: `aria-label`, `aria-live="polite"`, `role="dialog" aria-modal="true"`
- Touch targets: 44px min on mobile
- Resize handle: `role="separator"`, keyboard-accessible
- **Focus trap**: modals (expand popup, viz picker) trap Tab/Shift+Tab within dialog
- **`prefers-reduced-motion`**: all animations and transitions suppressed when user prefers reduced motion
- **Firefox scrollbar**: `scrollbar-color` and `scrollbar-width` tokens applied globally

## Figma Frames

> Source of truth for all UI. Replit must match these specs — do not invent new patterns.

### App Screens
| Frame | Size | Description |
|-------|------|-------------|
| `1. Landing Page` | 1440×900 | Centered card: name input, Create Room, join with code |
| `00 — Workspace (Split-View)` | 1440×900 | Chat left (350px) + resize handle + canvas right. Header: room code `<button>` + user list. No header action buttons. |
| `00 — Viz Picker Modal` | 1440×900 | Overlay + modal: 4×4 agent grid with checkboxes, pre-selected suggestions, custom viz input, Cancel / Generate (N) |
| `00 — Mobile: Chat View` | 375×812 | Full-width chat, bottom tab bar (💬 Chat / 🎨 Canvas) |
| `00 — Mobile: Canvas View` | 375×812 | Artifact cards on grid, bottom tab bar |

### Interaction States
| Frame | Description |
|-------|-------------|
| `00 — Chat Input: New Idea Mode` | ➕ active → green border `#00b894` + "New Idea" badge |
| `00 — Inline Editing States` | 5 states: mindmap label, table cell, checklist toggle, kanban drag, presentation bullet |
| `00 — Empty Canvas State` | Grid + centered placeholder |
| `00 — @ Mention Dropdown` | Type `@` → autocomplete artifact list |

### Expand Popups (1060×700 modal)
| Frame | Description |
|-------|-------------|
| `00 — Popup: Mind Map (Expanded)` | Full map + "+ Add branch/child", toolbar (Transform, Ask Claude, Copy JSON, ✕), ask bar |
| `00 — Popup: Table (Expanded)` | Full table + "+ Add row", toolbar, ask bar |
| `00 — Popup: Kanban (Expanded)` | 4-column board with card details + "+ Add card" per column |

### Reference
| Frame | Description |
|-------|-------------|
| `Design System` | Color palette, typography, spacing, border radius, buttons, inputs, cards, tags, agent icons |
| `5. Artifact Cards` | All card types rendered side-by-side on canvas |
| `01–12` | 12 individual visualization examples (sample data = AI Brainstorm itself) |

### Chat Input Layout
`[📎 Attach] [➕ New Idea] [text input] [Send]`
- 📎 and ➕: 32×32 circle buttons, transparent bg, `--border` stroke, hover: `--accent`
- New Idea active: green border `#00b894` + badge
- Delete artifact: 🗑 in action bar (hover red) + Delete key when card focused

---

## Animations & Transitions

> **Not in Figma.** These specs live in `style.css` and JS modules. This section is the authoritative reference for all motion.

### Keyframe Animations

| Name | Duration | Easing | Properties | Usage |
|------|----------|--------|-----------|-------|
| `artifactEnter` | 0.25s | ease-out | opacity 0→1, scale .95→1, translateY 8px→0 | Artifact card creation on canvas |
| `expandEnter` | 0.2s | ease-out | opacity 0→1, scale .96→1 | Expand popup modal open |
| `spin` | 0.6s / 1s | linear, infinite | rotate 0→360° | `.auto-spinner` (0.6s), `.gen-spinner` (1s) |
| `typingPulse` | 1.5s | ease-in-out, infinite | opacity 1→0.5→1 | `.typing-indicator.visible` during Claude streaming |

### Transition Tiers

| Tier | Duration | What uses it |
|------|----------|-------------|
| **Micro** | 0.1s | `.expand-transform-option`, `.transform-option`, `.mention-item` bg |
| **Quick** | 0.15s | Buttons (`.btn`, `.suggest-btn`, `.art-action-btn`, `.expand-tool-btn`, `.canvas-zoom-btn`), inputs border, `.artifact-actions` opacity, `.bs-add-btn`/`.bs-delete-btn` reveal, `.viz-card`, `.viz-ref-chip` |
| **Standard** | 0.2s | `.artifact-card` (box-shadow, border-color, opacity, transform), `.modal-overlay` opacity |
| **Smooth** | 0.3s | `.toast` (transform + opacity), `.chat-panel` mobile toggle, `.checklist-bar-fill` width |

### Canvas Pan/Zoom (no CSS transition)

Canvas transform updates are **instantaneous** (direct `style.transform` assignment in JS) — no easing or transition. This is intentional for responsiveness.

```
.canvas-area { transform: translate(${panX}px, ${panY}px) scale(${scale}); }
```

---

## Component States

> **Not in Figma** (except partial: New Idea mode, inline editing, empty canvas). These tables document all visual states from CSS/JS.

### Artifact Card (`.artifact-card`)

| State | Border | Shadow | Other |
|-------|--------|--------|-------|
| Default | `--border` | `0 4px 24px rgba(0,0,0,.4)` | `cursor: grab`, z-index: 1 |
| Hover | `rgba(108,92,231,.4)` | `0 8px 32px rgba(0,0,0,.5)` | z-index: 10, action bar revealed (opacity 1) |
| Dragging | unchanged | unchanged | opacity: 0.9, `cursor: grabbing`, z-index: 100 |
| Updating | unchanged | unchanged | `.artifact-updating` overlay with `.gen-spinner` |

Action bar (`.artifact-actions`): `opacity: 0` → `1` on card hover, `pointer-events: none` → `auto`.

### Button Variants

| Button | Default bg | Hover effect | Disabled |
|--------|-----------|-------------|----------|
| `.btn` | `--surface2` | bg `--surface3`, border `--accent` | opacity 0.5, no pointer events |
| `.btn-primary` | `--accent` | bg `#7c6ef0` | opacity 0.5 |
| `.suggest-btn` | `rgba(108,92,231,.1)` | bg `.25`, `translateY(-1px)` | opacity 0.5, `cursor: not-allowed` |
| `.canvas-action-btn` | `rgba(0,206,201,.12)` | bg `.25`, `translateY(-1px)` | — |
| `.generate-all-btn` | `rgba(0,184,148,.15)` | bg `.3`, `translateY(-1px)` | opacity 0.5 |
| `.art-action-btn` | `--surface` | bg `--surface2`, border `--accent`, color `--accent2` | — |
| `.art-action-danger` | same | border `--red`, color `--red`, bg `rgba(255,107,107,.08)` | — |
| `.expand-tool-btn` | `--surface` | bg `--surface2`, border `--accent`, color `--accent2` | — |
| `.clarify-option-btn` | `--surface2` | border `--accent`, color `--accent2`, bg `rgba(108,92,231,.1)` | — |
| `.chat-action-btn` | transparent | border `--accent`, color `--accent2`, bg `rgba(108,92,231,.1)` | — |

Selected states: `.clarify-option-btn.selected`, `.viz-card.selected`, `.viz-ref-chip.selected` all use `--accent` border + bg `rgba(108,92,231,.15/.2)`.

### Input (`.input`)

| State | Border | Shadow | Other |
|-------|--------|--------|-------|
| Default | `--border` | none | — |
| Focus | `--accent` | none | — |
| Focus-visible | `--accent` | `0 0 0 2px rgba(108,92,231,.3)` | outline: `2px solid --accent2`, offset 2px |
| New Idea mode | `#00b894` | `0 0 0 1px rgba(0,184,148,.3)` | "New Idea" badge visible |

### Inline Edit (`[data-edit]`)

| State | Visual |
|-------|--------|
| Default | `cursor: text`, title "Double-click to edit" |
| Hover | bg `rgba(108,92,231,.08)`, border-radius 3px |
| Editing | `.bs-editing` — outline `2px solid --accent`, outline-offset -1px |

### Interactive Add/Delete Buttons

| Element | Default | Parent hover | Self hover |
|---------|---------|-------------|-----------|
| `.bs-add-btn` | opacity 0 | opacity 0.7 | opacity 1, `scale(1.15)`, bg `--accent`, color white |
| `.bs-delete-btn` | opacity 0 | opacity 0.5 | opacity 1, bg `--red`, color white |
| `.bs-add-zone` | opacity 0.5, border transparent | — | opacity 1, border `--accent`, color `--accent`, bg `rgba(108,92,231,.06)` |

### Drag-and-Drop

| Class | Applied when | Visual |
|-------|-------------|--------|
| `.dragging` | Artifact card being moved | opacity 0.9, `cursor: grabbing`, z-index 100 |
| `.bs-dragging` | Data-attribute drag item | opacity 0.5 |
| `.bs-drag-over` | Drop target hovered | bg `rgba(108,92,231,.1)`, outline `2px dashed --accent`, offset -2px, radius 6px |
| `.kanban-card.dragging` | Kanban card drag | opacity 0.6 |
| `.kanban-col.drag-over` | Kanban column target | bg `rgba(108,92,231,.05)`, radius 6px |

### Modals

| Modal | Entry animation | Backdrop | Close triggers |
|-------|----------------|---------|---------------|
| Expand popup | `expandEnter` 0.2s ease-out | `rgba(0,0,0,.6)` | Escape, click outside, ✕ button |
| Viz picker | `.modal-overlay` opacity 0→1, 0.2s | same | Escape, Cancel button, click outside |
| Transform dropdown | instant (`display: block`) | none | Click outside, Escape |
| Mention dropdown | instant (`display: block`) | none | Escape, click outside, blur |

---

## Feedback States

> **Not in Figma.** All loading, error, and connection states documented here.

### Toast Notifications

- **Position:** fixed bottom-center
- **Entry:** `translateX(-50%) translateY(60px)` → `translateY(0)`, opacity 0→1, transition 0.3s
- **Auto-dismiss:** 2.5s (via `setTimeout`)
- **Variants** (by content, no CSS class difference):
  - Artifact created: `"{icon} {title}"` created
  - Copied: "Copied to clipboard"
  - Error: `"Error: {message}"`
  - Connection: "Connection error", "Disconnected", "Reconnected!"
  - Screenshot: "Screenshot saved"

### Loading Overlays

| Indicator | Animation | Duration | Context |
|-----------|-----------|----------|---------|
| `.auto-spinner` | `spin` rotation | 0.6s, linear, infinite | Replaces suggest-btn content while generating |
| `.gen-spinner` | `spin` rotation | 1s, linear, infinite | `.artifact-updating` overlay on card |
| `.typing-indicator` | `typingPulse` | 1.5s, ease-in-out, infinite | Below chat messages during Claude streaming |

### Connection States (socket events → toasts)

| Event | Toast message | UI effect |
|-------|-------------|-----------|
| `connect_error` | "Connection error" | Toast |
| `disconnect` | "Disconnected" | Toast |
| `reconnect` | "Reconnected!" | Toast |
| `generation-error` | "Error: {msg}" | Toast + remove all `.artifact-updating` overlays |

---

## Keyboard Navigation

> **Not in Figma.** No Figma prototype covers keyboard flows.

### Global

| Key | Context | Action |
|-----|---------|--------|
| `Enter` | Chat input focused | Send message |
| `Escape` | Any modal/dropdown open | Close |
| `Delete` / `Backspace` | Artifact card has focus | Delete card (with browser confirm dialog) |
| `Space` + drag | Canvas | Pan |
| `Ctrl`/`Cmd` + Wheel | Canvas | Zoom (0.2x–2x) |
| Middle-click + drag | Canvas | Pan |

### Inline Edit

| Key | Context | Action |
|-----|---------|--------|
| Double-click | `[data-edit]` / `[data-edit-multiline]` | Start edit |
| `Enter` | Single-line edit | Save |
| `Ctrl+Enter` | Multiline edit | Save |
| `Escape` | Any edit | Cancel, restore original value |

### Mention Autocomplete

| Key | Context | Action |
|-----|---------|--------|
| `@` | Chat input | Open dropdown |
| Arrow Up/Down | Dropdown open | Navigate items |
| `Enter` / `Tab` | Item highlighted | Insert mention |
| `Escape` | Dropdown open | Close dropdown |

### Viz Picker Modal

| Key | Context | Action |
|-----|---------|--------|
| `Escape` | Modal open | Close modal |

---

## Mobile Behavior

> **Partially in Figma** (2 frames: Chat View, Canvas View). Breakpoints and transitions not shown.

### Breakpoints

- **< 768px**: Mobile layout — full-screen panels with bottom tab bar (💬 Chat / 🎨 Canvas)
- **769px–1024px**: Tablet — narrower chat panel (280px), 3-column viz grid, 95vw expand modal
- **> 1024px**: Desktop — full split-view (350px chat + canvas)

### Tab Transition

- `.chat-panel` slides via `transform: translateX(-100%)` / identity
- Transition: 0.3s ease
- `.show-canvas` class on `<body>` controls which panel is visible

### Touch Targets

- All interactive elements: min 44px tap target (WCAG 2.1 AA)
- `.mobile-tab`: min-height 44px

---

## Figma Coverage Gaps (what to add)

These dynamic behaviors exist only in code and need Figma frames or annotations:

### Priority 1 — Component State Variants
- [ ] Button states grid: default / hover / focus / active / disabled for each button type
- [ ] Artifact card states: default → hover (action bar reveal) → dragging → updating
- [ ] Input states: default → focus → New Idea mode (partially exists)
- [ ] Interactive element states: `[data-edit]` hover highlight, `.bs-add-btn` reveal progression

### Priority 2 — New Frames
- [ ] Toast notification variants (success, error, info) with position spec
- [ ] Loading states: auto-spinner in button, gen-spinner overlay, typing indicator
- [ ] Canvas pan/zoom controls annotated frame
- [ ] Expand popup full frame with toolbar (partially exists for 3 types)

### Priority 3 — Interaction Flow Annotations
- [ ] Chat streaming flow: send → typing indicator → stream → render → questions
- [ ] File attachment flow: 📎 → picker → preview chips → ×
- [ ] Mention autocomplete flow: @ → filter → arrow nav → select
- [ ] Canvas interaction: scroll=pan, Ctrl+wheel=zoom, Space+drag=pan
