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
| Placeholder | `#6a7086` | Input placeholder (no opacity) |

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

## Typography

Font: `Inter` (Figma) / `Segoe UI, system-ui` (web)

| Role | Size | Weight |
|------|------|--------|
| Page title | 28px | 700 |
| Section title | 16px | 600 |
| Body | 13px | 400 |
| Label | 11px | 600, uppercase, 0.8px spacing |
| Caption | 10px | 400 |

## Spacing (base: 4px)

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight gaps |
| sm | 6px | Mini-chat |
| md | 8px | Button/grid gaps |
| lg | 10px | Card padding |
| xl | 12px | Header padding |
| 2xl | 16px | Message gaps |
| 3xl-5xl | 20-40px | Major padding |

## Border Radius

| Value | Usage |
|-------|-------|
| 4px | Message bubble corners |
| 6px | Room code badge |
| 8px | Buttons, inputs |
| 10px | Artifact cards (`--radius`) |
| 12px | Modals, message bubbles |
| 16px | Landing card |

Shadow: `0 4px 24px rgba(0, 0, 0, 0.4)`

## Components

### Buttons
- **Default** `.btn`: `--surface2` bg, `--border` border, 8px radius
- **Primary** `.btn-primary`: `--accent` bg, white text, hover `#7c6ef0`
- **Suggest** `.suggest-btn`: transparent bg, `--accent` border
- **Disabled**: opacity 0.5, no pointer events

### Inputs
- Default: `--surface2` bg, `--border` border, 8px radius
- Focus: border `--accent` + box-shadow ring `rgba(108,92,231,.3)`
- Focus-visible: `outline: 2px solid --accent2`, 2px offset

### Cards
- `--surface` bg, `--border` border, 10px radius, shadow
- Hover: purple border glow `rgba(108,92,231,.4)`

## Accessibility (WCAG 2.1 AA)

- `--text2` (#9ea3b5): 4.5:1+ contrast on surfaces
- Placeholder (#6a7086): 3:1+ contrast
- Focus-visible outlines on all interactive elements
- Semantic HTML landmarks: `<header>`, `<main>`, `<aside>`, `<nav>`
- ARIA: `aria-label`, `aria-live="polite"`, `role="dialog" aria-modal="true"`
- Touch targets: 44px min on mobile
- Resize handle: `role="separator"`, keyboard-accessible

## Figma Frames

| Frame | Description |
|-------|-------------|
| `00 — Landing Screen` | Centered card: name input, Create Room, join code |
| `00 — Workspace (Split-View)` | 1440x900: chat left + canvas right |
| `00 — Viz Picker Modal` | 4x4 agent grid, checkboxes, Generate (N) |
| `00 — Mobile: Chat View` | 375x812: chat + bottom tab bar |
| `00 — Mobile: Canvas View` | 375x812: artifacts + bottom tab bar |
| `00 — Chat Input: New Idea Mode` | Green border + badge |
| `00 — Inline Editing States` | 5 states: mindmap, table, checklist, kanban, presentation |
| `00 — Empty Canvas State` | Grid + placeholder |
| `00 — @ Mention Dropdown` | Autocomplete filtering |
| `01-12` | All 12 structured visualization types |

### Chat Input Layout
`[📎 Attach] [➕ New Idea] [text input] [Send]`
- 📎 and ➕: 32x32 circle buttons (transparent, `--border` stroke)
- New Idea active: green border `#00b894` + badge
