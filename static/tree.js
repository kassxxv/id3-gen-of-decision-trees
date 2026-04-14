// ─── STATE ────────────────────────────────────────
const AppState = {
  file: null,
  csvText: null,
  csvRows: [],
  columns: [],
  treeData: null,
  featureValues: {},
  classList: [],
  buildSteps: [],
  featureImportances: {},
  animState: { step: 0, playing: false, timer: null, speed: 600 },
};

// Color palette for classes
const CLASS_COLORS = [
  '#F5A623', '#00B4D8', '#22C55E', '#EF4444', '#947CFC',
  '#F472B6', '#FB923C', '#38BDF8', '#A3E635', '#E879F9'
];

function classColor(cls) {
  const idx = AppState.classList.indexOf(String(cls));
  return CLASS_COLORS[idx >= 0 ? idx % CLASS_COLORS.length : 0];
}

// ─── UTILS ────────────────────────────────────────
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function show(el) { if (typeof el === 'string') el = $(el); el.classList.remove('hidden'); }
function hide(el) { if (typeof el === 'string') el = $(el); el.classList.add('hidden'); }

function revealSection(id) {
  const el = $(id);
  el.classList.remove('hidden');
  // Reading offsetHeight forces a browser reflow so the element is rendered
  // before 'visible' is added. Without this, both class changes happen in the
  // same paint frame and the CSS transition never fires.
  void el.offsetHeight;
  el.classList.add('visible');
}

/**
 * Minimal CSV parser: splits on commas and strips surrounding quotes.
 * Does not handle commas inside quoted fields — adequate for typical
 * tabular datasets but not general-purpose RFC 4180 compliance.
 */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    // Skip malformed rows whose column count doesn't match the header
    if (vals.length === headers.length) rows.push(vals);
  }
  return { headers, rows };
}

// ─── FILE UPLOAD ──────────────────────────────────
const FileUpload = {
  init() {
    const dz = $('#dropZone');
    const fi = $('#fileInput');
    const bb = $('#browseBtn');

    bb.addEventListener('click', () => fi.click());
    fi.addEventListener('change', e => { if (e.target.files[0]) this.handle(e.target.files[0]); });

    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('dragover');
      if (e.dataTransfer.files[0]) this.handle(e.dataTransfer.files[0]);
    });
    dz.addEventListener('click', e => { if (e.target === dz || e.target.tagName === 'P' || e.target.tagName === 'DIV') fi.click(); });
  },

  handle(file) {
    AppState.file = file;
    const reader = new FileReader();
    reader.onload = e => {
      AppState.csvText = e.target.result;
      const { headers, rows } = parseCSV(AppState.csvText);
      AppState.columns = headers;
      AppState.csvRows = rows;

      // Populate target select
      const sel = $('#targetSelect');
      sel.innerHTML = '';
      headers.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h; opt.textContent = h;
        sel.appendChild(opt);
      });
      // Default to last column
      sel.value = headers[headers.length - 1];
      sel.disabled = false;

      // Enable build
      $('#buildBtn').disabled = false;

      // Show file status
      const fs = $('#fileStatus');
      fs.textContent = `✓ ${file.name} loaded`;
      show(fs);

      // Render dataset preview
      DatasetPreview.render(headers, rows);
    };
    reader.readAsText(file);
  }
};

// ─── DATASET PREVIEW ──────────────────────────────
const DatasetPreview = {
  sortCol: -1,
  sortAsc: true,

  render(headers, rows) {
    const target = $('#targetSelect').value;
    const maxRows = Math.min(rows.length, 10);

    $('#datasetInfo').textContent = `${rows.length} rows × ${headers.length} columns`;

    let html = '<table class="dataset-table"><thead><tr>';
    headers.forEach((h, i) => {
      const isTgt = h === target;
      html += `<th class="${isTgt ? 'target-col' : ''}" data-col="${i}">${h} <span class="sort-arrow">↕</span></th>`;
    });
    html += '</tr></thead><tbody>';

    const displayRows = rows.slice(0, maxRows);
    displayRows.forEach(row => {
      html += '<tr>';
      row.forEach((v, i) => {
        const isTgt = headers[i] === target;
        html += `<td class="${isTgt ? 'target-col' : ''}">${v}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    if (rows.length > maxRows) {
      html += `<div class="table-footer">Showing ${maxRows} of ${rows.length} rows</div>`;
    }

    $('#datasetTableWrap').innerHTML = html;

    // Sorting
    $$('.dataset-table thead th').forEach(th => {
      th.addEventListener('click', () => {
        const col = parseInt(th.dataset.col);
        if (this.sortCol === col) this.sortAsc = !this.sortAsc;
        else { this.sortCol = col; this.sortAsc = true; }
        const sorted = [...rows].sort((a, b) => {
          const va = a[col], vb = b[col];
          const na = parseFloat(va), nb = parseFloat(vb);
          if (!isNaN(na) && !isNaN(nb)) return this.sortAsc ? na - nb : nb - na;
          return this.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        });
        this.render(headers, sorted);
      });
    });

    revealSection('#datasetSection');
  }
};

// ─── TREE BUILDER ─────────────────────────────────
const TreeBuilder = {
  async build() {
    show('#loader');

    const fd = new FormData();
    fd.append('file', AppState.file);
    fd.append('target', $('#targetSelect').value);
    fd.append('test_size', $('#splitSelect').value);

    try {
      const res = await fetch('/train', { method: 'POST', body: fd });
      const data = await res.json();

      AppState.treeData = data.tree;
      AppState.featureValues = data.feature_values;
      AppState.classList = data.classes.sort();
      AppState.buildSteps = data.build_steps;
      AppState.featureImportances = data.feature_importances;

      hide('#loader');

      // Sections are revealed with staggered delays so each CSS slide-in
      // animation completes before the next section appears below it
      Animation.init(data.build_steps);
      revealSection('#animationSection');

      setTimeout(() => {
        Metrics.render(data);
        revealSection('#metricsSection');
      }, 300);

      setTimeout(() => {
        TreeViz.draw(data.tree);
        revealSection('#treeSection');
      }, 600);

      setTimeout(() => {
        PredictForm.build(data.feature_values);
        revealSection('#predictSection');
      }, 900);

    } catch (err) {
      hide('#loader');
      alert('Error building tree: ' + err.message);
    }
  }
};

// ─── ANIMATION ────────────────────────────────────
const Animation = {
  steps: [],

  init(steps) {
    this.steps = steps;
    // Build a map from node_id → step so we can look up parent context
    this.nodeMap = {};
    steps.forEach(s => { if (s.node_id != null) this.nodeMap[s.node_id] = s; });

    AppState.animState.step = 0;
    AppState.animState.playing = false;
    clearInterval(AppState.animState.timer);

    $('#stepTotal').textContent = steps.length;
    $('#stepCurrent').textContent = '0';
    show('#stepInfo');
    this.renderStep(0);
  },

  play() {
    if (AppState.animState.playing) return;
    AppState.animState.playing = true;
    $('#animPlay').classList.add('active');
    AppState.animState.timer = setInterval(() => {
      if (AppState.animState.step >= this.steps.length) { this.pause(); return; }
      this.advance();
    }, AppState.animState.speed);
  },

  pause() {
    AppState.animState.playing = false;
    clearInterval(AppState.animState.timer);
    $('#animPlay').classList.remove('active');
  },

  advance() {
    if (AppState.animState.step >= this.steps.length) return;
    AppState.animState.step++;
    $('#stepCurrent').textContent = AppState.animState.step;
    this.renderStep(AppState.animState.step - 1);
  },

  skip() {
    this.pause();
    AppState.animState.step = this.steps.length;
    $('#stepCurrent').textContent = this.steps.length;
    if (this.steps.length > 0) this.renderStep(this.steps.length - 1);
  },

  renderStep(idx) {
    const step = this.steps[idx];
    if (!step) return;

    const header = $('#stepInfoHeader');
    const bars = $('#stepInfoBars');
    const dist = $('#stepClassDist');

    // Build branch context: "ParentFeature = edgeValue →" if this is not the root
    let branchCtx = '';
    if (step.edge_value != null && step.parent_id != null) {
      const parent = this.nodeMap[step.parent_id];
      const parentFeature = parent ? parent.feature_chosen : '';
      if (parentFeature) {
        branchCtx = `<span class="branch-ctx"><span class="branch-feat">${parentFeature}</span><span class="branch-eq"> = </span><span class="branch-val">${step.edge_value}</span><span class="branch-arrow"> →</span></span> `;
      }
    }

    if (step.is_leaf) {
      const color = classColor(step.label);
      header.innerHTML = `
        <span class="dim">Step ${step.step_number}:</span>
        ${branchCtx}<span class="leaf-label" style="color:${color}">Leaf → ${step.label}</span>
        <span class="entropy">Entropy: ${step.entropy_before}</span>
      `;
      bars.innerHTML = `<div style="color:var(--text-dim);font-size:12px;margin-top:8px">
        Pure node with ${step.samples} sample${step.samples !== 1 ? 's' : ''}</div>`;
    } else {
      header.innerHTML = `
        <span class="dim">Step ${step.step_number}:</span>
        ${branchCtx}<span class="dim">Splitting on</span>
        <span class="feature">${step.feature_chosen}</span>
        <span class="entropy">Entropy: ${step.entropy_before}</span>
      `;

      const candidates = step.feature_candidates;
      const maxIG = Math.max(...Object.values(candidates), 0.001);
      let barsHTML = '<div class="ig-bars-title">Information Gain Comparison</div>';
      // Sort by IG descending
      const sorted = Object.entries(candidates).sort((a, b) => b[1] - a[1]);
      sorted.forEach(([feat, ig]) => {
        const isBest = feat === step.feature_chosen;
        const pct = (ig / maxIG) * 100;
        barsHTML += `
          <div class="ig-bar-row">
            <div class="ig-bar-label ${isBest ? 'best' : ''}">${feat}</div>
            <div class="ig-bar-track">
              <div class="ig-bar-fill ${isBest ? 'best' : 'normal'}" style="width:${pct}%"></div>
            </div>
            <div class="ig-bar-value ${isBest ? 'best' : ''}">${ig.toFixed(4)}</div>
          </div>`;
      });
      bars.innerHTML = barsHTML;
    }

    // Class distribution pills
    let distHTML = '';
    if (step.class_distribution) {
      Object.entries(step.class_distribution).forEach(([cls, count]) => {
        const color = classColor(cls);
        distHTML += `<span class="class-pill" style="background:${color}20;color:${color}">${cls}: ${count}</span>`;
      });
    }
    dist.innerHTML = distHTML;
  }
};

// ─── METRICS ──────────────────────────────────────
const Metrics = {
  render(data) {
    const metrics = [
      { label: 'Accuracy', value: data.accuracy, color: 'var(--orange)' },
      { label: 'Precision', value: data.precision, color: 'var(--teal)' },
      { label: 'Recall', value: data.recall, color: 'var(--green)' },
      { label: 'F1 Score', value: data.f1, color: 'var(--purple)' },
    ];

    let gridHTML = '';
    metrics.forEach(m => {
      gridHTML += `
        <div class="metric-card">
          <div class="metric-label">${m.label}</div>
          <div class="metric-value" style="color:${m.color}">${m.value}%</div>
          <div class="metric-bar">
            <div class="metric-bar-fill" style="width:${m.value}%;background:${m.color}"></div>
          </div>
        </div>`;
    });
    $('#metricsGrid').innerHTML = gridHTML;

    $('#metricsGridSecondary').innerHTML = `
      <div class="metric-card">
        <div class="metric-label">Train Size</div>
        <div class="metric-value" style="color:var(--text-secondary)">${data.train_size}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Test Size</div>
        <div class="metric-value" style="color:var(--text-secondary)">${data.test_size}</div>
      </div>`;

    // Feature importances
    this.renderImportances(data.feature_importances);

    // Confusion matrix
    this.renderCM(data.confusion_matrix, data.classes);
  },

  renderImportances(importances) {
    const entries = Object.entries(importances);
    if (entries.length === 0) return;
    const maxVal = Math.max(...entries.map(e => e[1]), 0.001);

    let html = '';
    entries.forEach(([feat, val]) => {
      const pct = (val / maxVal) * 100;
      html += `
        <div class="fi-row">
          <div class="fi-label">${feat}</div>
          <div class="fi-track">
            <div class="fi-fill" style="width:${pct}%"></div>
          </div>
          <div class="fi-value">${val.toFixed(3)}</div>
        </div>`;
    });
    $('#fiBars').innerHTML = html;
  },

  renderCM(matrix, classes) {
    let html = '<thead><tr><th></th>';
    classes.forEach(c => html += `<th>Pred: ${c}</th>`);
    html += '</tr></thead><tbody>';

    matrix.forEach((row, ri) => {
      html += `<tr><th>Actual: ${classes[ri]}</th>`;
      row.forEach((val, ci) => {
        const isDiag = ri === ci;
        const cls = val === 0 ? 'cm-cell-zero' : (isDiag ? 'cm-cell-correct' : 'cm-cell-error');
        html += `<td class="${cls}">${val}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
    $('#cmTable').innerHTML = html;
  }
};

// ─── TREE VISUALIZATION ──────────────────────────
const TreeViz = {
  svg: null,
  g: null,
  zoom: null,
  root: null,

  draw(treeJson) {
    const container = $('#treeCanvas');
    container.querySelectorAll('svg').forEach(s => s.remove());

    const width = container.clientWidth || 900;
    const hierarchy = this.buildHierarchy(treeJson, '');

    this.root = d3.hierarchy(hierarchy);
    const treeLayout = d3.tree().nodeSize([130, 100]);
    treeLayout(this.root);

    // Compute bounds
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    this.root.each(d => {
      if (d.x < x0) x0 = d.x;
      if (d.x > x1) x1 = d.x;
      if (d.y < y0) y0 = d.y;
      if (d.y > y1) y1 = d.y;
    });

    const treeW = x1 - x0 + 200;
    const treeH = y1 - y0 + 160;
    const height = Math.max(400, treeH);
    container.style.height = height + 'px';

    this.svg = d3.select(container).append('svg')
      .attr('width', width)
      .attr('height', height);

    this.g = this.svg.append('g')
      .attr('transform', `translate(${width / 2 - (x0 + x1) / 2}, 60)`);

    this.zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', e => this.g.attr('transform', e.transform));
    this.svg.call(this.zoom);
    this.svg.call(this.zoom.transform, d3.zoomIdentity.translate(width / 2 - (x0 + x1) / 2, 60));

    // Links
    this.g.selectAll('.tree-link')
      .data(this.root.links())
      .join('path')
      .attr('class', 'tree-link')
      .attr('d', d => `M${d.source.x},${d.source.y + 32}
                        C${d.source.x},${(d.source.y + d.target.y) / 2 + 16}
                         ${d.target.x},${(d.source.y + d.target.y) / 2 + 16}
                         ${d.target.x},${d.target.y - 8}`);

    // Edge labels
    this.g.selectAll('.tree-edge-label')
      .data(this.root.links())
      .join('text')
      .attr('class', 'tree-edge-label')
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2 + 16)
      .attr('text-anchor', 'middle')
      .text(d => d.target.data.edgeLabel || '');

    // Nodes
    const nodes = this.g.selectAll('.tree-node')
      .data(this.root.descendants())
      .join('g')
      .attr('class', 'tree-node')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .on('click', (e, d) => { e.stopPropagation(); NodeDetail.show(d); this.highlightPath(d); });

    // Node rectangles
    nodes.each(function(d) {
      const g = d3.select(this);
      const isLeaf = d.data.isLeaf;
      const w = isLeaf ? 80 : 110;
      const h = isLeaf ? 36 : 48;

      g.append('rect')
        .attr('x', -w / 2)
        .attr('y', -h / 2)
        .attr('width', w)
        .attr('height', h)
        .attr('rx', isLeaf ? 18 : 10)
        .attr('fill', isLeaf ? classColor(d.data.name) + '22' : '#1C1C1C')
        .attr('stroke', isLeaf ? classColor(d.data.name) + '66' : '#00B4D866')
        .attr('stroke-width', 1.5);

      g.append('text')
        .attr('class', 'tree-node-label')
        .attr('y', isLeaf ? 1 : -5)
        .attr('text-anchor', 'middle')
        .attr('fill', isLeaf ? classColor(d.data.name) : '#00B4D8')
        .attr('font-weight', 600)
        .attr('font-size', 12)
        .text(d.data.name);

      if (!isLeaf && d.data.ig !== undefined) {
        g.append('text')
          .attr('class', 'tree-node-sub')
          .attr('y', 10)
          .attr('text-anchor', 'middle')
          .attr('fill', '#666')
          .attr('font-size', 9)
          .text(`IG: ${d.data.ig} · ${d.data.samples}s`);
      } else if (isLeaf) {
        g.append('text')
          .attr('class', 'tree-node-sub')
          .attr('y', 14)
          .attr('text-anchor', 'middle')
          .attr('fill', '#666')
          .attr('font-size', 9)
          .text(`${d.data.samples}s`);
      }
    });

    // Click on canvas background to deselect
    this.svg.on('click', () => { NodeDetail.hide(); this.clearHighlight(); });
  },

  buildHierarchy(node, edgeLabel) {
    if (node.label !== undefined) {
      return {
        name: String(node.label),
        isLeaf: true,
        edgeLabel,
        entropy: node.entropy,
        samples: node.samples,
        class_distribution: node.class_distribution,
      };
    }
    const children = [];
    for (const [val, child] of Object.entries(node.children)) {
      children.push(this.buildHierarchy(child, String(val)));
    }
    return {
      name: node.feature,
      isLeaf: false,
      edgeLabel,
      entropy: node.entropy,
      ig: node.information_gain,
      samples: node.samples,
      class_distribution: node.class_distribution,
      children,
    };
  },

  highlightPath(d) {
    this.clearHighlight();
    const path = [];
    let curr = d;
    while (curr) { path.push(curr); curr = curr.parent; }
    // Store D3 node objects (not IDs) in the Set so membership tests use
    // object identity — each d3.hierarchy node is a unique instance
    const ids = new Set(path.map(n => n));

    this.g.selectAll('.tree-node').classed('highlighted', n => ids.has(n));
    this.g.selectAll('.tree-link').classed('highlighted', l => ids.has(l.source) && ids.has(l.target));
  },

  clearHighlight() {
    this.g.selectAll('.tree-node').classed('highlighted', false);
    this.g.selectAll('.tree-link').classed('highlighted', false);
  }
};

// ─── NODE DETAIL ──────────────────────────────────
const NodeDetail = {
  show(d) {
    const panel = $('#nodeDetail');
    const content = $('#nodeDetailContent');
    const data = d.data;

    let html = `<div class="nd-title">${data.isLeaf ? 'Leaf Node' : 'Decision Node'}</div>`;

    if (data.isLeaf) {
      html += `<div class="nd-row"><div class="nd-label">Class</div>
        <div class="nd-value" style="color:${classColor(data.name)}">${data.name}</div></div>`;
    } else {
      html += `<div class="nd-row"><div class="nd-label">Feature</div>
        <div class="nd-value" style="color:var(--teal)">${data.name}</div></div>`;
      html += `<div class="nd-row"><div class="nd-label">Information Gain</div>
        <div class="nd-value" style="color:var(--orange)">${data.ig}</div></div>`;
    }

    html += `<div class="nd-row"><div class="nd-label">Entropy</div>
      <div class="nd-value">${data.entropy !== null ? data.entropy : '—'}</div></div>`;
    html += `<div class="nd-row"><div class="nd-label">Samples</div>
      <div class="nd-value">${data.samples}</div></div>`;

    html += '<div class="nd-divider"></div>';

    // Class distribution
    if (data.class_distribution) {
      html += '<div class="nd-row"><div class="nd-label">Distribution</div></div>';
      const total = Object.values(data.class_distribution).reduce((a, b) => a + b, 0);
      Object.entries(data.class_distribution).forEach(([cls, count]) => {
        const pct = ((count / total) * 100).toFixed(1);
        const color = classColor(cls);
        html += `
          <div class="nd-dist-row">
            <div class="nd-dist-label" style="color:${color}">${cls}</div>
            <div class="nd-dist-track">
              <div class="nd-dist-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <div class="nd-dist-value">${count} (${pct}%)</div>
          </div>`;
      });
    }

    html += '<div class="nd-divider"></div>';

    // Path from root
    const path = [];
    let curr = d;
    while (curr) {
      if (curr.data.edgeLabel) {
        path.unshift(curr.data.edgeLabel + ' → ' + curr.data.name);
      } else {
        path.unshift(curr.data.name);
      }
      curr = curr.parent;
    }
    html += `<div class="nd-row"><div class="nd-label">Path</div>
      <div class="nd-path"><code>${path.join(' > ')}</code></div></div>`;

    content.innerHTML = html;
    panel.classList.remove('hidden');
  },

  hide() {
    $('#nodeDetail').classList.add('hidden');
  }
};

// ─── PREDICT FORM ─────────────────────────────────
const PredictForm = {
  build(featureValues) {
    const form = $('#predictForm');
    let html = '';
    for (const [feat, vals] of Object.entries(featureValues)) {
      html += `
        <div class="predict-field">
          <div class="control-group">
            <label class="control-label">${feat}</label>
            <select class="control-select" data-feature="${feat}">
              ${vals.map(v => `<option value="${v}">${v}</option>`).join('')}
            </select>
          </div>
        </div>`;
    }
    form.innerHTML = html;
  },

  async predict() {
    const sample = {};
    $$('#predictForm select').forEach(sel => {
      sample[sel.dataset.feature] = sel.value;
    });

    try {
      const res = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample })
      });
      const data = await res.json();
      const color = classColor(data.prediction);
      const result = $('#predictResult');
      result.style.background = color + '18';
      result.style.border = `1px solid ${color}44`;
      $('#predictValue').textContent = data.prediction;
      $('#predictValue').style.color = color;
      show(result);
    } catch (err) {
      alert('Prediction error: ' + err.message);
    }
  }
};

// ─── INIT ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  FileUpload.init();

  $('#buildBtn').addEventListener('click', () => TreeBuilder.build());
  $('#predictBtn').addEventListener('click', () => PredictForm.predict());

  // Animation controls
  $('#animPlay').addEventListener('click', () => Animation.play());
  $('#animPause').addEventListener('click', () => Animation.pause());
  $('#animStep').addEventListener('click', () => Animation.advance());
  $('#animSkip').addEventListener('click', () => Animation.skip());

  // Zoom controls
  $('#zoomIn').addEventListener('click', () => {
    if (TreeViz.svg && TreeViz.zoom) TreeViz.svg.transition().call(TreeViz.zoom.scaleBy, 1.3);
  });
  $('#zoomOut').addEventListener('click', () => {
    if (TreeViz.svg && TreeViz.zoom) TreeViz.svg.transition().call(TreeViz.zoom.scaleBy, 0.7);
  });
  $('#zoomReset').addEventListener('click', () => {
    if (TreeViz.svg && TreeViz.zoom) {
      const w = TreeViz.svg.attr('width');
      TreeViz.svg.transition().call(TreeViz.zoom.transform, d3.zoomIdentity.translate(w / 2, 60));
    }
  });

  // Node detail close
  $('#nodeDetailClose').addEventListener('click', (e) => {
    e.stopPropagation();
    NodeDetail.hide();
    TreeViz.clearHighlight();
  });

  // Re-render dataset preview when target changes
  $('#targetSelect').addEventListener('change', () => {
    if (AppState.columns.length > 0) {
      DatasetPreview.render(AppState.columns, AppState.csvRows);
    }
  });
});
