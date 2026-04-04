# AI Brainstorm — Design System & Visual Concept

## Visual Identity

**Theme:** Dark, modern, focused. Inspired by creative tools like Miro/Figma but with a moody, developer-friendly aesthetic.

**Mood:** Professional yet playful. Purple accents on dark surfaces create a sense of depth and focus. The UI stays out of the way while artifacts take center stage.

---

## Color Palette

### Backgrounds & Surfaces
| Token       | Hex       | Usage                              |
|-------------|-----------|-------------------------------------|
| `--bg`      | `#0f1117` | Page background, canvas             |
| `--surface` | `#1a1d27` | Cards, headers, sidebars            |
| `--surface2`| `#232733` | Inputs, secondary cards, bubbles    |
| `--surface3`| `#2a2f3d` | Tertiary surfaces, scrollbar thumb  |
| `--border`  | `#2e3345` | All borders, dividers, table lines  |

### Text
| Token    | Hex       | Usage                          |
|----------|-----------|--------------------------------|
| `--text` | `#e4e7f0` | Primary text, headings         |
| `--text2`| `#9ea3b5` | Labels, secondary text, hints  |

### Accent Colors
| Token      | Hex       | Usage                          |
|------------|-----------|--------------------------------|
| `--accent` | `#6c5ce7` | Primary action, user bubbles   |
| `--accent2`| `#a29bfe` | Hover states, highlights, links|
| `--green`  | `#00cec9` | Success, positive tags         |
| `--orange` | `#fdcb6e` | Warning, warm tags             |
| `--pink`   | `#fd79a8` | Decorative tags                |
| `--red`    | `#ff6b6b` | Errors, destructive            |
| `--blue`   | `#74b9ff` | Info, neutral tags             |

---

## Typography

**Font Family:** `Inter` (Figma) / `Segoe UI, system-ui` (web fallback)

| Role           | Size  | Weight | Usage                         |
|----------------|-------|--------|-------------------------------|
| Page Title     | 28px  | 700    | Landing "Brainstorm" heading  |
| Section Title  | 16px  | 600    | Modal headings, sidebar title |
| Body / Default | 13px  | 400    | Messages, descriptions        |
| Label          | 11px  | 600    | Input labels, uppercase       |
| Caption        | 10px  | 400    | Author tags, counters         |
| Small          | 12px  | 400    | Secondary text, hints         |

**Letter Spacing:**
- Labels: `0.8px` (uppercase)
- Room code: `1-2px` (monospace)

---

## Spacing & Layout

**Base Unit:** 4px

| Token | Value | Usage                           |
|-------|-------|---------------------------------|
| xs    | 4px   | Tight gaps                      |
| sm    | 6px   | Mini-chat gaps                  |
| md    | 8px   | Button gaps, grid gaps          |
| lg    | 10px  | Card padding, input padding     |
| xl    | 12px  | Header padding, section gaps    |
| 2xl   | 16px  | Message gaps, major padding     |
| 3xl   | 20px  | Messages area padding           |
| 4xl   | 24px  | Modal padding, card body        |
| 5xl   | 40px  | Landing card padding            |

**Border Radius:**
| Value | Usage                          |
|-------|--------------------------------|
| 4px   | Message bubble cut corners     |
| 6px   | Room code badge, guide iframe  |
| 8px   | Buttons, inputs, agent options |
| 10px  | Artifact cards (--radius)      |
| 12px  | Modals, message bubbles        |
| 16px  | Landing card                   |

**Shadow:** `0 4px 24px rgba(0, 0, 0, 0.4)` — used on cards, modals, toasts

---

## Component Library

### Buttons
- **Default (`.btn`):** `--surface2` bg, `--border` border, `--text` color, 8px radius
- **Primary (`.btn-primary`):** `--accent` bg, white text, hover `#7c6ef0`
- **Full Width (`.btn-full`):** width 100%
- **Disabled:** opacity 0.5, no pointer events
- **Suggest Button:** transparent bg with `--accent` border, `--accent2` text, 8px radius

### Inputs
- **Default:** `--surface2` bg, `--border` border, 8px radius, `--text` color
- **Focus:** border-color `--accent` + box-shadow ring `rgba(108,92,231,.3)`
- **Focus-visible (all elements):** `outline: 2px solid --accent2`, `outline-offset: 2px`
- **Placeholder:** `#6a7086` (dedicated color, no opacity)

### Cards
- **Surface Card:** `--surface` bg, `--border` border, 10px radius, `--shadow`
- **Hover:** border glows purple `rgba(108,92,231,.4)`, shadow deepens

### Badges & Tags
- **Room Code:** monospace, `--surface2` bg, 6px radius, uppercase
- **Tag:** inline-block, 4px radius, colored variants (green/orange/pink/blue)

---

## Screens

> **Figma file:** https://www.figma.com/design/hWXymOh1105g7U1u9PTwnV

### App Screens

| Frame | Description |
|-------|-------------|
| `00 — Landing Screen` | Centered card (400px): name input, Create Room, join with code |
| `00 — Workspace (Split-View)` | Main screen 1440×900: chat left (350px) + canvas right, header with room code `<button>`, no header buttons — all actions via chat input |
| `00 — Viz Picker Modal` | Overlay: 4×4 agent grid with checkboxes, pre-selected suggestions, Generate (N) |
| `00 — Mobile: Chat View` | 375×812: chat with option pills, bottom tab bar |
| `00 — Mobile: Canvas View` | 375×812: artifact cards on grid, bottom tab bar |

### Chat Input
Layout: `[📎 Attach] [➕ New Idea] [text input] [Send]`
- 📎 and ➕ are 32×32 circle buttons (transparent bg, `--border` stroke)
- **New Idea Mode**: ➕ active → input border turns green (`#00b894`), "New Idea" badge appears

### Interaction States

| Frame | Description |
|-------|-------------|
| `00 — Chat Input: New Idea Mode` | Green border + badge on input after pressing ➕ |
| `00 — Inline Editing States` | 5 states: mind map label edit, table cell edit, checklist toggle, kanban drag, presentation bullet edit |
| `00 — Empty Canvas State` | Grid + centered "No visualizations yet" placeholder |
| `00 — @ Mention Dropdown` | Autocomplete filtering artifacts, arrow/Enter/Escape navigation |

### Visualization Examples (12 frames)

All use AI Brainstorm as sample data. Frame names: `01 — Mind Map` through `12 — Quote / Insight Card`.

See `CLAUDE.md` → Agent Catalog for full list of 15 agent types and their JSON schemas.
