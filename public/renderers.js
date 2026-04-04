// renderers.js — Registry of artifact renderers
// Each renderer: (data, container) => void

const renderers = {
  mindmap: renderMindMap,
  table: renderTable,
  presentation: renderPresentation,
  diagram: renderDiagram,
  html_guide: renderHTMLGuide,
  image: renderImage,
  freeform: renderFreeform
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
        container.querySelector('.diagram-container').innerHTML = svg;
      }).catch(() => {
        container.innerHTML = `<pre style="font-size:11px;color:var(--text2);padding:10px;white-space:pre-wrap;">${escapeHtml(data.mermaid)}</pre>`;
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
  const html = data.html || '<p>No content</p>';
  const iframe = document.createElement('iframe');
  iframe.className = 'freeform-iframe';
  iframe.sandbox = 'allow-scripts';
  container.innerHTML = '';
  container.appendChild(iframe);
  iframe.srcdoc = html;
  iframe.onload = () => {
    try {
      const h = iframe.contentDocument.body.scrollHeight;
      if (h > 50) iframe.style.height = Math.min(h + 20, 600) + 'px';
    } catch {}
  };
}

// --- Utility ---
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
