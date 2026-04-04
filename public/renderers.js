// renderers.js — Registry of artifact renderers
// Each renderer: (data, container) => void

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
    renderer(data, container);
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

  const W = 460, H = Math.max(250, data.branches.length * 50);
  const cx = W / 2, cy = H / 2;

  let svg = `<svg class="mindmap-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  const branches = data.branches || [];
  const angleStep = (2 * Math.PI) / branches.length;
  const branchRadius = Math.min(W, H) * 0.32;

  branches.forEach((branch, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const bx = cx + Math.cos(angle) * branchRadius;
    const by = cy + Math.sin(angle) * branchRadius;

    // Line from center to branch
    svg += `<line class="edge" x1="${cx}" y1="${cy}" x2="${bx}" y2="${by}"/>`;

    // Branch node
    const bLabel = (branch.label || '').substring(0, 25);
    const bw = Math.max(80, bLabel.length * 7 + 20);
    svg += `<rect class="node-branch" x="${bx - bw/2}" y="${by - 14}" width="${bw}" height="28" rx="14"/>`;
    svg += `<text x="${bx}" y="${by + 4}" text-anchor="middle" font-size="11">${escapeHtml(bLabel)}</text>`;

    // Children
    const children = branch.children || [];
    const childAngleSpread = 0.6;
    const childRadius = 65;
    children.forEach((child, j) => {
      const childAngle = angle + (j - (children.length - 1) / 2) * (childAngleSpread / Math.max(1, children.length - 1));
      const chx = bx + Math.cos(childAngle) * childRadius;
      const chy = by + Math.sin(childAngle) * childRadius;

      svg += `<line class="edge" x1="${bx}" y1="${by}" x2="${chx}" y2="${chy}" opacity="0.5"/>`;
      const cLabel = (typeof child === 'string' ? child : child.label || '').substring(0, 20);
      const cw = Math.max(60, cLabel.length * 6.5 + 16);
      svg += `<rect class="node-child" x="${chx - cw/2}" y="${chy - 10}" width="${cw}" height="20" rx="10"/>`;
      svg += `<text x="${chx}" y="${chy + 3}" text-anchor="middle" font-size="9.5">${escapeHtml(cLabel)}</text>`;
    });
  });

  // Center node (drawn last, on top)
  const centerLabel = (data.center || '').substring(0, 30);
  const centerW = Math.max(100, centerLabel.length * 8 + 24);
  svg += `<rect class="node-center" x="${cx - centerW/2}" y="${cy - 16}" width="${centerW}" height="32" rx="16"/>`;
  svg += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="13" font-weight="600" fill="white">${escapeHtml(centerLabel)}</text>`;

  svg += '</svg>';
  container.innerHTML = svg;
}

// --- TABLE ---
function renderTable(data, container) {
  if (!data.columns || !data.rows) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid table data</div>';
    return;
  }

  let html = '<table class="render-table"><thead><tr>';
  data.columns.forEach(col => {
    html += `<th>${escapeHtml(col)}</th>`;
  });
  html += '</tr></thead><tbody>';

  data.rows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => {
      if (typeof cell === 'object' && cell !== null && cell.text) {
        const tagClass = cell.tag ? `tag-${cell.tag}` : '';
        html += `<td><span class="tag ${tagClass}">${escapeHtml(cell.text)}</span></td>`;
      } else {
        html += `<td>${escapeHtml(String(cell || ''))}</td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
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
          <h3>${escapeHtml(slide.title || '')}</h3>
          <ul>${(slide.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
        </div>
        <div class="slide-nav">
          <button class="slide-prev">\u2039</button>
          ${dots}
          <button class="slide-next">\u203a</button>
          <span class="slide-counter">${current + 1} / ${slides.length}</span>
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
  container.innerHTML = `<div class="diagram-container" id="${id}">${escapeHtml(data.mermaid)}</div>`;

  // Render with mermaid.js if available
  if (window.mermaid) {
    try {
      window.mermaid.render(id + '-svg', data.mermaid).then(({ svg }) => {
        // Guard: check container is still in the DOM before updating
        const target = container.querySelector('.diagram-container');
        if (target && document.contains(container)) {
          target.innerHTML = svg;
        }
      }).catch(() => {
        if (document.contains(container)) {
          container.innerHTML = `<pre style="font-size:11px;color:var(--text2);padding:10px;white-space:pre-wrap;">${escapeHtml(data.mermaid)}</pre>`;
        }
      });
    } catch {
      container.innerHTML = `<pre style="font-size:11px;color:var(--text2);padding:10px;white-space:pre-wrap;">${escapeHtml(data.mermaid)}</pre>`;
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
  iframe.srcdoc = html;
  // Auto-resize
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
        <div style="font-size:11px;opacity:.7;">Prompt: "${escapeHtml((data.prompt || '').substring(0, 100))}"</div>
        <div style="font-size:10px;margin-top:4px;">Style: ${escapeHtml(data.style || 'auto')}</div>
      </div>`;
  }
}

// --- FREEFORM ---
function renderFreeform(data, container) {
  if (!data.html || data.html.length < 20) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Failed to generate visualization. Try again.</div>';
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'freeform-wrapper';

  const iframe = document.createElement('iframe');
  iframe.className = 'freeform-iframe';
  iframe.sandbox = 'allow-scripts';

  // Error boundary: show fallback if iframe fails to render content
  const errorTimeout = setTimeout(() => {
    try {
      if (document.contains(wrapper) && (!iframe.contentDocument || !iframe.contentDocument.body || iframe.contentDocument.body.innerHTML.length < 10)) {
        wrapper.innerHTML = '<div style="color:var(--text2);padding:20px;">Visualization failed to render.</div>';
      }
    } catch {}
  }, 5000);

  iframe.onload = () => {
    clearTimeout(errorTimeout);
    try {
      const h = iframe.contentDocument.body.scrollHeight;
      if (h > 50) iframe.style.height = Math.min(h + 20, 700) + 'px';
    } catch {}
  };

  wrapper.appendChild(iframe);
  container.innerHTML = '';
  container.appendChild(wrapper);
  iframe.srcdoc = data.html;
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
  if (data.title) html += `<div class="timeline-title">${escapeHtml(data.title)}</div>`;
  html += '<div class="timeline-track">';

  ms.forEach((m, i) => {
    const color = statusColors[m.status] || 'var(--text2)';
    const filled = m.status === 'done' || m.status === 'current';
    const isCurrent = m.status === 'current';
    html += `
      <div class="tl-item ${m.status}">
        <div class="tl-dot" style="border-color:${color};${filled ? `background:${color}` : ''}${isCurrent ? ';box-shadow:0 0 8px ' + color : ''}"></div>
        ${i < ms.length - 1 ? `<div class="tl-line" style="background:${m.status === 'done' ? 'var(--green)' : 'var(--border)'}"></div>` : ''}
        <div class="tl-content">
          <div class="tl-label" style="color:${color}">${escapeHtml(m.label || '')}</div>
          <div class="tl-date">${escapeHtml(m.date || '')}</div>
          <div class="tl-desc">${escapeHtml(m.description || '')}</div>
        </div>
      </div>`;
  });

  html += '</div></div>';
  container.innerHTML = html;
}

// --- SWOT ---
function renderSWOT(data, container) {
  if (!data.strengths) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid SWOT data</div>';
    return;
  }

  const quads = [
    { key: 'strengths', label: 'Strengths', color: 'var(--green)', icon: '💪' },
    { key: 'weaknesses', label: 'Weaknesses', color: 'var(--red)', icon: '⚠️' },
    { key: 'opportunities', label: 'Opportunities', color: 'var(--blue)', icon: '🚀' },
    { key: 'threats', label: 'Threats', color: 'var(--orange)', icon: '🔥' }
  ];

  let html = '<div class="swot-grid">';
  quads.forEach(q => {
    const items = data[q.key] || [];
    html += `<div class="swot-quad" style="border-color:${q.color}20">
      <div class="swot-header" style="color:${q.color}">${q.icon} ${q.label}</div>
      <ul class="swot-list">${items.map(it => `<li><span class="swot-bullet" style="background:${q.color}"></span>${escapeHtml(it)}</li>`).join('')}</ul>
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
  data.columns.forEach(col => {
    const color = colColors[col.name] || 'var(--accent)';
    html += `<div class="kanban-col">
      <div class="kanban-col-header" style="border-bottom-color:${color}">
        <span style="color:${color}">${escapeHtml(col.name)}</span>
        <span class="kanban-count" style="background:${color}20;color:${color}">${(col.cards || []).length}</span>
      </div>
      <div class="kanban-cards">`;
    (col.cards || []).forEach(card => {
      const tc = tagColors[card.tag] || 'var(--text2)';
      html += `<div class="kanban-card">
        <div class="kanban-card-title">${escapeHtml(card.title)}</div>
        ${card.tag ? `<span class="kanban-tag" style="background:${tc}20;color:${tc}">${escapeHtml(card.tag)}</span>` : ''}
      </div>`;
    });
    html += '</div></div>';
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
  if (data.title) html += `<div class="proscons-title">${escapeHtml(data.title)}</div>`;
  html += '<div class="proscons-grid">';

  html += '<div class="proscons-col pros"><div class="proscons-header" style="color:var(--green)">✓ Pros</div>';
  data.pros.forEach(p => { html += `<div class="proscons-item"><span class="pc-icon" style="color:var(--green)">+</span>${escapeHtml(p)}</div>`; });
  html += '</div>';

  html += '<div class="proscons-col cons"><div class="proscons-header" style="color:var(--red)">✗ Cons</div>';
  data.cons.forEach(c => { html += `<div class="proscons-item"><span class="pc-icon" style="color:var(--red)">−</span>${escapeHtml(c)}</div>`; });
  html += '</div>';

  html += '</div>';
  if (data.verdict) html += `<div class="proscons-verdict">${escapeHtml(data.verdict)}</div>`;
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
  html += `<div class="matrix-axis-y"><span>↑ ${escapeHtml(data.axisY || 'Impact')}</span></div>`;
  html += '<div class="matrix-grid">';

  data.quadrants.forEach((q, i) => {
    html += `<div class="matrix-quad ${positions[i]}" style="border-color:${colors[i]}30">
      <div class="matrix-quad-label" style="color:${colors[i]}">${escapeHtml(q.label)}</div>
      <div class="matrix-items">${(q.items || []).map(it =>
        `<span class="matrix-chip" style="background:${colors[i]}15;border-color:${colors[i]}40;color:${colors[i]}">${escapeHtml(it)}</span>`
      ).join('')}</div>
    </div>`;
  });

  html += '</div>';
  html += `<div class="matrix-axis-x">${escapeHtml(data.axisX || 'Effort')} →</div>`;
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
  const pct = Math.round((doneCount / total) * 100);

  let html = '<div class="checklist-container">';
  if (data.title) html += `<div class="checklist-title">${escapeHtml(data.title)}</div>`;
  html += `<div class="checklist-progress">
    <div class="checklist-bar"><div class="checklist-bar-fill" style="width:${pct}%"></div></div>
    <span class="checklist-count">${doneCount} / ${total}</span>
  </div>`;

  data.items.forEach(item => {
    html += `<div class="checklist-item ${item.done ? 'done' : ''}">
      <div class="checklist-check">${item.done ? '✓' : ''}</div>
      <span class="checklist-text">${escapeHtml(item.text)}</span>
    </div>`;
  });

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
    purple: '#6c5ce7', blue: '#74b9ff', green: '#00cec9',
    yellow: '#fdcb6e', red: '#ff6b6b', pink: '#fd79a8', orange: '#e17055'
  };

  const total = data.segments.reduce((sum, s) => sum + s.value, 0);
  const size = 160, cx = size / 2, cy = size / 2, r = 60, strokeW = 20;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  let arcs = '';
  data.segments.forEach(seg => {
    const pct = seg.value / total;
    const dashLen = pct * circumference;
    const color = colorMap[seg.color] || seg.color || '#6c5ce7';
    arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${color}" stroke-width="${strokeW}"
      stroke-dasharray="${dashLen} ${circumference - dashLen}"
      stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += dashLen;
  });

  let legend = data.segments.map(seg => {
    const color = colorMap[seg.color] || seg.color || '#6c5ce7';
    const pct = Math.round((seg.value / total) * 100);
    return `<div class="donut-legend-item">
      <span class="donut-legend-dot" style="background:${color}"></span>
      <span class="donut-legend-label">${escapeHtml(seg.label)}</span>
      <span class="donut-legend-value" style="color:${color}">${pct}%</span>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="donut-container">
    <div class="donut-chart">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${arcs}</svg>
      <div class="donut-center">${escapeHtml(data.centerLabel || '')}</div>
    </div>
    <div class="donut-legend">${legend}</div>
  </div>`;
}

// --- QUOTE / INSIGHT CARD ---
function renderQuoteCard(data, container) {
  if (!data.quote) {
    container.innerHTML = '<div style="color:var(--text2);padding:20px;">Invalid quote data</div>';
    return;
  }

  container.innerHTML = `<div class="quote-container">
    ${data.tag ? `<span class="quote-tag">${escapeHtml(data.tag)}</span>` : ''}
    <div class="quote-mark">"</div>
    <div class="quote-text">${escapeHtml(data.quote)}</div>
    ${data.author ? `<div class="quote-author">— ${escapeHtml(data.author)}</div>` : ''}
    ${data.supporting ? `<div class="quote-supporting">${escapeHtml(data.supporting)}</div>` : ''}
  </div>`;
}

// --- Utility ---
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
