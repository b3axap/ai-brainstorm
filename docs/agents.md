# Adding a New Agent

## What is an Agent?

An agent is a JSON config file that defines a visualization type. It tells Claude how to generate structured data, and maps to a renderer function that turns that data into interactive HTML/SVG.

## Step-by-Step

### 1. Create `agents/your_agent.json`

Follow the schema in `agents/_schema.json`:

```json
{
  "id": "your_agent",
  "name": "Your Agent",
  "icon": "🎯",
  "description": "Short description for the picker UI",
  "keywords": ["keyword1", "keyword2"],
  "renderer": "your_agent",
  "systemPrompt": "You are a ... generator. Based on the conversation context, create a ...\n\nRules:\n- ...\n\nRespond with ONLY valid JSON, no other text:\n{...}",
  "outputExample": {
    "title": "Example",
    "items": ["Item 1", "Item 2"]
  },
  "externalAPI": null
}
```

### Required Fields

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Lowercase + underscores only: `^[a-z_]+$` |
| `name` | string | Display name in viz picker |
| `icon` | string | Single emoji |
| `description` | string | One line, shown in picker |
| `keywords` | string[] | Claude uses these to suggest this agent |
| `renderer` | string | Must match key in `renderers` object |
| `systemPrompt` | string | Instructions for Claude. Must end with "Respond with ONLY valid JSON" |
| `outputExample` | object | Example JSON output — Claude sees this as a reference |
| `externalAPI` | null or object | `null` for Claude-based agents |

### systemPrompt Tips

- End with the exact JSON schema Claude should output
- Include constraints: max chars, max items, structure rules
- Be explicit: "Respond with ONLY valid JSON, no other text"
- The prompt receives full room context (artifacts, chat history) via `buildContext()`

### 2. Add renderer to `public/renderers.js`

```js
function renderYourAgent(data, container) {
  let html = '<div class="your-agent">';
  html += `<h3 data-edit="title">${escapeHtml(data.title)}</h3>`;

  (data.items || []).forEach((item, i) => {
    html += `<div class="your-item" data-delete="items.${i}">
      <span data-edit="items.${i}">${escapeHtml(item)}</span>
      <button class="bs-delete-btn" data-delete="items.${i}">×</button>
    </div>`;
  });

  html += `<div data-add="items" data-add-template='"New item"' class="bs-add-zone">+ Add item</div>`;
  html += '</div>';
  container.innerHTML = html;
}
```

Register in the `renderers` object at the bottom of the file:

```js
const renderers = {
  // ... existing renderers ...
  your_agent: renderYourAgent,
};
```

### 3. Add `data-*` attributes for interactivity

The `InteractiveEngine` picks up these attributes automatically — no handler code needed:

| What you want | Attribute | Example |
|---------------|-----------|---------|
| Editable text | `data-edit="path"` | `data-edit="items.0.text"` |
| Multiline edit | `data-edit-multiline="path"` | `data-edit-multiline="description"` |
| Boolean toggle | `data-toggle="path"` | `data-toggle="items.0.done"` |
| Cycle values | `data-cycle="path"` + `data-cycle-values='["a","b"]'` | Status cycling |
| Add to array | `data-add="arrayPath"` + `data-add-template='json'` | `data-add="items"` |
| Delete from array | `data-delete="path"` | `data-delete="items.2"` |
| Drag item | `data-drag-item="path"` | `data-drag-item="columns.0.cards.1"` |
| Drop target | `data-drag-target="arrayPath"` | `data-drag-target="columns.1.cards"` |

See [`interactivity.md`](interactivity.md) for full details.

### 4. Add CSS to `public/style.css`

```css
.your-agent {
  padding: 12px;
}
.your-agent h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text);
}
.your-item {
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  position: relative;
}
```

Use existing CSS variables from the design system (`--bg`, `--surface`, `--text`, `--accent`, etc.). See [`design-system.md`](design-system.md).

### 5. Restart

Agents are auto-loaded from `agents/` at startup by `agents.js`. No registration needed.

```bash
npm start
# "Loaded 16 agents: ..., your_agent"
```

## JSON Schema Reference

The schema file `agents/_schema.json` validates:

```
id:           ^[a-z_]+$
name:         string
icon:         string (emoji)
description:  string
keywords:     string[]
renderer:     string (must match renderers object key)
systemPrompt: string
outputExample: object (structure matches what Claude outputs)
externalAPI:  null | { provider, endpoint, envKey }
```

## Existing Output Schemas

| Agent | Schema |
|-------|--------|
| mindmap | `{center, branches: [{label, children: [string]}]}` |
| table | `{title, columns: [string], rows: [[string \| {text, tag}]]}` |
| kanban | `{title, columns: [{name, cards: [{title, tag?}]}]}` |
| presentation | `{title, slides: [{title, bullets: [string]}]}` |
| timeline | `{title, milestones: [{label, date, description, status}]}` |
| swot | `{title, strengths: [string], weaknesses: [...], opportunities: [...], threats: [...]}` |
| checklist | `{title, items: [{text, done}]}` |
| pros_cons | `{title, pros: [string], cons: [string], verdict}` |
| matrix | `{title, xAxis, yAxis, quadrants: [{label, items: [string]}]}` |
| donut_chart | `{title, segments: [{label, value}], center}` |
| quote_card | `{quote, author, tag}` |
| diagram | `{title, mermaid: "graph LR; ..."}` |
| freeform | `{html, css, js}` (rendered in iframe with Brainstorm SDK) |
| html_guide | `{html, css, js}` (rendered in iframe with Brainstorm SDK) |
| image | `{prompt, style}` (placeholder — no API connected) |

## Checklist

- [ ] `agents/your_agent.json` created and valid
- [ ] `systemPrompt` ends with "Respond with ONLY valid JSON"
- [ ] `outputExample` matches the JSON structure in systemPrompt
- [ ] Renderer function added to `renderers.js` and registered
- [ ] `data-*` attributes added for editing, adding, deleting
- [ ] CSS added with design system variables
- [ ] Server restarted, agent appears in log and viz picker
