// renderers.js — Registry of artifact renderers
// Each renderer: (data, container) => void
// All renderers annotate elements with data-attributes for InteractiveEngine

const renderers = {
  mindmap: renderMindMap,
  table: renderTable,
  presentation: renderPresentation,
  diagram: renderDiagram,
  html_guide: renderHTMLGuide,
  image: renderImage,
  freeform: renderFreeform,
  timeline: renderTimeline,
  swot: renderSWOT,
  kanban: renderKanban,
  pros_cons: renderProsCons,
  matrix: renderMatrix,
  checklist: renderChecklist,
  donut_chart: renderDonutChart,
  quote_card: renderQuoteCard
};

function renderArtifact(type, data, container) {
  const renderer = renderers[type];
  if (renderer) {
    try {
      renderer(data, container);
    } catch (err) {
      console.error(`[Renderer:${type}] Error:`, err);
      container.innerHTML = `<div style="padding:20px;color:var(--red);">Render error in ${type}</div>`;
    }
  } else {
    container.innerHTML = `<div style="padding:20px;color:var(--text2);">Unknown renderer: ${type}</div>`;
  }
}

// --- MIND MAP ---
function renderMindMap(data, container) {
  if (!data.center || !data.branches) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid mind map data</div>';
    return;
  }

  const branches = data.branches || [];
  const W = 460, H = Math.max(280, branches.length * 55 + 60);
  const cx = W / 2, cy = H / 2;
  const branchRadius = Math.min(W, H) * 0.32;
  const angleStep = (2 * Math.PI) / Math.max(branches.length, 1);

  let svg = `<svg class="mindmap-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Lines layer (drawn first, behind nodes)
  branches.forEach((branch, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const bx = branch._x != null ? branch._x : cx + Math.cos(angle) * branchRadius;
    const by = branch._y != null ? branch._y : cy + Math.sin(angle) * branchRadius;
    svg += `<line class="edge" data-mm-line="branch-${i}" x1="${cx}" y1="${cy}" x2="${bx}" y2="${by}"/>`;

    const children = branch.children || [];
    const childAngleSpread = 0.6;
    const childRadius = 65;
    children.forEach((child, j) => {
      const childAngle = angle + (j - (children.length - 1) / 2) * (childAngleSpread / Math.max(1, children.length - 1));
      const chObj = typeof child === 'object' ? child : null;
      const chx = chObj && chObj._x != null ? chObj._x : bx + Math.cos(childAngle) * childRadius;
      const chy = chObj && chObj._y != null ? chObj._y : by + Math.sin(childAngle) * childRadius;
      svg += `<line class="edge" data-mm-line="child-${i}-${j}" x1="${bx}" y1="${by}" x2="${chx}" y2="${chy}" opacity="0.5"/>`;
    });
  });

  // Nodes layer
  branches.forEach((branch, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const bx = branch._x != null ? branch._x : cx + Math.cos(angle) * branchRadius;
    const by = branch._y != null ? branch._y : cy + Math.sin(angle) * branchRadius;

    const bLabel = (branch.label || '').substring(0, 25);
    const bw = Math.max(80, bLabel.length * 7 + 20);

    svg += `<g data-delete="branches.${i}" data-mm-node="branch-${i}" data-mm-idx="${i}" class="bs-node-group bs-mm-draggable" style="cursor:grab;">`;
    svg += `<rect class="node-branch" x="${bx - bw/2}" y="${by - 14}" width="${bw}" height="28" rx="14"/>`;
    svg += `<text data-edit="branches.${i}.label" x="${bx}" y="${by + 4}" text-anchor="middle" font-size="11">${escapeHtml(bLabel)}</text>`;
    svg += `</g>`;

    const children = branch.children || [];
    const childAngleSpread = 0.6;
    const childRadius = 65;
    children.forEach((child, j) => {
      const childAngle = angle + (j - (children.length - 1) / 2) * (childAngleSpread / Math.max(1, children.length - 1));
      const isString = typeof child === 'string';
      const chObj = isString ? null : child;
      const chx = chObj && chObj._x != null ? chObj._x : bx + Math.cos(childAngle) * childRadius;
      const chy = chObj && chObj._y != null ? chObj._y : by + Math.sin(childAngle) * childRadius;

      const cLabel = (isString ? child : child.label || '').substring(0, 20);
      const cw = Math.max(60, cLabel.length * 6.5 + 16);
      const editPath = isString ? `branches.${i}.children.${j}` : `branches.${i}.children.${j}.label`;

      svg += `<g data-delete="branches.${i}.children.${j}" data-mm-node="child-${i}-${j}" data-mm-branch="${i}" data-mm-child="${j}" class="bs-node-group bs-mm-draggable" style="cursor:grab;">`;
      svg += `<rect class="node-child" x="${chx - cw/2}" y="${chy - 10}" width="${cw}" height="20" rx="10"/>`;
      svg += `<text data-edit="${editPath}" x="${chx}" y="${chy + 3}" text-anchor="middle" font-size="9.5">${escapeHtml(cLabel)}</text>`;
      svg += `</g>`;
    });

    // Add child button
    const addAngle = angle + ((children.length) - (children.length - 1) / 2) * (childAngleSpread / Math.max(1, children.length));
    const addX = bx + Math.cos(addAngle) * childRadius;
    const addY = by + Math.sin(addAngle) * childRadius;
    svg += `<g data-add="branches.${i}.children" data-add-template='"New"' class="bs-svg-add" style="cursor:pointer;">`;
    svg += `<circle cx="${addX}" cy="${addY}" r="8" fill="var(--surface2)" stroke="var(--accent)" stroke-width="1" opacity="0.5"/>`;
    svg += `<text x="${addX}" y="${addY + 3.5}" text-anchor="middle" font-size="10" fill="var(--accent)" opacity="0.5">+</text>`;
    svg += `</g>`;
  });

  // Center node (on top)
  const centerLabel = (data.center || '').substring(0, 30);
  const centerW = Math.max(100, centerLabel.length * 8 + 24);
  svg += `<rect class="node-center" x="${cx - centerW/2}" y="${cy - 16}" width="${centerW}" height="32" rx="16"/>`;
  svg += `<text data-edit="center" x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="13" font-weight="600" fill="white">${escapeHtml(centerLabel)}</text>`;

  svg += '</svg>';

  const addBranchHTML = `<div data-add="branches" data-add-template='${escapeHtml(JSON.stringify({label:"New Branch",children:[]}))}' class="bs-add-zone" title="Add branch">+ Add branch</div>`;

  container.innerHTML = svg + addBranchHTML;
}

// --- TABLE ---
function renderTable(data, container) {
  if (!data.columns || !data.rows) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid table data</div>';
    return;
  }

  let html = '<table class="render-table"><thead><tr>';
  data.columns.forEach((col, ci) => {
    html += `<th data-edit="columns.${ci}">${escapeHtml(col)}</th>`;
  });
  html += '</tr></thead><tbody>';

  data.rows.forEach((row, ri) => {
    html += `<tr data-delete="rows.${ri}">`;
    row.forEach((cell, ci) => {
      if (typeof cell === 'object' && cell !== null && cell.text) {
        const tagClass = cell.tag ? `tag-${cell.tag}` : '';
        html += `<td data-edit="rows.${ri}.${ci}.text"><span class="tag ${tagClass}">${escapeHtml(cell.text)}</span></td>`;
      } else {
        html += `<td data-edit="rows.${ri}.${ci}">${escapeHtml(String(cell || ''))}</td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';

  // Add row button
  const emptyRow = JSON.stringify(data.columns.map(() => ''));
  html += `<div data-add="rows" data-add-template='${escapeHtml(emptyRow)}' class="bs-add-zone" title="Add row">+ Add row</div>`;

  container.innerHTML = html;
}

// --- PRESENTATION ---
function renderPresentation(data, container) {
  if (!data.slides || !data.slides.length) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid presentation data</div>';
    return;
  }

  let current = 0;
  const slides = data.slides;

  function renderSlide() {
    const slide = slides[current];
    let dots = slides.map((_, i) =>
      `<span class="slide-dot ${i === current ? 'active' : ''}" data-i="${i}"></span>`
    ).join('');

    container.innerHTML = `
      <div class="slides-container">
        <div class="slide-view">
          <h3 data-edit="slides.${current}.title">${escapeHtml(slide.title || '')}</h3>
          <ul>${(slide.bullets || []).map((b, bi) => `<li data-edit="slides.${current}.bullets.${bi}" data-delete="slides.${current}.bullets.${bi}">${escapeHtml(b)}</li>`).join('')}</ul>
          <div data-add="slides.${current}.bullets" data-add-template='""' class="bs-add-zone bs-add-zone-sm">+ Add bullet</div>
        </div>
        <div class="slide-nav">
          <button class="slide-prev">\u2039</button>
          ${dots}
          <button class="slide-next">\u203a</button>
          <span class="slide-counter">${current + 1} / ${slides.length}</span>
          <button class="bs-add-slide-btn" title="Add slide">+</button>
        </div>
      </div>
    `;

    container.querySelector('.slide-prev').onclick = (e) => {
      e.stopPropagation();
      if (current > 0) { current--; renderSlide(); }
    };
    container.querySelector('.slide-next').onclick = (e) => {
      e.stopPropagation();
      if (current < slides.length - 1) { current++; renderSlide(); }
    };
    container.querySelectorAll('.slide-dot').forEach(dot => {
      dot.onclick = (e) => {
        e.stopPropagation();
        current = parseInt(dot.dataset.i);
        renderSlide();
      };
    });

    // Add slide button
    const addSlideBtn = container.querySelector('.bs-add-slide-btn');
    if (addSlideBtn) {
      addSlideBtn.onclick = (e) => {
        e.stopPropagation();
        // We need the engine to emit this, but we're in renderer context
        // Store a custom event for the engine to pick up
        container.dispatchEvent(new CustomEvent('bs-add-slide', { bubbles: true }));
      };
    }
  }

  renderSlide();
}

// --- DIAGRAM (Mermaid) ---
function renderDiagram(data, container) {
  if (!data.mermaid) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid diagram data</div>';
    return;
  }

  const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
  container.innerHTML = `
    <div class="diagram-wrapper" style="position:relative;">
      <div class="diagram-container" id="${id}">${escapeHtml(data.mermaid)}</div>
      <button class="bs-edit-code-btn" title="Edit diagram source">Edit Code</button>
      <div class="bs-code-overlay" style="display:none;">
        <textarea class="bs-code-textarea" spellcheck="false">${escapeHtml(data.mermaid)}</textarea>
        <div class="bs-code-actions">
          <button class="btn bs-code-cancel">Cancel</button>
          <button class="btn btn-primary bs-code-save">Save</button>
        </div>
      </div>
    </div>
  `;

  // Edit code button opens overlay
  const editBtn = container.querySelector('.bs-edit-code-btn');
  const overlay = container.querySelector('.bs-code-overlay');
  const textarea = container.querySelector('.bs-code-textarea');
  const cancelBtn = container.querySelector('.bs-code-cancel');
  const saveBtn = container.querySelector('.bs-code-save');

  editBtn.onclick = (e) => {
    e.stopPropagation();
    textarea.value = data.mermaid;
    overlay.style.display = 'flex';
    textarea.focus();
  };
  cancelBtn.onclick = (e) => { e.stopPropagation(); overlay.style.display = 'none'; };
  saveBtn.onclick = (e) => {
    e.stopPropagation();
    overlay.style.display = 'none';
    // Dispatch custom event for InteractiveEngine to pick up
    container.dispatchEvent(new CustomEvent('bs-mermaid-save', { bubbles: true, detail: { value: textarea.value } }));
  };
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); overlay.style.display = 'none'; }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveBtn.click(); }
  });

  if (window.mermaid) {
    try {
      window.mermaid.render(id + '-svg', data.mermaid).then(({ svg }) => {
        const target = container.querySelector('.diagram-container');
        if (target && document.contains(container)) {
          target.innerHTML = svg;
        }
      }).catch(() => {
        if (document.contains(container)) {
          container.querySelector('.diagram-container').innerHTML = `<pre style="font-size:11px;color:var(--text2);padding:10px;white-space:pre-wrap;">${escapeHtml(data.mermaid)}</pre>`;
        }
      });
    } catch {
      container.querySelector('.diagram-container').innerHTML = `<pre style="font-size:11px;color:var(--text2);padding:10px;white-space:pre-wrap;">${escapeHtml(data.mermaid)}</pre>`;
    }
  }
}

// --- HTML GUIDE ---
function renderHTMLGuide(data, container) {
  const html = data.html || '<p>No content</p>';
  const iframe = document.createElement('iframe');
  iframe.className = 'guide-iframe';
  iframe.sandbox = 'allow-scripts';
  container.innerHTML = '';
  container.appendChild(iframe);
  iframe.srcdoc = BRAINSTORM_SDK_SCRIPT + html;
  iframe.onload = () => {
    try {
      iframe.style.height = iframe.contentDocument.body.scrollHeight + 20 + 'px';
    } catch {}
  };
}

// --- IMAGE (placeholder) ---
function renderImage(data, container) {
  if (data.imageUrl) {
    container.innerHTML = `<div class="image-container"><img src="${escapeHtml(data.imageUrl)}" alt="${escapeHtml(data.prompt || '')}"></div>`;
  } else {
    container.innerHTML = `
      <div class="image-placeholder">
        <div style="font-size:32px;margin-bottom:8px;">\ud83c\udfa8</div>
        <div style="font-size:13px;margin-bottom:4px;">Image generation coming soon</div>
        <div data-edit="prompt" style="font-size:11px;opacity:.7;">Prompt: "${escapeHtml((data.prompt || '').substring(0, 100))}"</div>
        <div data-edit="style" style="font-size:10px;margin-top:4px;">Style: ${escapeHtml(data.style || 'auto')}</div>
      </div>`;
  }
}

// --- FREEFORM ---
function renderFreeform(data, container) {
  if (!data.html || data.html.length < 20) {
    // Error with retry option
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'color:var(--text2);padding:20px;text-align:center;';
    errorDiv.innerHTML = `
      <div style="font-size:24px;margin-bottom:8px;">⚠️</div>
      <div style="margin-bottom:12px;">Failed to generate visualization.</div>
      <button onclick="this.closest('.artifact-card')?.querySelector('[data-action=expand]')?.click()"
        style="padding:6px 16px;border-radius:8px;border:1px solid var(--accent);background:var(--accent-a15);color:var(--accent2);cursor:pointer;font-family:inherit;">
        Try Again
      </button>
    `;
    container.innerHTML = '';
    container.appendChild(errorDiv);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'freeform-wrapper';

  const iframe = document.createElement('iframe');
  iframe.className = 'freeform-iframe';
  iframe.sandbox = 'allow-scripts';
  iframe.style.opacity = '0';
  iframe.style.transition = 'opacity 0.3s ease';

  // Check if we're in expand popup — use flexible height
  const inExpand = container.closest('.expand-content');

  const errorTimeout = setTimeout(() => {
    try {
      if (document.contains(wrapper) && (!iframe.contentDocument || !iframe.contentDocument.body || iframe.contentDocument.body.innerHTML.length < 10)) {
        wrapper.innerHTML = '<div style="color:var(--text2);padding:20px;text-align:center;">Visualization failed to render. <button onclick="location.reload()" style="color:var(--accent2);background:none;border:none;cursor:pointer;text-decoration:underline;">Reload</button></div>';
      }
    } catch {}
  }, 8000);

  iframe.onload = () => {
    clearTimeout(errorTimeout);
    iframe.style.opacity = '1';
    try {
      const body = iframe.contentDocument.body;
      const h = body.scrollHeight;
      if (!inExpand) {
        // Card view: cap height at 700px
        if (h > 50) iframe.style.height = Math.min(h + 20, 700) + 'px';
      }
      // Use ResizeObserver for dynamic content that renders asynchronously
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          try {
            const newH = body.scrollHeight;
            if (!inExpand && newH > 50) {
              iframe.style.height = Math.min(newH + 20, 700) + 'px';
            }
          } catch {}
        });
        ro.observe(body);
        // Cleanup after 30s to avoid indefinite observation
        setTimeout(() => ro.disconnect(), 30000);
      }
    } catch {}
  };

  wrapper.appendChild(iframe);
  container.innerHTML = '';
  container.appendChild(wrapper);
  iframe.srcdoc = BRAINSTORM_SDK_SCRIPT + data.html;
}

// --- TIMELINE ---
function renderTimeline(data, container) {
  if (!data.milestones || !data.milestones.length) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid timeline data</div>';
    return;
  }
  const ms = data.milestones;
  const statusColors = { done: 'var(--green)', current: 'var(--accent)', upcoming: 'var(--text2)' };

  let html = '<div class="timeline-container">';
  if (data.title) html += `<div class="timeline-title" data-edit="title">${escapeHtml(data.title)}</div>`;
  html += '<div class="timeline-track">';

  ms.forEach((m, i) => {
    const color = statusColors[m.status] || 'var(--text2)';
    const filled = m.status === 'done' || m.status === 'current';
    const isCurrent = m.status === 'current';
    html += `
      <div class="tl-item ${m.status}" data-delete="milestones.${i}">
        <div class="tl-dot" data-cycle="milestones.${i}.status" data-cycle-values='["upcoming","current","done"]' style="border-color:${color};${filled ? `background:${color}` : ''}${isCurrent ? ';box-shadow:0 0 8px ' + color : ''}" title="Click to change status"></div>
        ${i < ms.length - 1 ? `<div class="tl-line" style="background:${m.status === 'done' ? 'var(--green)' : 'var(--border)'}"></div>` : ''}
        <div class="tl-content">
          <div class="tl-label" data-edit="milestones.${i}.label" style="color:${color}">${escapeHtml(m.label || '')}</div>
          <div class="tl-date" data-edit="milestones.${i}.date">${escapeHtml(m.date || '')}</div>
          <div class="tl-desc" data-edit="milestones.${i}.description">${escapeHtml(m.description || '')}</div>
        </div>
      </div>`;
  });

  html += '</div>';
  html += `<div data-add="milestones" data-add-template='${escapeHtml(JSON.stringify({label:"New milestone",date:"",description:"",status:"upcoming"}))}' class="bs-add-zone">+ Add milestone</div>`;
  html += '</div>';
  container.innerHTML = html;
}

// --- SWOT ---
function renderSWOT(data, container) {
  if (!data.strengths) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid SWOT data</div>';
    return;
  }

  const quads = [
    { key: 'strengths', label: 'Strengths', color: 'var(--green)', icon: '\ud83d\udcaa' },
    { key: 'weaknesses', label: 'Weaknesses', color: 'var(--red)', icon: '\u26a0\ufe0f' },
    { key: 'opportunities', label: 'Opportunities', color: 'var(--blue)', icon: '\ud83d\ude80' },
    { key: 'threats', label: 'Threats', color: 'var(--orange)', icon: '\ud83d\udd25' }
  ];

  let html = '<div class="swot-grid">';
  quads.forEach(q => {
    const items = data[q.key] || [];
    html += `<div class="swot-quad" style="--q-color:${q.color};border-color:color-mix(in srgb, ${q.color} 20%, transparent)">
      <div class="swot-header" style="color:${q.color}">${q.icon} ${q.label}</div>
      <ul class="swot-list">${items.map((it, j) =>
        `<li data-edit="${q.key}.${j}" data-delete="${q.key}.${j}"><span class="swot-bullet" style="background:${q.color}"></span>${escapeHtml(it)}</li>`
      ).join('')}</ul>
      <div data-add="${q.key}" data-add-template='"New item"' class="bs-add-zone bs-add-zone-sm">+ Add</div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// --- KANBAN ---
function renderKanban(data, container) {
  if (!data.columns) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid kanban data</div>';
    return;
  }

  const colColors = { 'To Do': 'var(--red)', 'In Progress': 'var(--orange)', 'Done': 'var(--green)' };
  const tagColors = { feature: 'var(--accent)', bug: 'var(--red)', research: 'var(--blue)', design: 'var(--pink)', infra: 'var(--orange)', docs: 'var(--green)' };

  let html = '<div class="kanban-board">';
  data.columns.forEach((col, ci) => {
    const color = colColors[col.name] || 'var(--accent)';
    html += `<div class="kanban-col">
      <div class="kanban-col-header" data-edit="columns.${ci}.name" style="border-bottom-color:${color}">
        <span style="color:${color}">${escapeHtml(col.name)}</span>
        <span class="kanban-count" style="background:color-mix(in srgb, ${color} 20%, transparent);color:${color}">${(col.cards || []).length}</span>
      </div>
      <div class="kanban-cards" data-drag-target="columns.${ci}.cards">`;
    (col.cards || []).forEach((card, cardi) => {
      const tc = tagColors[card.tag] || 'var(--text2)';
      html += `<div class="kanban-card" data-drag-item="columns.${ci}.cards.${cardi}" data-delete="columns.${ci}.cards.${cardi}">
        <div class="kanban-card-title" data-edit="columns.${ci}.cards.${cardi}.title">${escapeHtml(card.title)}</div>
        ${card.tag ? `<span class="kanban-tag" style="background:color-mix(in srgb, ${tc} 20%, transparent);color:${tc}">${escapeHtml(card.tag)}</span>` : ''}
      </div>`;
    });
    html += `</div>
      <div data-add="columns.${ci}.cards" data-add-template='${escapeHtml(JSON.stringify({title:"New card",tag:""}))}' class="bs-add-zone bs-add-zone-sm">+ Add card</div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// --- PROS & CONS ---
function renderProsCons(data, container) {
  if (!data.pros || !data.cons) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid pros/cons data</div>';
    return;
  }

  let html = '<div class="proscons-container">';
  if (data.title) html += `<div class="proscons-title" data-edit="title">${escapeHtml(data.title)}</div>`;
  html += '<div class="proscons-grid">';

  html += '<div class="proscons-col pros"><div class="proscons-header" style="color:var(--green)">\u2713 Pros</div>';
  data.pros.forEach((p, i) => { html += `<div class="proscons-item" data-edit="pros.${i}" data-delete="pros.${i}"><span class="pc-icon" style="color:var(--green)">+</span>${escapeHtml(p)}</div>`; });
  html += `<div data-add="pros" data-add-template='"New pro"' class="bs-add-zone bs-add-zone-sm">+ Add pro</div>`;
  html += '</div>';

  html += '<div class="proscons-col cons"><div class="proscons-header" style="color:var(--red)">\u2717 Cons</div>';
  data.cons.forEach((c, i) => { html += `<div class="proscons-item" data-edit="cons.${i}" data-delete="cons.${i}"><span class="pc-icon" style="color:var(--red)">\u2212</span>${escapeHtml(c)}</div>`; });
  html += `<div data-add="cons" data-add-template='"New con"' class="bs-add-zone bs-add-zone-sm">+ Add con</div>`;
  html += '</div>';

  html += '</div>';
  if (data.verdict) html += `<div class="proscons-verdict" data-edit="verdict">${escapeHtml(data.verdict)}</div>`;
  html += '</div>';
  container.innerHTML = html;
}

// --- MATRIX 2x2 ---
function renderMatrix(data, container) {
  if (!data.quadrants || data.quadrants.length < 4) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid matrix data</div>';
    return;
  }

  const colors = ['var(--green)', 'var(--blue)', 'var(--orange)', 'var(--red)'];
  const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

  let html = '<div class="matrix-container">';
  html += `<div class="matrix-axis-y"><span data-edit="axisY">\u2191 ${escapeHtml(data.axisY || 'Impact')}</span></div>`;
  html += '<div class="matrix-grid">';

  data.quadrants.forEach((q, i) => {
    html += `<div class="matrix-quad ${positions[i]}" style="border-color:color-mix(in srgb, ${colors[i]} 30%, transparent)" data-drag-target="quadrants.${i}.items">
      <div class="matrix-quad-label" data-edit="quadrants.${i}.label" style="color:${colors[i]}">${escapeHtml(q.label)}</div>
      <div class="matrix-items">${(q.items || []).map((it, j) =>
        `<span class="matrix-chip" data-edit="quadrants.${i}.items.${j}" data-delete="quadrants.${i}.items.${j}" data-drag-item="quadrants.${i}.items.${j}" style="background:color-mix(in srgb, ${colors[i]} 15%, transparent);border-color:color-mix(in srgb, ${colors[i]} 40%, transparent);color:${colors[i]}">${escapeHtml(it)}</span>`
      ).join('')}</div>
      <div data-add="quadrants.${i}.items" data-add-template='"New item"' class="bs-add-zone bs-add-zone-sm">+ Add</div>
    </div>`;
  });

  html += '</div>';
  html += `<div class="matrix-axis-x" data-edit="axisX">${escapeHtml(data.axisX || 'Effort')} \u2192</div>`;
  html += '</div>';
  container.innerHTML = html;
}

// --- CHECKLIST ---
function renderChecklist(data, container) {
  if (!data.items) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid checklist data</div>';
    return;
  }

  const doneCount = data.items.filter(i => i.done).length;
  const total = data.items.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  let html = '<div class="checklist-container">';
  if (data.title) html += `<div class="checklist-title" data-edit="title">${escapeHtml(data.title)}</div>`;
  html += `<div class="checklist-progress">
    <div class="checklist-bar"><div class="checklist-bar-fill" style="width:${pct}%"></div></div>
    <span class="checklist-count">${doneCount} / ${total}</span>
  </div>`;

  data.items.forEach((item, i) => {
    html += `<div class="checklist-item ${item.done ? 'done' : ''}" data-delete="items.${i}">
      <div class="checklist-check" data-toggle="items.${i}.done">${item.done ? '\u2713' : ''}</div>
      <span class="checklist-text" data-edit="items.${i}.text">${escapeHtml(item.text)}</span>
    </div>`;
  });

  html += `<div data-add="items" data-add-template='${escapeHtml(JSON.stringify({text:"New item",done:false}))}' class="bs-add-zone bs-add-zone-sm">+ Add item</div>`;
  html += '</div>';
  container.innerHTML = html;
}

// --- DONUT CHART ---
function renderDonutChart(data, container) {
  if (!data.segments || !data.segments.length) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid chart data</div>';
    return;
  }

  const colorMap = {
    purple: 'var(--accent)', blue: 'var(--blue)', green: 'var(--green)',
    yellow: 'var(--orange)', red: 'var(--red)', pink: 'var(--pink)', orange: '#e17055'
  };

  const total = data.segments.reduce((sum, s) => sum + s.value, 0);
  const size = 160, cx = size / 2, cy = size / 2, r = 60, strokeW = 20;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  let arcs = '';
  data.segments.forEach(seg => {
    const pct = seg.value / total;
    const dashLen = pct * circumference;
    const color = colorMap[seg.color] || seg.color || 'var(--accent)';
    arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      style="stroke:${color}" stroke-width="${strokeW}"
      stroke-dasharray="${dashLen} ${circumference - dashLen}"
      stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += dashLen;
  });

  let legend = data.segments.map((seg, i) => {
    const color = colorMap[seg.color] || seg.color || 'var(--accent)';
    const pct = Math.round((seg.value / total) * 100);
    return `<div class="donut-legend-item" data-delete="segments.${i}">
      <span class="donut-legend-dot" style="background:${color}"></span>
      <span class="donut-legend-label" data-edit="segments.${i}.label">${escapeHtml(seg.label)}</span>
      <span class="donut-legend-value" data-edit="segments.${i}.value" style="color:${color}">${pct}%</span>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="donut-container">
    <div class="donut-chart">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${arcs}</svg>
      <div class="donut-center" data-edit="centerLabel">${escapeHtml(data.centerLabel || '')}</div>
    </div>
    <div class="donut-legend">${legend}</div>
    <div data-add="segments" data-add-template='${escapeHtml(JSON.stringify({label:"New",value:10,color:"purple"}))}' class="bs-add-zone bs-add-zone-sm">+ Add segment</div>
  </div>`;
}

// --- QUOTE / INSIGHT CARD ---
function renderQuoteCard(data, container) {
  if (!data.quote) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid quote data</div>';
    return;
  }

  container.innerHTML = `<div class="quote-container">
    ${data.tag ? `<span class="quote-tag" data-cycle="tag" data-cycle-values='["Key Insight","Decision","Action Item","Vision","Problem","Opportunity"]'>${escapeHtml(data.tag)}</span>` : ''}
    <div class="quote-mark">"</div>
    <div class="quote-text" data-edit-multiline="quote">${escapeHtml(data.quote)}</div>
    ${data.author ? `<div class="quote-author" data-edit="author">\u2014 ${escapeHtml(data.author)}</div>` : ''}
    ${data.supporting ? `<div class="quote-supporting" data-edit="supporting">${escapeHtml(data.supporting)}</div>` : ''}
  </div>`;
}

// --- Brainstorm SDK for iframes (freeform / html_guide) ---
const BRAINSTORM_SDK_SCRIPT = `<script>
(function() {
  window.brainstorm = {
    _callbacks: [],
    edit: function(path, value) {
      parent.postMessage({ type: 'bs-patch', path: path, value: value }, '*');
    },
    add: function(arrayPath, item) {
      parent.postMessage({ type: 'bs-array-op', op: { type: 'insert', path: arrayPath, value: item } }, '*');
    },
    delete: function(arrayPath, index) {
      parent.postMessage({ type: 'bs-array-op', op: { type: 'remove', path: arrayPath + '.' + index } }, '*');
    },
    getData: function() {
      return new Promise(function(resolve) {
        var handler = function(e) {
          if (e.data && e.data.type === 'bs-data-response') {
            window.removeEventListener('message', handler);
            resolve(e.data.data);
          }
        };
        window.addEventListener('message', handler);
        parent.postMessage({ type: 'bs-get-data' }, '*');
      });
    },
    onUpdate: function(callback) {
      brainstorm._callbacks.push(callback);
    },
    markEditable: function(el, path) {
      if (!el) return;
      el.contentEditable = true;
      el.style.cursor = 'text';
      el.style.outline = 'none';
      el.addEventListener('blur', function() {
        brainstorm.edit(path, el.textContent.trim());
      });
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
      });
    }
  };
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'bs-data-update') {
      brainstorm._callbacks.forEach(function(cb) { cb(e.data.data); });
    }
  });
})();
<\/script>`;

// --- Utility ---
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Expose to ES modules (loaded as global script before app.js module)
window.renderArtifact = renderArtifact;
