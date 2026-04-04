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
| `--text2`| `#8b90a0` | Labels, secondary text, hints  |

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
- **Focus:** border-color changes to `--accent`
- **Placeholder:** `--text2` color

### Cards
- **Surface Card:** `--surface` bg, `--border` border, 10px radius, `--shadow`
- **Hover:** border glows purple `rgba(108,92,231,.4)`, shadow deepens

### Badges & Tags
- **Room Code:** monospace, `--surface2` bg, 6px radius, uppercase
- **Tag:** inline-block, 4px radius, colored variants (green/orange/pink/blue)

---

## Screens

> **Figma file:** https://www.figma.com/design/JvFIp4Sm1myT84L8898BWV/AI-Brainstorm-UI-Design

### 1. Landing Page (1440x900)
Centered card (400px wide) on `--bg` background. Contains: title with brain emoji, subtitle "Collaborative AI-powered idea visualization", name input with uppercase label, "Create New Room" primary button (full-width), "or join existing" divider, room code input (monospace, uppercase) + "Join Room" button.

### 2. Workspace — Split-View (1440x900)
- **Header (48px):** room code badge (monospace, copyable), user list with names, spacer, "+ New Visualization" button (primary)
- **Layout:** CSS Grid `350px | 4px | 1fr` — chat panel (left) + resize handle + canvas panel (right)
- **Chat Panel (left):**
  - Messages area with alternating user (right-aligned, `--accent` bg) and Claude (left-aligned, `--surface2` bg) bubbles
  - Clarifying questions with `?` prefix in `--accent` color + clickable option pill buttons
  - Canvas offer section (green-tinted) with suggested visualization buttons + "Choose more visualizations..." link
  - Canvas action buttons (green border, confirm intent)
  - Typing indicator in `--accent2`
  - Input bar: text input + "Send" primary button
- **Canvas Panel (right):**
  - Dot-grid background (`--surface3` dots, 24px spacing)
  - 4000x4000px virtual canvas, scrollable
  - Artifact cards positioned absolutely

### 3. Visualization Picker Modal (560px)
Overlay modal with:
- Title: "Choose Visualizations" with subtitle
- 4-column grid of agent cards (icon + name, checkbox, selected state with purple border)
- Pre-selected suggestions marked "recommended"
- Reference chips section (existing artifacts to use as context)
- Custom viz checkbox + text input
- Footer: Cancel + "Generate (N)" primary button

### 4. Artifact Cards
Floating cards (300-500px wide) with:
- **Action bar** (hover, above card): Expand / Transform / Ask buttons
- **Header:** agent icon + title + "by Author" label
- **Body:** rendered content (SVG, HTML, charts)
- **Ask bar** (toggle): mini input + Ask button at card bottom
- **Transform dropdown:** list of all other agent types
- **States:** default, hover (purple border glow), dragging (opacity 0.9, z-index 100), updating (spinner overlay)

### 5. Mobile: Chat View (375x812)
- Room code badge (top-left)
- Full-width chat messages
- Input bar with Send button
- Bottom tab bar: "Chat" (active, `--accent2`) | "Canvas"

### 6. Mobile: Canvas View (375x812)
- Full-width canvas with artifact cards (stacked vertically)
- Bottom tab bar: "Chat" | "Canvas" (active, `--accent2`)



<!-- Agent IDs and icons: see CLAUDE.md Agent Catalog -->
