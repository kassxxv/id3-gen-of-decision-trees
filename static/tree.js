// ─── STATE ────────────────────────────────────────
let treeData      = null;
let featureValues = {};   // { featureName: [val1, val2, …] }
let classList     = [];   // sorted class labels from server

// ─── ELEMENTS ─────────────────────────────────────
const fileInput    = document.getElementById("fileInput");
const fileName     = document.getElementById("fileName");
const dropZone     = document.getElementById("dropZone");
const targetSelect = document.getElementById("targetSelect");
const runBtn       = document.getElementById("runBtn");
const loader       = document.getElementById("loader");

// ─── FILE UPLOAD ───────────────────────────────────
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));

dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  fileName.textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    const columns = e.target.result.split("\n")[0].trim().split(",").map(c => c.trim());
    targetSelect.innerHTML = "";
    columns.forEach(col => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = col;
      targetSelect.appendChild(opt);
    });
    targetSelect.disabled = false;
    runBtn.disabled = false;

    const status = document.getElementById("uploadStatus");
    if (status) { status.textContent = "LOADED"; status.className = "panel-status nominal"; }
  };
  reader.readAsText(file);
}

// ─── BUILD TREE ────────────────────────────────────
runBtn.addEventListener("click", async () => {
  const file      = fileInput.files[0];
  const target    = targetSelect.value;
  if (!file || !target) return;

  showLoader(true);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("target", target);
  formData.append("test_size", document.getElementById("splitSelect").value);

  try {
    const res  = await fetch("/train", { method: "POST", body: formData });
    const data = await res.json();

    treeData      = data.tree;
    classList     = data.classes;
    featureValues = data.feature_values;

    showMetrics(data);
    drawTree(data.tree);
    buildPredictForm(featureValues);

    document.getElementById("metricsPanel").classList.remove("hidden");
    document.getElementById("treePanel").classList.remove("hidden");
    document.getElementById("predictPanel").classList.remove("hidden");

  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    showLoader(false);
  }
});

// ─── METRICS ──────────────────────────────────────
let lastMetricData = null;   // kept for tooltip computation

function showMetrics(data) {
  lastMetricData = data;

  document.getElementById("metricAccuracy").textContent  = data.accuracy  + "%";
  document.getElementById("metricPrecision").textContent = data.precision + "%";
  document.getElementById("metricRecall").textContent    = data.recall    + "%";
  document.getElementById("metricF1").textContent        = data.f1        + "%";
  document.getElementById("metricTrain").textContent     = data.train_size.toLocaleString();
  document.getElementById("metricTest").textContent      = data.test_size.toLocaleString();

  renderConfusionMatrix(data.confusion_matrix, data.classes);
  bindMetricTooltips(data);
}

// ─── METRIC HOVER TOOLTIPS ─────────────────────────
function bindMetricTooltips(data) {
  const cm      = data.confusion_matrix;
  const classes = data.classes;
  const n       = classes.length;
  const total   = cm.flat().reduce((a, b) => a + b, 0);

  // per-class TP, FP, FN
  const perClass = classes.map((_, i) => {
    const tp = cm[i][i];
    const fp = cm.reduce((s, row, r) => r !== i ? s + row[i] : s, 0);
    const fn = cm[i].reduce((s, v, c) => c !== i ? s + v : s, 0);
    return { tp, fp, fn };
  });

  const correct = classes.reduce((s, _, i) => s + cm[i][i], 0);

  // macro averages
  const macroPrecision = perClass.reduce((s, {tp, fp}) => s + (tp + fp > 0 ? tp / (tp + fp) : 0), 0) / n;
  const macroRecall    = perClass.reduce((s, {tp, fn}) => s + (tp + fn > 0 ? tp / (tp + fn) : 0), 0) / n;
  const macroF1        = (macroPrecision + macroRecall) > 0
    ? 2 * macroPrecision * macroRecall / (macroPrecision + macroRecall) : 0;

  const pFmt = v => (v * 100).toFixed(2) + "%";

  // tooltip content per tile
  const defs = [
    {
      id: "metricAccuracy",
      title: "ACCURACY",
      formula: "correct / total",
      steps: [
        `correct = Σ diagonal = ${correct}`,
        `total   = ${total}`,
        `= ${correct} / ${total}`,
        `= ${pFmt(correct / total)}`
      ]
    },
    {
      id: "metricPrecision",
      title: "PRECISION (macro)",
      formula: "avg  TP / (TP + FP)  per class",
      steps: classes.map((c, i) => {
        const {tp, fp} = perClass[i];
        return `${c}: ${tp} / (${tp}+${fp}) = ${pFmt(tp/(tp+fp||1))}`;
      }).concat([`avg = ${pFmt(macroPrecision)}`])
    },
    {
      id: "metricRecall",
      title: "RECALL (macro)",
      formula: "avg  TP / (TP + FN)  per class",
      steps: classes.map((c, i) => {
        const {tp, fn} = perClass[i];
        return `${c}: ${tp} / (${tp}+${fn}) = ${pFmt(tp/(tp+fn||1))}`;
      }).concat([`avg = ${pFmt(macroRecall)}`])
    },
    {
      id: "metricF1",
      title: "F1 SCORE (macro)",
      formula: "2 × P × R / (P + R)",
      steps: [
        `P = ${pFmt(macroPrecision)}`,
        `R = ${pFmt(macroRecall)}`,
        `= 2 × ${macroPrecision.toFixed(4)} × ${macroRecall.toFixed(4)}`,
        `  / (${macroPrecision.toFixed(4)} + ${macroRecall.toFixed(4)})`,
        `= ${pFmt(macroF1)}`
      ]
    },
    {
      id: "metricTrain",
      title: "TRAIN SIZE",
      formula: "rows used for tree building",
      steps: [`${data.train_size} samples (${100 - Math.round(data.test_size / (data.train_size + data.test_size) * 100)}% train)`]
    },
    {
      id: "metricTest",
      title: "TEST SIZE",
      formula: "rows used for evaluation",
      steps: [`${data.test_size} samples (${Math.round(data.test_size / (data.train_size + data.test_size) * 100)}% test)`]
    }
  ];

  const tip = document.getElementById("metricTooltip");

  defs.forEach(({ id, title, formula, steps }) => {
    const el = document.getElementById(id)?.closest(".metric-card");
    if (!el) return;

    el.addEventListener("mouseenter", () => {
      tip.innerHTML = `
        <div class="mt-title">${title}</div>
        <div class="mt-formula">${formula}</div>
        <div class="mt-divider"></div>
        ${steps.map(s => `<div class="mt-step">${s}</div>`).join("")}
      `;
      tip.classList.remove("hidden");
    });

    el.addEventListener("mousemove", e => {
      const pad  = 14;
      const tipW = 252;
      const tipH = tip.offsetHeight || 140;
      let x = e.clientX + pad;
      let y = e.clientY + pad;
      if (x + tipW > window.innerWidth)   x = e.clientX - tipW - pad;
      if (y + tipH > window.innerHeight)  y = e.clientY - tipH - pad;
      tip.style.left = (x + window.scrollX) + "px";
      tip.style.top  = (y + window.scrollY) + "px";
    });

    el.addEventListener("mouseleave", () => tip.classList.add("hidden"));
  });
}

function renderConfusionMatrix(matrix, classes) {
  const wrap      = document.getElementById("cmWrap");
  const container = document.getElementById("cmTable");

  const maxVal  = Math.max(...matrix.flat());
  const rowSums = matrix.map(row => row.reduce((a, b) => a + b, 0));
  const total   = rowSums.reduce((a, b) => a + b, 0);

  let html = '<table class="cm-table"><thead><tr>';
  html += '<th class="cm-head cm-corner"></th>';
  html += '<th class="cm-head cm-axis-label" colspan="' + classes.length + '">PREDICTED</th>';
  html += '<th class="cm-head"></th>';
  html += '</tr><tr>';
  html += '<th class="cm-head cm-axis-label-v">ACTUAL</th>';
  classes.forEach(c => html += `<th class="cm-head">${c}</th>`);
  html += '<th class="cm-head">TOTAL</th>';
  html += "</tr></thead><tbody>";

  matrix.forEach((row, i) => {
    html += `<tr><th class="cm-head cm-row-label">${classes[i]}</th>`;
    row.forEach((val, j) => {
      const isDiag  = i === j;
      const pct     = rowSums[i] > 0 ? ((val / rowSums[i]) * 100).toFixed(1) : "0.0";
      const heat    = maxVal > 0 ? (val / maxVal) : 0;
      const opacity = (0.04 + heat * 0.22).toFixed(3);
      const baseClr = isDiag ? "34,133,106" : "185,28,28";
      const style   = `background:rgba(${baseClr},${opacity})`;
      const cls     = isDiag ? "cm-cell cm-correct" : "cm-cell cm-wrong";
      html += `<td class="${cls}" style="${style}">
                 <span class="cm-val">${val}</span>
                 <span class="cm-pct">${pct}%</span>
               </td>`;
    });
    html += `<td class="cm-cell cm-total">${rowSums[i]}</td>`;
    html += "</tr>";
  });

  // column totals row
  html += '<tr><th class="cm-head cm-row-label">TOTAL</th>';
  for (let j = 0; j < classes.length; j++) {
    const colSum = matrix.reduce((s, row) => s + row[j], 0);
    html += `<td class="cm-cell cm-total">${colSum}</td>`;
  }
  html += `<td class="cm-cell cm-total cm-grand">${total}</td>`;
  html += "</tr>";

  html += "</tbody></table>";
  container.innerHTML = html;
  wrap.classList.remove("hidden");

  // wire toggle (re-bind each render to avoid stale listeners)
  const toggle = document.getElementById("cmToggle");
  const body   = document.getElementById("cmBody");

  const newToggle = toggle.cloneNode(true);
  toggle.replaceWith(newToggle);

  newToggle.addEventListener("click", () => {
    const open = body.classList.toggle("hidden");
    newToggle.setAttribute("aria-expanded", String(!open));
    newToggle.querySelector(".cm-chevron").textContent = open ? "▶" : "▼";
  });
}

// ─── D3 TREE ──────────────────────────────────────
const NODE_W = 110;   // internal node rect width
const NODE_H = 44;    // internal node rect height
const LEAF_R = 22;    // leaf node circle radius

function drawTree(treeJson) {
  const container = document.getElementById("treeContainer");
  container.innerHTML = "";

  // remove any stray tooltips
  d3.select("#nodeTooltip").remove();

  requestAnimationFrame(() => {
    const W = container.clientWidth  || 1000;
    const H = container.clientHeight || 520;

    function jsonToHierarchy(node, edgeLabel = "") {
      if (node.label !== undefined) {
        return {
          name: String(node.label),
          edgeLabel,
          isLeaf: true,
          classIdx: classList.indexOf(String(node.label)),
          samples: node.samples ?? null
        };
      }
      return {
        name: node.feature,
        edgeLabel,
        isLeaf: false,
        ig: node.information_gain != null ? +node.information_gain.toFixed(3) : null,
        samples: node.samples ?? null,
        children: Object.entries(node.children).map(([val, child]) =>
          jsonToHierarchy(child, val)
        )
      };
    }

    const hierarchyData = d3.hierarchy(jsonToHierarchy(treeJson));
    const treeLayout    = d3.tree().nodeSize([140, 110]);
    treeLayout(hierarchyData);

    const svg = d3.select("#treeContainer")
      .append("svg")
      .attr("width", W).attr("height", H);

    const g = svg.append("g");

    // ── tooltip div ──
    const tooltip = d3.select("body")
      .append("div")
      .attr("id", "nodeTooltip")
      .attr("class", "node-tooltip hidden");

    const zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on("zoom", e => g.attr("transform", e.transform));

    svg.call(zoom);
    const initTransform = d3.zoomIdentity.translate(W / 2, 60).scale(0.55);
    svg.call(zoom.transform, initTransform);

    document.getElementById("zoomIn").onclick    = () => svg.transition().duration(80).call(zoom.scaleBy, 1.3);
    document.getElementById("zoomOut").onclick   = () => svg.transition().duration(80).call(zoom.scaleBy, 0.7);
    document.getElementById("zoomReset").onclick = () => svg.transition().duration(80).call(zoom.transform, initTransform);

    // ── orthogonal step links ──
    function stepPath(d) {
      const sx = d.source.x, sy = d.source.y;
      const tx = d.target.x, ty = d.target.y;
      const my = (sy + ty) / 2;
      return `M${sx},${sy} L${sx},${my} L${tx},${my} L${tx},${ty}`;
    }

    g.selectAll(".link")
      .data(hierarchyData.links())
      .join("path")
      .attr("class", "link")
      .attr("d", stepPath);

    // ── edge labels — 30% from target ──
    g.selectAll(".edge-label")
      .data(hierarchyData.links())
      .join("text")
      .attr("class", "edge-label")
      .attr("x", d => d.target.x)
      .attr("y", d => {
        const my = (d.source.y + d.target.y) / 2;
        return my + (d.target.y - my) * 0.3 - 5;
      })
      .text(d => d.target.data.edgeLabel);

    // ── nodes ──
    const node = g.selectAll(".node")
      .data(hierarchyData.descendants())
      .join("g")
      .attr("class", d => {
        if (!d.data.isLeaf) return "node internal";
        return `node leaf leaf-${d.data.classIdx < 0 ? 0 : d.data.classIdx % 3}`;
      })
      .attr("transform", d => `translate(${d.x},${d.y})`);

    // internal nodes → rectangles
    node.filter(d => !d.data.isLeaf)
      .append("rect")
      .attr("x", -NODE_W / 2)
      .attr("y", -NODE_H / 2)
      .attr("width", NODE_W)
      .attr("height", NODE_H);

    // internal: feature name (top line)
    node.filter(d => !d.data.isLeaf)
      .append("text")
      .attr("class", "node-feature")
      .attr("dy", "-0.3em")
      .text(d => {
        const n = d.data.name;
        return n.length > 12 ? n.slice(0, 11) + "…" : n;
      });

    // internal: IG value (bottom line)
    node.filter(d => !d.data.isLeaf)
      .append("text")
      .attr("class", "node-ig")
      .attr("dy", "1.1em")
      .text(d => d.data.ig != null ? `IG: ${d.data.ig}` : "");

    // leaf nodes → circles
    node.filter(d => d.data.isLeaf)
      .append("circle")
      .attr("r", LEAF_R);

    // leaf: class label
    node.filter(d => d.data.isLeaf)
      .append("text")
      .attr("dy", "0.35em")
      .text(d => {
        const n = d.data.name;
        return n.length > 6 ? n.slice(0, 5) + "…" : n;
      });

    // ── hover tooltip ──
    node.on("mouseenter", function(_event, d) {
        let html = "";
        if (!d.data.isLeaf) {
          html = `<div class="nt-row"><span class="nt-key">FEATURE</span><span class="nt-val">${d.data.name}</span></div>`;
          if (d.data.ig != null)
            html += `<div class="nt-row"><span class="nt-key">INFO GAIN</span><span class="nt-val">${d.data.ig}</span></div>`;
          if (d.data.samples != null)
            html += `<div class="nt-row"><span class="nt-key">SAMPLES</span><span class="nt-val">${d.data.samples}</span></div>`;
        } else {
          html = `<div class="nt-row"><span class="nt-key">CLASS</span><span class="nt-val">${d.data.name}</span></div>`;
          if (d.data.samples != null)
            html += `<div class="nt-row"><span class="nt-key">SAMPLES</span><span class="nt-val">${d.data.samples}</span></div>`;
        }
        tooltip.html(html).classed("hidden", false);
      })
      .on("mousemove", function(event) {
        const pad  = 14;
        const tipW = 160;
        const tipH = 80;
        let x = event.clientX + pad;
        let y = event.clientY + pad;
        if (x + tipW > window.innerWidth)  x = event.clientX - tipW - pad;
        if (y + tipH > window.innerHeight) y = event.clientY - tipH - pad;
        tooltip
          .style("left", (x + window.scrollX) + "px")
          .style("top",  (y + window.scrollY) + "px");
      })
      .on("mouseleave", function() {
        tooltip.classed("hidden", true);
      });
  });
}

// ─── PREDICT FORM ─────────────────────────────────
function buildPredictForm(fvMap) {
  const form = document.getElementById("predictForm");
  form.innerHTML = "";

  Object.entries(fvMap).forEach(([feature, values]) => {
    const div = document.createElement("div");
    div.className = "predict-field";
    div.innerHTML = `<label>${feature}</label>`;

    const select = document.createElement("select");
    select.dataset.feature = feature;
    values.forEach(v => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = v;
      select.appendChild(opt);
    });
    div.appendChild(select);
    form.appendChild(div);
  });
}

document.getElementById("predictBtn").addEventListener("click", async () => {
  const sample = {};
  document.querySelectorAll(".predict-field select").forEach(sel => {
    sample[sel.dataset.feature] = sel.value;
  });

  try {
    const res  = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sample })
    });
    const data = await res.json();
    showPredictResult(data.prediction);
  } catch (err) {
    alert("Prediction error: " + err.message);
  }
});

function showPredictResult(prediction) {
  const el  = document.getElementById("predictResult");
  const idx = classList.indexOf(String(prediction));
  el.className = `predict-result class-${idx < 0 ? 0 : idx % 3}`;
  el.textContent = `Prediction: ${prediction}`;
  el.classList.remove("hidden");
}

// ─── LOADER ──────────────────────────────────────
function showLoader(show) {
  loader.classList.toggle("hidden", !show);
}
