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

### Alpha Overlays (CSS variables)

Accent: `--accent-a05` / `a06` / `a10` / `a15` / `a20` / `a25` / `a30` / `a40`
Green: `--green-a08` / `a10` / `a15` / `a25` / `a30`
Cyan: `--cyan-a15` / `a20` / `a25`
Other: `--red-a08`, `--tag-green` / `--tag-orange` / `--tag-pink` / `--tag-blue`
Overlays: `--overlay-dark`, `--overlay-bg`, `--overlay-bg-heavy`
Misc: `--spinner-track`, `--border-a50`

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

## Shadows & Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow` | `0 4px 24px rgba(0,0,0,.4)` | Cards, modals |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,.5)` | Hover elevation |
| `--shadow-xl` | `0 24px 80px rgba(0,0,0,.6)` | Expand popup |
| `--ease-out` | `ease-out` | Entry animations |
| `--ease-in-out` | `ease-in-out` | Pulsing, typing |
| `--duration-fast` | `0.1s` | Micro (dropdown bg) |
| `--duration-normal` | `0.15s` | Buttons, inputs |
| `--duration-smooth` | `0.2s` | Cards, modals |
| `--duration-slow` | `0.3s` | Toast, mobile panel |

## Components

### Buttons
- **Default** `.btn`: `--surface2` bg, `--border` border, `--radius-md` (8px)
- **Primary** `.btn-primary`: `--accent` bg, white text, hover `--accent-hover`
- **Suggest** `.suggest-btn`: `--accent-a10` bg, `--accent` border
- **Disabled**: opacity 0.5, bg `--surface3`, border `--border`, color `--text2`, `cursor: not-allowed`

### Inputs
- Default: `--surface2` bg, `--border` border, `--radius-md` (8px)
- Focus: border `--accent` + box-shadow ring `--accent-a30`
- Focus-visible: `outline: 2px solid --accent2`, 2px offset

### Cards
- `--surface` bg, `--border` border, 10px radius, shadow
- Hover: border `--accent-a40`, shadow `--shadow-lg`

### Timeline
- **Classes**: `.timeline-container`, `.tl-item`, `.tl-dot`, `.tl-line`, `.tl-date`, `.tl-desc`
- **Layout**: Vertical list with absolute-positioned dot (12px circle) and 2px line on the left; items padded-left 20px
- **States**: `.tl-item` supports status classes (e.g. `.done`, `.upcoming`) for dot color
- **Interactive**: `data-edit` on label/date/description, `data-delete` on items, `data-add` zone at bottom

### Donut Chart
- **Classes**: `.donut-container`, `.donut-chart`, `.donut-legend`, `.donut-legend-item`, `.donut-legend-dot`, `.donut-center`
- **Layout**: Flex row — SVG chart (flex-shrink: 0) left + legend column right, gap 20px
- **States**: No hover states on chart segments; legend items are static
- **Interactive**: `data-edit` on segment labels/values and center label, `data-delete` on legend items, `data-add` zone

### Kanban
- **Classes**: `.kanban-board`, `.kanban-col`, `.kanban-col-header`, `.kanban-cards`, `.kanban-card`
- **Layout**: Flex row of equal-width columns; cards stacked vertically with 5px gap; min-height 180px
- **States**: `.kanban-card.dragging` (opacity .6), `.kanban-col.drag-over` (accent bg tint)
- **Interactive**: `data-edit` on column names/card titles, `data-drag-item`/`data-drag-target` for card reorder, `data-delete`, `data-add`

### Matrix 2x2
- **Classes**: `.matrix-container`, `.matrix-grid`, `.matrix-quad`, `.matrix-quad-label`, `.matrix-chip`
- **Layout**: 2x2 CSS grid (5px gap); each quadrant has colored border, `--surface2` bg, min-height 80px; chips are inline pill elements
- **States**: No explicit hover states; chips inherit quadrant color via inline `color-mix()`
- **Interactive**: `data-edit` on axis labels/quadrant labels/chips, `data-delete` + `data-drag-item`/`data-drag-target` on chips, `data-add` per quadrant

### SWOT
- **Classes**: `.swot-grid`, `.swot-quad`
- **Layout**: 2x2 CSS grid (6px gap); quadrants have `--surface2` bg, `--radius-md` corners, 10px padding
- **States**: No hover states; quadrant identity conveyed by colored bullet markers in list items
- **Interactive**: `data-edit` on items, `data-delete` on items, `data-add` zone per quadrant

### Pros/Cons
- **Classes**: `.proscons-container`, `.proscons-grid`, `.proscons-col`, `.proscons-header`, `.proscons-item`, `.proscons-verdict`
- **Layout**: 2-column CSS grid (10px gap); verdict bar below with `--accent` left border (3px), `--surface2` bg
- **States**: No hover states; items use green (+) / red (-) icon prefix
- **Interactive**: `data-edit` on each item and verdict, `data-delete` on items, `data-add` zone per column

### Checklist
- **Classes**: `.checklist-container`, `.checklist-progress`, `.checklist-bar`, `.checklist-bar-fill`, `.checklist-item`, `.checklist-check`
- **Layout**: Progress bar (4px height, `--green` fill, animated width 0.3s) at top; items are flex rows with 16px checkbox + text
- **States**: `.checklist-item.done` — opacity .55, strikethrough text, green check bg; `.checklist-check:hover` — green border
- **Interactive**: `data-toggle` on checkbox (toggles `done`), `data-edit` on text, `data-delete` on items, `data-add` zone

### Quote Card
- **Classes**: `.quote-container`, `.quote-tag`, `.quote-text`, `.quote-author`, `.quote-supporting`
- **Layout**: `--surface2` bg card with `--accent` left border (3px), 16px padding; tag absolutely positioned top-right (9px pill)
- **States**: No hover states
- **Interactive**: `data-edit-multiline` on quote text, `data-edit` on author/supporting

### Presentation / Slides
- **Classes**: `.slides-container`, `.slide-view`, `.slide-nav`, `.slide-dot`
- **Layout**: Slide view (`--surface2` bg, 20px padding, min-height 120px) + bottom nav bar (flex centered); dots are 6px circles
- **States**: `.slide-dot.active` — `--accent` bg; nav buttons hover: color `--text`
- **Interactive**: `data-edit` on slide title and bullets, `data-delete` on bullets, `data-add` zone for bullets; nav via JS click handlers

### File Chips
- **Classes**: `.file-chip`, `.file-chip-thumb`, `.file-chip-icon`, `.file-chip-name`, `.file-chip-remove`, `.file-preview-bar`
- **Layout**: Preview bar (flex wrap, `--surface` bg, top border) contains chips; each chip is flex row with 32px thumbnail + name (truncated, max-width 200px)
- **States**: `.file-chip-remove:hover` — color `--red`
- **Interactive**: Remove button (x) deletes attachment from pending list

### Mention Dropdown
- **Classes**: `.mention-dropdown`, `.mention-item`, `.mention-icon`, `.mention-title`, `.mention-type`
- **Layout**: Fixed-position dropdown (`--surface` bg, `--shadow`, max-height 200px scroll, z-index 600, min-width 200px); items are flex rows with icon + title + type label
- **States**: `.mention-dropdown.visible` (display: block); `.mention-item:hover` / `.mention-item.active` — `--surface2` bg
- **Accessibility**: `role="listbox"` on dropdown, `role="option"` on items; keyboard nav via Arrow Up/Down, Enter/Tab to select

### Tags
- **Classes**: `.tag`, `.tag-green`, `.tag-orange`, `.tag-pink`, `.tag-blue`
- **Layout**: Inline-block pills — 2px vertical / 8px horizontal padding, `--radius-xs` (4px), `--text-xs` (10px) font
- **Colors**: Each variant uses matching `--tag-{color}` bg + `--{color}` text (green/orange/pink/blue)
- **Usage**: Inside table cells, kanban cards, and other renderers for categorical labels

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
| `00 — Chat Input: New Idea Mode` | ➕ active → green border `--green-dark` + "New Idea" badge |
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
- New Idea active: green border `--green-dark` + badge
- Delete artifact: 🗑 in action bar (hover red) + Delete key when card focused

---

## Animations & Transitions

> Sections below (Animations, Component States, Feedback, Keyboard, Mobile) are **not in Figma** — specs live in CSS/JS only.

### Keyframe Animations

| Name | Duration | Easing | Properties | Usage |
|------|----------|--------|-----------|-------|
| `artifactEnter` | 0.25s | ease-out | opacity 0→1, scale .95→1, translateY 8px→0 | Artifact card creation on canvas |
| `expandEnter` | 0.2s | ease-out | opacity 0→1, scale .96→1 | Expand popup modal open |
| `spin` | 0.6s / 1s | linear, infinite | rotate 0→360° | `.auto-spinner` (0.6s), `.gen-spinner` (1s) |
| `typingPulse` | 1.5s | ease-in-out, infinite | opacity 1→0.5→1 | `.typing-indicator.visible` during Claude streaming |

### Canvas Pan/Zoom

Canvas transform is **instantaneous** (direct `style.transform` in JS, no transition) for 60fps responsiveness.

---

## Component States

### Artifact Card (`.artifact-card`)

| State | Border | Shadow | Other |
|-------|--------|--------|-------|
| Default | `--border` | `--shadow` | `cursor: grab`, z-index: 1 |
| Hover | `--accent-a40` | `--shadow-lg` | z-index: 10, action bar revealed |
| Dragging | unchanged | unchanged | opacity: 0.9, `cursor: grabbing`, z-index: 100 |
| Updating | unchanged | unchanged | `--overlay-bg-heavy` overlay + `.gen-spinner` |

Action bar (`.artifact-actions`): opacity 0 → 1 on card hover, pointer-events none → auto.

### Button Variants

| Button | Default bg | Hover effect | Disabled |
|--------|-----------|-------------|----------|
| `.btn` | `--surface2` | bg `--surface3`, border `--accent` | bg `--surface3`, `--text2`, not-allowed |
| `.btn-primary` | `--accent` | bg `--accent-hover` | opacity 0.5 |
| `.suggest-btn` | `--accent-a10` | bg `--accent-a25`, translateY(-1px) | bg `--surface3`, not-allowed |
| `.canvas-action-btn` | `--green-a10` | bg `--cyan-a25`, translateY(-1px) | — |
| `.generate-all-btn` | `--green-a15` | bg `--green-a30`, translateY(-1px) | bg `--surface3`, not-allowed |
| `.art-action-btn` | `--surface` | bg `--surface2`, border+color `--accent2` | — |
| `.art-action-danger` | same | border+color `--red`, bg `--red-a08` | — |
| `.clarify-option-btn` | `--surface2` | border+color `--accent2`, bg `--accent-a10` | — |

Selected: `.clarify-option-btn.selected`, `.viz-card.selected`, `.viz-ref-chip.selected` — border `--accent` + bg `--accent-a15`/`a20`.

### Input (`.input`)

| State | Border | Shadow |
|-------|--------|--------|
| Default | `--border` | none |
| Focus | `--accent` | none |
| Focus-visible | `--accent` | `--accent-a30` ring |
| New Idea mode | `--green-dark` | `--green-a30` ring |

### Inline Edit (`[data-edit]`)

| State | Visual |
|-------|--------|
| Hover | bg `--accent-a10`, radius 3px |
| Editing | `.bs-editing` — outline `2px solid --accent` |

### Interactive Add/Delete Buttons

| Element | Parent hover | Self hover |
|---------|-------------|-----------|
| `.bs-add-btn` | opacity 0.7 | opacity 1, scale(1.15), bg `--accent` |
| `.bs-delete-btn` | opacity 0.5 | opacity 1, bg `--red` |
| `.bs-add-zone` | — | border+color `--accent`, bg `--accent-a06` |

### Drag-and-Drop

| Class | Visual |
|-------|--------|
| `.bs-dragging` | opacity 0.5 |
| `.bs-drag-over` | bg `--accent-a10`, outline `2px dashed --accent` |
| `.kanban-card.dragging` | opacity 0.6 |
| `.kanban-col.drag-over` | bg `--accent-a05` |

### Modals

| Modal | Animation | Backdrop | Close |
|-------|-----------|---------|-------|
| Expand popup | `expandEnter` 0.2s | `--overlay-dark` | Escape, click outside, x |
| Viz picker | opacity 0.2s | `--overlay-dark` | Escape, Cancel, click outside |
| Transform dropdown | instant | none | Click outside, Escape |
| Mention dropdown | instant | none | Escape, click outside, blur |

---

## Feedback States

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
