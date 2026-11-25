/**
 * POP UP PARADE — Uniform Base Generator (Main Application)
 * Manages figure presets, uniform base parameters, 2D/3D previews, undo/redo, and STL/JSON export.
 */

// DEFAULT_CONFIG is loaded from figures.js

const STORAGE_KEY = 'pup_bases_v1';
let state = loadState();
let activeId = state.figures[0].id;
let currentTris = [];
const undoStack = [];
const redoStack = [];
let lastSnapshot = JSON.stringify({ state, activeId });
let historyTimer = null;
let isRestoringHistory = false;

function updateHistoryButtons() {
  const u = document.getElementById('btnUndo');
  const r = document.getElementById('btnRedo');
  if (u) u.disabled = undoStack.length === 0;
  if (r) r.disabled = redoStack.length === 0;
}

function commitHistoryNow() {
  if (isRestoringHistory) return;
  clearTimeout(historyTimer);
  const curr = JSON.stringify({ state, activeId });
  if (curr !== lastSnapshot) {
    undoStack.push(lastSnapshot);
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    lastSnapshot = curr;
    updateHistoryButtons();
  }
}

function applySnapshot(snapStr) {
  isRestoringHistory = true;
  clearTimeout(historyTimer);
  const parsed = JSON.parse(snapStr);
  state = parsed.state;
  activeId = parsed.activeId || state.figures[0].id;
  lastSnapshot = snapStr;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  renderAll();
  updateHistoryButtons();
  isRestoringHistory = false;
}

function performUndo() {
  commitHistoryNow();
  if (!undoStack.length) return;
  redoStack.push(lastSnapshot);
  applySnapshot(undoStack.pop());
}

function performRedo() {
  if (!redoStack.length) return;
  undoStack.push(lastSnapshot);
  applySnapshot(redoStack.pop());
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  if (isRestoringHistory) return;
  clearTimeout(historyTimer);
  historyTimer = setTimeout(commitHistoryNow, 350);
}

function getFacingVectors(facing) {
  if (facing === 'down') return { fx: 0, fy: -1, rx: 1, ry: 0 };
  if (facing === 'right') return { fx: 1, fy: 0, rx: 0, ry: 1 };
  if (facing === 'left') return { fx: -1, fy: 0, rx: 0, ry: -1 };
  return { fx: 0, fy: 1, rx: -1, ry: 0 }; // 'up' (+Y)
}

function relabelPegsByFacing(pegs, facing) {
  if (!pegs || pegs.length < 2) return;
  const { fx, fy, rx, ry } = getFacingVectors(facing || 'down');
  const projR = (p) => (Number(p.x) || 0) * rx + (Number(p.y) || 0) * ry;
  const projF = (p) => (Number(p.x) || 0) * fx + (Number(p.y) || 0) * fy;

  if (pegs.length === 2) {
    const d = Math.hypot(pegs[1].x - pegs[0].x, pegs[1].y - pegs[0].y);
    if (d < 15) {
      pegs.sort((a, b) => projF(a) - projF(b));
      pegs[0].label = 'Foot (Heel)';
      pegs[1].label = 'Foot (Toe)';
    } else {
      pegs.sort((a, b) => projR(a) - projR(b));
      pegs[0].label = 'Left Foot';
      pegs[1].label = 'Right Foot';
    }
    return;
  }

  const clusters = [];
  const used = new Set();
  for (let i = 0; i < pegs.length; i++) {
    if (used.has(i)) continue;
    const grp = [pegs[i]];
    used.add(i);
    for (let j = i + 1; j < pegs.length; j++) {
      if (used.has(j)) continue;
      if (grp.some((g) => Math.hypot(g.x - pegs[j].x, g.y - pegs[j].y) <= 18)) {
        grp.push(pegs[j]);
        used.add(j);
      }
    }
    const avgR = grp.reduce((s, g) => s + projR(g), 0) / grp.length;
    clusters.push({ grp, avgR });
  }
  clusters.sort((a, b) => a.avgR - b.avgR);
  clusters.forEach((cl, ci) => {
    const side = ci === 0 ? 'Left Foot' : ci === clusters.length - 1 ? 'Right Foot' : `Support ${ci}`;
    if (cl.grp.length === 1) {
      cl.grp[0].label = side;
    } else {
      cl.grp.sort((a, b) => projF(a) - projF(b));
      cl.grp.forEach((p, pi) => {
        p.label = pi === 0 ? `${side} (Heel)` : pi === 1 ? `${side} (Toe)` : `${side} (Pin ${pi + 1})`;
      });
    }
  });
  pegs.splice(0, pegs.length, ...clusters.flatMap((c) => c.grp));
}

function refreshAutoLabelsIfStandard(fig) {
  if (!fig || !fig.pegs || fig.pegs.length < 2) return;
  const isAuto = fig.pegs.every((p) => /^(Left Foot|Right Foot|Foot \(|Support |Peg \d+)/.test(p.label || ''));
  if (isAuto) relabelPegsByFacing(fig.pegs, fig.facing || 'down');
}

function fitPegGroupInsideBase(fig) {
  const active = fig.pegs.filter((p) => p.enabled !== false);
  if (!active.length) return;
  const params = getMeshParams();
  const outer = PUPMesh.generateOuterPolygon(params.shape, params.diameter, params);
  const wallMargin = (params.stepped ? (Number(params.stepInset) || 2) : (Number(params.chamfer) || 0)) + (params.hollow ? 2.6 : 1.5);

  // 1. Bounding-box center so 2-peg feet don't skew toward the 2-peg side
  const xs = active.map((p) => Number(p.x) || 0);
  const ys = active.map((p) => Number(p.y) || 0);
  let shiftX = -(Math.min(...xs) + Math.max(...xs)) / 2;
  let shiftY = -(Math.min(...ys) + Math.max(...ys)) / 2;

  // 2. Nudge group inward if any peg + wall margin encroaches on an outer edge
  for (let iter = 0; iter < 12; iter++) {
    let worstPen = 0;
    let pushX = 0, pushY = 0;
    for (const p of active) {
      const px = (Number(p.x) || 0) + shiftX;
      const py = (Number(p.y) || 0) + shiftY;
      const req = ((Number(p.diameter) || 4.0) + (Number(params.clearance) || 0)) / 2 + wallMargin;
      for (let i = 0; i < outer.length; i++) {
        const a = outer[i];
        const b = outer[(i + 1) % outer.length];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const len = Math.hypot(ex, ey) || 1;
        const nx = -ey / len, ny = ex / len; // inward normal for CCW
        const dist = (px - a[0]) * nx + (py - a[1]) * ny;
        const pen = req - dist;
        if (pen > worstPen) {
          worstPen = pen;
          pushX = nx * pen;
          pushY = ny * pen;
        }
      }
    }
    if (worstPen <= 0.05) break;
    shiftX += pushX;
    shiftY += pushY;
  }

  if (fig.mode === 'distance') {
    fig.centerOffsetX = Number(((Number(fig.centerOffsetX) || 0) + shiftX).toFixed(2));
    fig.centerOffsetY = Number(((Number(fig.centerOffsetY) || 0) + shiftY).toFixed(2));
    syncDistanceToPegs(fig);
    for (let i = 2; i < fig.pegs.length; i++) {
      fig.pegs[i].x = Number((fig.pegs[i].x + shiftX).toFixed(2));
      fig.pegs[i].y = Number((fig.pegs[i].y + shiftY).toFixed(2));
    }
  } else {
    fig.pegs.forEach((p) => {
      p.x = Number(((Number(p.x) || 0) + shiftX).toFixed(2));
      p.y = Number(((Number(p.y) || 0) + shiftY).toFixed(2));
    });
  }
}

function getActiveFigure() {
  return state.figures.find((f) => f.id === activeId) || state.figures[0];
}

function getMeshParams() {
  const d = state.defaults;
  const shapeVal = d.shape === 'hexagon_pointy' ? 'hexagon' : d.shape;
  return {
    ...d,
    chamfer: d.chamferEnabled ? (Number(d.chamfer) || 0) : 0,
    shape: shapeVal,
    hexPointy: d.shape === 'hexagon_pointy',
  };
}

function syncDistanceToPegs(fig) {
  if (fig.mode !== 'distance' || fig.pegs.length < 2) return;
  const half = (Number(fig.pegDistance) || 0) / 2;
  const rad = ((Number(fig.stanceAngle) || 0) * Math.PI) / 180;
  const ox = Number(fig.centerOffsetX) || 0;
  const oy = Number(fig.centerOffsetY) || 0;
  fig.pegs[0].x = Number((ox - Math.cos(rad) * half).toFixed(2));
  fig.pegs[0].y = Number((oy - Math.sin(rad) * half).toFixed(2));
  fig.pegs[1].x = Number((ox + Math.cos(rad) * half).toFixed(2));
  fig.pegs[1].y = Number((oy + Math.sin(rad) * half).toFixed(2));
}

// --- UI Rendering ---

function renderFigureList() {
  const list = document.getElementById('figureList');
  list.innerHTML = '';
  const query = (document.getElementById('figureSearch')?.value || '').trim().toLowerCase();
  const canDelete = state.figures.length > 1;
  const matches = state.figures
    .map((fig, idx) => ({ fig, idx }))
    .filter(({ fig }) => {
      if (!query) return true;
      const hay = `${fig.name || ''} ${fig.group || ''} ${fig.notes || ''}`.toLowerCase();
      return hay.includes(query);
    });

  if (!matches.length) {
    const empty = document.createElement('div');
    empty.className = 'muted-sm';
    empty.textContent = `No figures match "${document.getElementById('figureSearch').value.trim()}".`;
    list.appendChild(empty);
    return;
  }

  matches.forEach(({ fig, idx }) => {
    const div = document.createElement('div');
    div.className = 'fig-item' + (fig.id === activeId ? ' active' : '');
    div.innerHTML = `
      <div>
        <div class="fig-name">${fig.name}</div>
        <div class="fig-group">${fig.group || 'Custom'}</div>
      </div>
      <div class="fig-actions">
        <span class="badge ${fig.measured ? 'done' : 'todo'}">${fig.measured ? 'Measured ✓' : 'Needs Check'}</span>
        <button type="button" class="fig-del" title="${canDelete ? 'Delete figure' : 'At least one figure must remain'}" ${canDelete ? '' : 'disabled'} aria-label="Delete ${fig.name}">×</button>
      </div>
    `;
    div.onclick = () => {
      activeId = fig.id;
      renderAll();
    };
    const delBtn = div.querySelector('.fig-del');
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (state.figures.length <= 1) return;
      if (!confirm(`Delete "${fig.name}"?`)) return;
      commitHistoryNow();
      state.figures.splice(idx, 1);
      if (activeId === fig.id) {
        activeId = state.figures[Math.min(idx, state.figures.length - 1)].id;
      }
      saveState();
      commitHistoryNow();
      renderAll();
    };
    list.appendChild(div);
  });
}

function renderBaseControls() {
  const d = state.defaults;
  document.getElementById('baseShape').value = d.shape;
  document.getElementById('baseDiameter').value = d.diameter;
  document.getElementById('baseHeight').value = d.height;
  document.getElementById('baseChamferEnabled').checked = Boolean(d.chamferEnabled);
  document.getElementById('baseChamfer').value = d.chamfer;
  document.getElementById('chamferWrap').style.display = d.chamferEnabled ? '' : 'none';
  document.getElementById('holeClearance').value = d.clearance;
  const photoClr = document.getElementById('photoHoleClearance');
  if (photoClr) photoClr.value = d.clearance;
  document.getElementById('baseStepped').checked = d.stepped;
  document.getElementById('stepInset').value = d.stepInset;
  document.getElementById('stepHeight').value = d.stepHeight;
  document.getElementById('magnetPocket').checked = d.magnetPocket;
  document.getElementById('baseHollow').checked = Boolean(d.hollow);
  document.getElementById('magnetDiameter').value = d.magnetDiameter;
  document.getElementById('magnetDepth').value = d.magnetDepth;

  document.getElementById('stepInsetWrap').style.display = d.stepped ? '' : 'none';
  document.getElementById('stepHeightWrap').style.display = d.stepped ? '' : 'none';
  document.getElementById('magDiaWrap').style.display = d.magnetPocket ? '' : 'none';
  document.getElementById('magDepthWrap').style.display = d.magnetPocket ? '' : 'none';
}

function renderPegControls() {
  const fig = getActiveFigure();
  document.getElementById('activeFigTitle').textContent = fig.name;
  document.getElementById('activeFigNotes').textContent = fig.notes || '';
  document.getElementById('figMeasured').checked = Boolean(fig.measured);
  document.getElementById('figFacing').value = fig.facing || 'down';

  document.getElementById('modeDistance').className = fig.mode === 'distance' ? 'active' : '';
  document.getElementById('modeManual').className = fig.mode === 'manual' ? 'active' : '';
  document.getElementById('distanceControls').style.display = fig.mode === 'distance' ? 'grid' : 'none';

  document.getElementById('pegDistance').value = fig.pegDistance ?? 24;
  document.getElementById('stanceAngle').value = fig.stanceAngle ?? 0;
  document.getElementById('centerOffsetX').value = fig.centerOffsetX ?? 0;
  document.getElementById('centerOffsetY').value = fig.centerOffsetY ?? 0;

  const container = document.getElementById('pegsContainer');
  container.innerHTML = '';

  fig.pegs.forEach((peg, idx) => {
    const lockedXY = fig.mode === 'distance' && idx < 2;
    const card = document.createElement('div');
    card.className = 'peg-card';
    card.innerHTML = `
      <div class="peg-header">
        <input type="text" data-peg="${idx}" data-field="label" value="${(peg.label || ('Peg ' + (idx + 1))).replace(/"/g, '&quot;')}" style="background:transparent; border:1px solid transparent; padding:2px 5px; font-weight:600; font-size:0.84rem; width:62%;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='transparent'" />
        <div style="display:flex; gap:8px; align-items:center;">
          <label class="checkbox-row" style="font-size:0.75rem;">
            <input type="checkbox" data-peg="${idx}" data-field="enabled" ${peg.enabled !== false ? 'checked' : ''} /> Active
          </label>
          ${idx >= 2 ? `<button data-remove="${idx}" style="padding:2px 7px; font-size:0.74rem;">✕</button>` : ''}
        </div>
      </div>
      <div class="field-grid">
        <div class="field">
          <label>Diameter (mm)</label>
          <input type="number" step="0.1" min="1" max="15" data-peg="${idx}" data-field="diameter" value="${peg.diameter}" />
        </div>
        <div class="field">
          <label>Depth (mm)</label>
          <input type="number" step="0.2" min="1" max="20" data-peg="${idx}" data-field="depth" value="${peg.depth}" ${peg.through ? 'disabled' : ''} />
        </div>
        <div class="field">
          <label>X (mm)</label>
          <input type="number" step="0.2" data-peg="${idx}" data-field="x" value="${peg.x}" ${lockedXY ? 'disabled' : ''} />
        </div>
        <div class="field">
          <label>Y (mm)</label>
          <input type="number" step="0.2" data-peg="${idx}" data-field="y" value="${peg.y}" ${lockedXY ? 'disabled' : ''} />
        </div>
        <div class="field">
          <label>Peg Shape</label>
          <select data-peg="${idx}" data-field="shape">
            <option value="round" ${peg.shape === 'round' ? 'selected' : ''}>Round</option>
            <option value="hexagon" ${peg.shape === 'hexagon' ? 'selected' : ''}>Hexagon (Keyed)</option>
            <option value="d_shape" ${peg.shape === 'd_shape' ? 'selected' : ''}>D-Shape (Keyed)</option>
            <option value="keyhole" ${peg.shape === 'keyhole' ? 'selected' : ''}>Round + Square Key</option>
            <option value="slot" ${peg.shape === 'slot' ? 'selected' : ''}>Oval / Slot</option>
          </select>
        </div>
        <div class="field">
          <label>${peg.shape === 'round' ? 'Through-hole' : 'Key Angle (°)'}</label>
          ${peg.shape === 'round'
            ? `<label class="checkbox-row" style="padding-top:6px;"><input type="checkbox" data-peg="${idx}" data-field="through" ${peg.through ? 'checked' : ''} /> Through</label>`
            : `<input type="number" step="5" data-peg="${idx}" data-field="flatAngle" value="${peg.flatAngle || 0}" />`
          }
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('input, select').forEach((el) => {
    el.onchange = el.oninput = () => {
      const idx = Number(el.dataset.peg);
      const field = el.dataset.field;
      const p = fig.pegs[idx];
      if (el.type === 'checkbox') {
        p[field] = el.checked;
        if (field === 'through') renderPegControls();
      } else if (el.type === 'number') {
        p[field] = Number(el.value);
      } else {
        p[field] = el.value;
        if (field === 'shape') renderPegControls();
      }
      saveState();
      if (field !== 'label') rebuildAndDraw();
    };
  });

  container.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.onclick = () => {
      fig.pegs.splice(Number(btn.dataset.remove), 1);
      saveState();
      renderPegControls();
      rebuildAndDraw();
    };
  });
}

function rebuildAndDraw() {
  const fig = getActiveFigure();
  syncDistanceToPegs(fig);
  const params = getMeshParams();
  const bar = document.getElementById('validationBar');

  try {
    currentTris = PUPMesh.buildBaseMesh(params, fig);
    bar.className = 'status-bar ok';
    bar.textContent = `Mesh ready — ${currentTris.length} triangles, watertight manifold STL (${params.diameter} mm ${state.defaults.shape}).`;
  } catch (err) {
    currentTris = [];
    bar.className = 'status-bar warn';
    bar.textContent = 'Geometry error: ' + err.message + ' (check that pegs are inside the base and not overlapping).';
  }

  draw2D(params, fig);
  draw3D(currentTris);
}


function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderAll() {
  renderFigureList();
  renderBaseControls();
  renderPegControls();
  rebuildAndDraw();
}

// --- Event Listeners ---
['baseShape', 'baseDiameter', 'baseHeight', 'baseChamferEnabled', 'baseChamfer', 'holeClearance', 'baseStepped', 'stepInset', 'stepHeight', 'magnetPocket', 'magnetDiameter', 'magnetDepth', 'baseHollow'].forEach((id) => {
  const el = document.getElementById(id);
  el.onchange = el.oninput = () => {
    const d = state.defaults;
    if (id === 'baseShape') {
      d.shape = el.value;
      if (el.value === 'hexagon' || el.value === 'hexagon_pointy') {
        d.stepped = true;
        d.diameter = 103.65;
      } else {
        d.stepped = false;
        if (el.value === 'circle') d.diameter = 65;
      }
      renderBaseControls();
    }
    else if (id === 'baseDiameter') d.diameter = Number(el.value);
    else if (id === 'baseHeight') d.height = Number(el.value);
    else if (id === 'baseChamferEnabled') { d.chamferEnabled = el.checked; renderBaseControls(); }
    else if (id === 'baseChamfer') d.chamfer = Number(el.value);
    else if (id === 'holeClearance') d.clearance = Number(el.value);
    else if (id === 'baseStepped') { d.stepped = el.checked; renderBaseControls(); }
    else if (id === 'stepInset') d.stepInset = Number(el.value);
    else if (id === 'stepHeight') d.stepHeight = Number(el.value);
    else if (id === 'magnetPocket') { d.magnetPocket = el.checked; renderBaseControls(); }
    else if (id === 'baseHollow') { d.hollow = el.checked; renderBaseControls(); }
    else if (id === 'magnetDiameter') d.magnetDiameter = Number(el.value);
    else if (id === 'magnetDepth') d.magnetDepth = Number(el.value);
    saveState();
    rebuildAndDraw();
  };
});

document.getElementById('figMeasured').onchange = (e) => {
  getActiveFigure().measured = e.target.checked;
  saveState();
  renderFigureList();
};

document.getElementById('figFacing').onchange = (e) => {
  const fig = getActiveFigure();
  fig.facing = e.target.value;
  relabelPegsByFacing(fig.pegs, fig.facing);
  saveState();
  renderPegControls();
  rebuildAndDraw();
};

document.getElementById('modeDistance').onclick = () => {
  getActiveFigure().mode = 'distance';
  saveState();
  renderPegControls();
  rebuildAndDraw();
};
document.getElementById('modeManual').onclick = () => {
  getActiveFigure().mode = 'manual';
  saveState();
  renderPegControls();
  rebuildAndDraw();
};

['pegDistance', 'stanceAngle', 'centerOffsetX', 'centerOffsetY'].forEach((id) => {
  document.getElementById(id).oninput = (e) => {
    const fig = getActiveFigure();
    fig[id] = Number(e.target.value);
    syncDistanceToPegs(fig);
    saveState();
    renderPegControls();
    rebuildAndDraw();
  };
});

document.getElementById('btnAddPeg').onclick = () => {
  const fig = getActiveFigure();
  fig.pegs.push({ label: 'Support / Peg ' + (fig.pegs.length + 1), x: 0, y: -15, diameter: 3.5, depth: 10.0, shape: 'hexagon', flatAngle: 0, enabled: true });
  saveState();
  renderPegControls();
  rebuildAndDraw();
};

document.getElementById('btnAddFigure').onclick = () => {
  const name = prompt('Figure name (e.g. "Hatsune Miku"):');
  if (!name) return;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now().toString().slice(-4);
  state.figures.push({
    id, name, group: 'Custom', measured: false, notes: '',
    mode: 'distance', centerOffsetX: 0, centerOffsetY: 0, stanceAngle: 0, pegDistance: 24,
    pegs: [
      { label: 'Left Foot', x: -12, y: 0, diameter: 4.0, depth: 10.0, shape: 'hexagon', flatAngle: 0, enabled: true },
      { label: 'Right Foot', x: 12, y: 0, diameter: 4.0, depth: 10.0, shape: 'hexagon', flatAngle: 0, enabled: true }
    ]
  });
  activeId = id;
  const searchEl = document.getElementById('figureSearch');
  if (searchEl) searchEl.value = '';
  saveState();
  renderAll();
};

document.getElementById('figureSearch').oninput = () => renderFigureList();

const BACKUP_KEY = STORAGE_KEY + '_backup';
function updateUndoResetBtn() {
  const btn = document.getElementById('btnUndoReset');
  if (!btn) return;
  try {
    btn.style.display = localStorage.getItem(BACKUP_KEY) ? '' : 'none';
  } catch (e) {
    btn.style.display = 'none';
  }
}

document.getElementById('btnResetPresets').onclick = () => {
  if (!confirm('Reset all figures and settings back to defaults? (A backup of your current setup will be kept so you can undo.)')) return;
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ state, activeId }));
  } catch (e) {}
  state = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  activeId = state.figures[0].id;
  saveState();
  renderAll();
  updateUndoResetBtn();

document.getElementById('btnResetFigure').onclick = () => {
  const fig = getActiveFigure();
  if (!fig) return;
  if (!confirm(`Reset "${fig.name}" back to its default peg layout?`)) return;
  const preset = DEFAULT_CONFIG.figures.find((f) => f.id === fig.id);
  const idx = state.figures.findIndex((f) => f.id === fig.id);
  if (idx < 0) return;
  if (preset) {
    state.figures[idx] = JSON.parse(JSON.stringify(preset));
  } else {
    state.figures[idx] = {
      id: fig.id,
      name: fig.name,
      group: fig.group || 'Custom',
      measured: false,
      notes: fig.notes || '',
      mode: 'distance',
      centerOffsetX: 0,
      centerOffsetY: 0,
      stanceAngle: 0,
      pegDistance: 24,
      pegs: [
        { label: 'Left Foot', x: -12, y: 0, diameter: 4.0, depth: 10.0, shape: 'hexagon', flatAngle: 0, enabled: true },
        { label: 'Right Foot', x: 12, y: 0, diameter: 4.0, depth: 10.0, shape: 'hexagon', flatAngle: 0, enabled: true },
      ],
    };
  }
  saveState();
  renderAll();
};
};

document.getElementById('btnUndoReset').onclick = () => {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.state && parsed.state.figures) {
      state = parsed.state;
      activeId = parsed.activeId || state.figures[0].id;
      saveState();
      renderAll();
    }
  } catch (e) {}
};

updateUndoResetBtn();

document.getElementById('btnResetFigure').onclick = () => {
  const fig = getActiveFigure();
  if (!fig) return;
  if (!confirm(`Reset "${fig.name}" back to its default peg layout?`)) return;
  const preset = DEFAULT_CONFIG.figures.find((f) => f.id === fig.id);
  const idx = state.figures.findIndex((f) => f.id === fig.id);
  if (idx < 0) return;
  if (preset) {
    state.figures[idx] = JSON.parse(JSON.stringify(preset));
  } else {
    state.figures[idx] = {
      id: fig.id,
      name: fig.name,
      group: fig.group || 'Custom',
      measured: false,
      notes: fig.notes || '',
      mode: 'distance',
      centerOffsetX: 0,
      centerOffsetY: 0,
      stanceAngle: 0,
      pegDistance: 24,
      pegs: [
        { label: 'Left Foot', x: -12, y: 0, diameter: 4.0, depth: 10.0, shape: 'hexagon', flatAngle: 0, enabled: true },
        { label: 'Right Foot', x: 12, y: 0, diameter: 4.0, depth: 10.0, shape: 'hexagon', flatAngle: 0, enabled: true },
      ],
    };
  }
  saveState();
  renderAll();
};

document.getElementById('btnDownloadOne').onclick = () => {
  if (!currentTris.length) return;
  const fig = getActiveFigure();
  const stl = PUPMesh.trianglesToBinarySTL(currentTris, `PUP Base - ${fig.name}`);
  downloadBytes(stl, `pup_base_${fig.id}_${state.defaults.shape}_${state.defaults.diameter}mm.stl`);
};

document.getElementById('btnDownloadAll').onclick = () => {
  const params = getMeshParams();
  const targets = state.figures.filter((f) => f.measured);
  const list = targets.length ? targets : state.figures;
  list.forEach((fig, idx) => {
    setTimeout(() => {
      syncDistanceToPegs(fig);
      const tris = PUPMesh.buildBaseMesh(params, fig);
      const stl = PUPMesh.trianglesToBinarySTL(tris, `PUP Base - ${fig.name}`);
      downloadBytes(stl, `pup_base_${fig.id}_${state.defaults.shape}_${state.defaults.diameter}mm.stl`);
    }, idx * 250);
  });
};

document.getElementById('btnExportGauge').onclick = () => {
  const tris = PUPMesh.buildTestGaugeMesh(1.8, 0.2, 23);
  const stl = PUPMesh.trianglesToBinarySTL(tris, 'PUP Peg-Fit Test Gauge 1.8-6.2mm (0.2mm step)');
  downloadBytes(stl, 'pup_peg_fit_test_gauge_1.8_to_6.2mm.stl');
};

document.getElementById('btnExportJson').onclick = () => {
  const bytes = new TextEncoder().encode(JSON.stringify(state, null, 2));
  downloadBytes(bytes, 'pup_bases_config.json');
};

document.getElementById('btnImportJson').onclick = () => document.getElementById('fileImportJson').click();
document.getElementById('fileImportJson').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (parsed && parsed.figures && parsed.defaults) {
        state = parsed;
        activeId = state.figures[0].id;
        saveState();
        renderAll();
      }
    } catch (err) {
      alert('Invalid JSON config file.');
    }
  };
  reader.readAsText(file);
};


function exportCalibrationBlockSTL() {
  const tris = PUPMesh.buildCalibrationBlockMesh(70, 8, 2.4);
  const stl = PUPMesh.trianglesToBinarySTL(tris, 'PUP Photo Calibration Frame 70x70mm');
  downloadBytes(stl, 'pup_photo_calibration_frame_70mm.stl');
}
document.getElementById('btnExportCalBlock').onclick = exportCalibrationBlockSTL;
document.getElementById('btnModalExportCal').onclick = exportCalibrationBlockSTL;
document.getElementById('btnModalExportLBracket').onclick = () => {
  const tris = PUPMesh.buildCalibrationLBracketMesh(70, 10, 2.4);
  const stl = PUPMesh.trianglesToBinarySTL(tris, 'PUP Photo Calibration L-Bracket 70x70mm');
  downloadBytes(stl, 'pup_photo_calibration_l_bracket_70mm.stl');
};

// --- Initialization & Global Shortcuts ---
renderAll();
updateHistoryButtons();

document.getElementById('btnUndo').onclick = performUndo;
document.getElementById('btnRedo').onclick = performRedo;
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const key = e.key.toLowerCase();
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    performUndo();
  } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
    e.preventDefault();
    performRedo();
  }
});
