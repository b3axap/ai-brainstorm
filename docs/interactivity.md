# Interactivity System (Data-Attribute Protocol)

All 15 visualization types are interactive. Renderers **declare** what's interactive via `data-*` attributes. `InteractiveEngine` (`interactive.js`) provides behavior generically — no per-renderer handler code.

## Data-Attribute Protocol

| Attribute | User Action | Effect | Example |
|-----------|-------------|--------|---------|
| `data-edit="path"` | Double-click | Inline text input → `artifact-data-patch` | `data-edit="branches.0.label"` |
| `data-edit-multiline="path"` | Double-click | Textarea (Ctrl+Enter saves) | `data-edit-multiline="quote"` |
| `data-toggle="path"` | Click | Flips boolean | `data-toggle="items.2.done"` |
| `data-cycle="path"` + `data-cycle-values='[...]'` | Click | Cycles to next value | `data-cycle="milestones.0.status"` |
| `data-add="arrayPath"` + `data-add-template='json'` | Click "+" | Appends to array → `artifact-array-op` | `data-add="branches"` |
| `data-delete="path"` | Click "x" | Removes from array → `artifact-array-op` | `data-delete="branches.2"` |
| `data-drag-item="path"` | Drag | Draggable (HTML5 drag API) | `data-drag-item="columns.0.cards.1"` |
| `data-drag-target="arrayPath"` | Drop | Receives dragged items → `artifact-array-op` move | `data-drag-target="columns.1.cards"` |

## Adding interactivity to a new renderer

Just add attributes in your renderer HTML. No changes to `interactive.js`:

```js
function renderMyViz(data, container) {
  let html = '<div class="my-viz">';
  html += `<h3 data-edit="title">${escapeHtml(data.title)}</h3>`;

  data.items.forEach((item, i) => {
    html += `<div data-delete="items.${i}">
      <span data-edit="items.${i}.text">${escapeHtml(item.text)}</span>
      <span data-toggle="items.${i}.done">${item.done ? '✓' : '○'}</span>
    </div>`;
  });

  html += `<div data-add="items" data-add-template='${escapeHtml(JSON.stringify({text:"New",done:false}))}' class="bs-add-zone">+ Add</div>`;
  html += '</div>';
  container.innerHTML = html;
}
```

## Interactivity per renderer

| Renderer | Edit | Toggle | Cycle | Add/Delete | Drag |
|----------|------|--------|-------|------------|------|
| mindmap | center, branch labels, children | — | — | branches, children | SVG node drag (mousedown) |
| table | cells, column headers | — | — | rows | — |
| presentation | slide titles, bullets | — | — | bullets, slides | — |
| diagram | mermaid source (code editor) | — | — | — | — |
| timeline | labels, dates, descriptions | — | status | milestones | — |
| swot | items per quadrant | — | — | items | — |
| kanban | card titles, column names | — | — | cards | cards between columns |
| checklist | item text, title | done | — | items | — |
| pros_cons | pros, cons, verdict, title | — | — | pros, cons | — |
| matrix | labels, items, axes | — | — | items | items between quadrants |
| donut_chart | labels, values, center | — | — | segments | — |
| quote_card | quote (multiline), author | — | tag type | — | — |
| image | prompt, style | — | — | — | — |
| freeform | via Brainstorm SDK | via SDK | — | via SDK | — |
| html_guide | via Brainstorm SDK | via SDK | — | via SDK | — |

## Server-side: `artifact-array-op`

```
{ roomId, artifactId, op: { type: 'insert'|'remove'|'move', path, value?, toPath? } }
```

- **insert**: appends `value` to array at `path`
- **remove**: splices item at `path` (e.g. `"branches.2"` removes index 2)
- **move**: removes from `path`, appends to `toPath` (drag-and-drop)

All ops broadcast `artifact-updated` with full data.

## Brainstorm SDK (freeform / html_guide iframes)

Iframes get `window.brainstorm` via `postMessage`. The SDK script is defined as `BRAINSTORM_SDK_SCRIPT` in `renderers.js` (lines 611-658) and prepended to the iframe's `srcdoc`.

### SDK API

```js
brainstorm.markEditable(element, 'path.to.field');  // make text editable
brainstorm.edit('path', value);                      // scalar patch
brainstorm.add('arrayPath', newItem);                // append
brainstorm.delete('arrayPath', index);               // remove
brainstorm.onUpdate(data => { /* re-render */ });    // react to others
const data = await brainstorm.getData();             // current data
```

### How SDK communicates with the parent

The iframe uses `postMessage` to talk to `InteractiveEngine` (in `interactive.js`, `attachIframeHandlers`):

1. **iframe → parent**: `postMessage({ type: 'bs-patch', path, value })` or `bs-array-op`
2. **parent → iframe**: `postMessage({ type: 'bs-data-update', data })` when another user edits
3. **iframe → parent**: `postMessage({ type: 'bs-get-data' })` → parent replies with `bs-data-response`

### Recommended pattern for custom visualizations

The freeform agent's system prompt teaches Claude the **state + render** pattern:

```js
const state = { title: 'My Viz', items: [] };
function render() {
  document.getElementById('app').innerHTML = `...`;
  brainstorm.markEditable(el, 'title');
  state.items.forEach((item, i) => {
    brainstorm.markEditable(itemEl, `items.${i}.text`);
  });
}
brainstorm.onUpdate(data => { Object.assign(state, data); render(); });
render();
```

This ensures collaborative edits from other users trigger a full re-render with the updated data.

The freeform agent's systemPrompt documents this SDK so Claude uses `brainstorm.markEditable()` automatically.

## Engine lifecycle

1. Renderer outputs HTML with data-attributes into `.artifact-body`
2. `new InteractiveEngine(card, artifact, socket)` scans body, attaches handlers
3. User interacts → engine emits `artifact-data-patch` or `artifact-array-op`
4. Server patches data, broadcasts `artifact-updated`
5. Client re-renders body, creates new engine (old auto-destroyed)
6. Iframes: engine forwards data via `postMessage` → SDK `onUpdate` fires

## SVG editing (mindmap)

SVG `<text>` with `data-edit` → engine injects `<foreignObject>` with `<input>` overlay, adapted for SVG coordinates.

## Mindmap node dragging

Branch and child nodes have `data-mm-node` and class `bs-mm-draggable`. The engine's `attachMindmapDrag()` handles:
1. **mousedown** on `.bs-mm-draggable` → records start position via `svg.createSVGPoint()` + `getScreenCTM().inverse()`
2. **mousemove** → updates `<rect>` x/y, `<text>` x/y, and connected `<line>` endpoints in real-time
3. **mouseup** → emits `branches.{i}._x` / `._y` position patches (or converts string children to objects with `_x/_y`)

Renderer reads `branch._x` / `branch._y` if present, falls back to angle-based layout. Lines use `data-mm-line="branch-{i}"` / `"child-{i}-{j}"` for targeted updates during drag.

## Diagram code editor

"Edit Code" button opens a `bs-code-overlay` over the diagram with a monospace `<textarea>`. Save button (or Ctrl+S) dispatches `bs-mermaid-save` custom event → engine catches it → emits `mermaid` patch → re-render.

## Artifact expand popup

`#artifactExpandModal` — a large (90vw/85vh) modal that renders any artifact at full size with:
- **Toolbar**: AI Expand, Transform, Copy, PNG, Delete (always visible, not hover-only)
- **Add/delete buttons** at higher opacity than canvas cards
- **Ask bar** at the bottom
- **InteractiveEngine** attached — all data-attribute editing works inside the popup
- **Real-time sync**: `artifact-updated` events refresh the popup if open

Open via: "Open" button in action bar, or double-click on card header.

## CSS classes

| Class | Purpose |
|-------|---------|
| `.bs-input` | Inline edit input/textarea |
| `.bs-editing` | Element being edited (outline) |
| `.bs-add-btn` | "+" button (hover-reveal) |
| `.bs-add-zone` | Dashed "+" area (click to add) |
| `.bs-delete-btn` | "x" button (hover-reveal) |
| `.bs-dragging` | Element being dragged |
| `.bs-drag-over` | Drop target being hovered |
| `.bs-interactive` | Clickable toggle/cycle |
| `.bs-edit-code-btn` | Diagram code editor button |
| `.bs-code-overlay` | Diagram code editor overlay |
| `.bs-code-textarea` | Monospace textarea for mermaid source |
| `.bs-mm-draggable` | Mindmap draggable node group |
| `.bs-add-slide-btn` | Presentation add slide button |
| `.expand-modal` | Artifact expand popup container |
| `.expand-toolbar` | Expand popup toolbar buttons |
| `.expand-content` | Expand popup body (renderers draw here) |
| `.expand-loading` | Expand popup loading spinner overlay |
