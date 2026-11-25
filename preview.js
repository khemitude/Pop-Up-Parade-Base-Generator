/**
 * POP UP PARADE — 2D Blueprint & 3D WebGL Preview Module
 * Handles 2D top-down canvas rendering, 3D WebGL rendering, and mouse/drag interactions.
 */

let camYaw = 0.65;
let camPitch = 0.58;
let camZoom = 1.0;

function draw2D(params, fig) {
  const canvas = document.getElementById('canvas2d');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const scale = Math.min(w, h) / (params.diameter * 1.35);
  const cx = w / 2, cy = h / 2;
  const toPx = (x, y) => [cx + x * scale, cy - y * scale];

  // 10mm Grid
  ctx.strokeStyle = '#182030';
  ctx.lineWidth = 1;
  const gridRange = Math.ceil((params.diameter * 0.8) / 10) * 10;
  for (let g = -gridRange; g <= gridRange; g += 10) {
    const [gx] = toPx(g, 0);
    const [, gy] = toPx(0, g);
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = '#28354d';
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();

  // Outer polygon
  const outer = PUPMesh.generateOuterPolygon(params.shape, params.diameter, params);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  outer.forEach((p, i) => {
    const [px, py] = toPx(p[0], p[1]);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Front / Facing edge indicator
  const facing = fig.facing || 'down';
  const { fx, fy } = getFacingVectors(facing);
  const halfSpan = (params.diameter / 2) * scale + 14;
  const fxPx = cx + fx * halfSpan;
  const fyPx = cy - fy * halfSpan;
  const arrowTxt = facing === 'up' ? '▲ FRONT' : facing === 'down' ? '▼ FRONT' : facing === 'left' ? '◀ FRONT' : 'FRONT ▶';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(arrowTxt, fxPx, fyPx + 4);
  ctx.textAlign = 'left';

  // Peg holes
  const pegs = fig.pegs.filter((p) => p.enabled !== false);
  pegs.forEach((peg, i) => {
    const hole = PUPMesh.generateHolePolygon(peg, params.clearance);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    hole.forEach((p, j) => {
      const [px, py] = toPx(p[0], p[1]);
      if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const [lx, ly] = toPx(peg.x, peg.y);
    const labelText = `P${i + 1}: Ø${(peg.diameter + params.clearance).toFixed(2)}`;
    ctx.font = 'bold 12px sans-serif';
    const tw = ctx.measureText(labelText).width;
    const th = 14;
    if (!draw2D._placedLabels) draw2D._placedLabels = [];
    if (i === 0) draw2D._placedLabels = [];

    const candidates = [
      [lx + 12, ly - 10],
      [lx - 12 - tw, ly - 10],
      [lx + 12, ly + 18],
      [lx - 12 - tw, ly + 18],
      [lx - tw / 2, ly - 18],
      [lx - tw / 2, ly + 24],
    ];
    let chosen = candidates[0];
    for (const [cx0, cy0] of candidates) {
      const box = { x0: cx0 - 3, y0: cy0 - th, x1: cx0 + tw + 3, y1: cy0 + 4 };
      const overlapsLabel = draw2D._placedLabels.some(
        (b) => !(box.x1 < b.x0 || box.x0 > b.x1 || box.y1 < b.y0 || box.y0 > b.y1)
      );
      const overlapsPeg = pegs.some((op) => {
        const [ox, oy] = toPx(op.x, op.y);
        const rPx = ((op.diameter + params.clearance) / 2) * scale + 3;
        return ox + rPx > box.x0 && ox - rPx < box.x1 && oy + rPx > box.y0 && oy - rPx < box.y1;
      });
      if (!overlapsLabel && !overlapsPeg) {
        chosen = [cx0, cy0];
        break;
      }
    }
    draw2D._placedLabels.push({ x0: chosen[0] - 3, y0: chosen[1] - th, x1: chosen[0] + tw + 3, y1: chosen[1] + 4 });

    ctx.fillStyle = 'rgba(15, 19, 26, 0.8)';
    ctx.fillRect(chosen[0] - 3, chosen[1] - 12, tw + 6, 15);
    ctx.fillStyle = '#fef3c7';
    ctx.textAlign = 'left';
    ctx.fillText(labelText, chosen[0], chosen[1]);
  });

  // Magnet pocket indicator (underside)
  if (params.magnetPocket) {
    const mDia = Number(params.magnetDiameter) || 8.2;
    const mRad = mDia / 2;
    let mx = 0, my = 0;
    const isClear = (cx, cy) => pegs.every((p) => Math.hypot(cx - (p.x || 0), cy - (p.y || 0)) >= mRad + ((p.diameter || 4.0) + params.clearance) / 2 + 1.5);
    if (!isClear(0, 0)) {
      const maxR = Math.max(0, params.diameter / 2 - (params.chamfer || 0) - (params.stepped ? (params.stepInset || 4) : 0) - mRad - 3.0);
      let found = false;
      for (let r = Math.ceil(mRad + 4); r <= maxR && !found; r += 3) {
        for (let aIdx = 0; aIdx < 16; aIdx++) {
          const a = (aIdx / 16) * Math.PI * 2 - Math.PI / 2;
          const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
          if (isClear(cx, cy)) { mx = cx; my = cy; found = true; break; }
        }
      }
    }
    const [px, py] = toPx(mx, my);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, mRad * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c4b5fd';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Magnet Ø${mDia.toFixed(1)}`, px + 8, py + 12);
    ctx.restore();
  }
}

let glCtx = null;
let glProg = null;
let glBuf = null;

function initWebGL(canvas) {
  if (glCtx) return true;
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
  if (!gl) return false;

  const vsSrc = `
    attribute vec3 aPos;
    attribute vec3 aNorm;
    uniform float uYaw, uPitch, uScale, uHalfH, uAspect;
    varying vec3 vNorm;
    void main() {
      float cy = cos(uYaw), sy = sin(uYaw);
      float cp = cos(uPitch), sp = sin(uPitch);
      float x1 = aPos.x * cy - aPos.y * sy;
      float y1 = aPos.x * sy + aPos.y * cy;
      float z1 = aPos.z - uHalfH;
      float y2 = y1 * cp - z1 * sp;
      float z2 = y1 * sp + z1 * cp;
      gl_Position = vec4(x1 * uScale / uAspect, z2 * uScale, y2 * 0.005, 1.0);

      float nx1 = aNorm.x * cy - aNorm.y * sy;
      float ny1 = aNorm.x * sy + aNorm.y * cy;
      float ny2 = ny1 * cp - aNorm.z * sp;
      float nz2 = ny1 * sp + aNorm.z * cp;
      vNorm = vec3(nx1, ny2, nz2);
    }
  `;
  const fsSrc = `
    precision mediump float;
    varying vec3 vNorm;
    void main() {
      vec3 n = normalize(vNorm);
      float light = max(0.28, dot(n, normalize(vec3(0.35, -0.75, 0.55))));
      if (n.y > 0.5) light = max(light, 0.45);
      vec3 col = vec3(0.07 + 0.18 * light, 0.14 + 0.57 * light, 0.20 + 0.84 * light);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  glCtx = gl;
  glProg = prog;
  glBuf = gl.createBuffer();
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.043, 0.055, 0.078, 1.0);
  return true;
}

function draw3D(tris) {
  const canvas = document.getElementById('canvas3d');
  if (!initWebGL(canvas)) return;
  const gl = glCtx;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (!tris.length) return;

  const data = new Float32Array(tris.length * 18);
  let ptr = 0;
  for (const t of tris) {
    const ux = t[1][0] - t[0][0], uy = t[1][1] - t[0][1], uz = t[1][2] - t[0][2];
    const vx = t[2][0] - t[0][0], vy = t[2][1] - t[0][1], vz = t[2][2] - t[0][2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (let k = 0; k < 3; k++) {
      data[ptr++] = t[k][0]; data[ptr++] = t[k][1]; data[ptr++] = t[k][2];
      data[ptr++] = nx; data[ptr++] = ny; data[ptr++] = nz;
    }
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, glBuf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(glProg, 'aPos');
  const aNorm = gl.getAttribLocation(glProg, 'aNorm');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(aNorm);
  gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 24, 12);

  const baseScale = (2.0 / (state.defaults.diameter * 1.45)) * camZoom;
  gl.uniform1f(gl.getUniformLocation(glProg, 'uYaw'), camYaw);
  gl.uniform1f(gl.getUniformLocation(glProg, 'uPitch'), camPitch);
  gl.uniform1f(gl.getUniformLocation(glProg, 'uScale'), baseScale);
  gl.uniform1f(gl.getUniformLocation(glProg, 'uHalfH'), state.defaults.height / 2);
  gl.uniform1f(gl.getUniformLocation(glProg, 'uAspect'), canvas.width / canvas.height);

  gl.drawArrays(gl.TRIANGLES, 0, tris.length * 3);
}

// 3D drag rotation & zoom
const c3d = document.getElementById('canvas3d');
let dragging = false, lastX = 0, lastY = 0;
c3d.onmousedown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  camYaw += (e.clientX - lastX) * 0.01;
  camPitch = Math.max(-1.5, Math.min(1.5, camPitch + (e.clientY - lastY) * 0.01));
  lastX = e.clientX; lastY = e.clientY;
  draw3D(currentTris);
});
document.getElementById('btnFlipView').onclick = () => {
  camPitch = camPitch >= 0 ? -0.65 : 0.58;
  draw3D(currentTris);
};
c3d.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 0.89;
  camZoom = Math.max(0.4, Math.min(4.0, camZoom * factor));
  draw3D(currentTris);
}, { passive: false });
document.getElementById('btnZoomIn').onclick = () => {
  camZoom = Math.min(4.0, camZoom * 1.2);
  draw3D(currentTris);
};
document.getElementById('btnZoomOut').onclick = () => {
  camZoom = Math.max(0.4, camZoom / 1.2);
  draw3D(currentTris);
};
document.getElementById('btnZoomReset').onclick = () => {
  camYaw = 0.65; camPitch = 0.58; camZoom = 1.0;
  draw3D(currentTris);
};

// 2D Blueprint: Drag to move or right-drag/Shift+drag to rotate all holes as one group
(function initBlueprintGroupDrag() {
  const c2d = document.getElementById('canvas2d');
  let dragMode = null; // 'move' | 'rotate'
  let startMmX = 0, startMmY = 0;
  let startOffsetX = 0, startOffsetY = 0;
  let startStanceAngle = 0;
  let startPivotX = 0, startPivotY = 0, startAngle = 0;
  let startPegs = [];

  function canvasPxToMm(clientX, clientY) {
    const rect = c2d.getBoundingClientRect();
    const mx = ((clientX - rect.left) / rect.width) * c2d.width;
    const my = ((clientY - rect.top) / rect.height) * c2d.height;
    const params = getMeshParams();
    const scale = Math.min(c2d.width, c2d.height) / (params.diameter * 1.35);
    return [(mx - c2d.width / 2) / scale, -(my - c2d.height / 2) / scale];
  }

  function getGroupPivot(fig, pegs) {
    if (fig.mode === 'distance') {
      return [Number(fig.centerOffsetX) || 0, Number(fig.centerOffsetY) || 0];
    }
    const active = pegs.filter((p) => p.enabled !== false);
    const list = active.length ? active : pegs;
    if (!list.length) return [0, 0];
    return [
      list.reduce((s, p) => s + (Number(p.x) || 0), 0) / list.length,
      list.reduce((s, p) => s + (Number(p.y) || 0), 0) / list.length,
    ];
  }

  function rotatePoint(px, py, cx, cy, rad) {
    const dx = px - cx;
    const dy = py - cy;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  }

  function applyRotationFromSnapshot(fig, radDelta) {
    if (fig.mode === 'distance') {
      const degDelta = (radDelta * 180) / Math.PI;
      fig.stanceAngle = Number((startStanceAngle + degDelta).toFixed(1));
      for (let i = 2; i < fig.pegs.length; i++) {
        const [rx, ry] = rotatePoint(startPegs[i].x, startPegs[i].y, startPivotX, startPivotY, radDelta);
        fig.pegs[i].x = Number(rx.toFixed(2));
        fig.pegs[i].y = Number(ry.toFixed(2));
      }
    } else {
      fig.pegs.forEach((p, i) => {
        const [rx, ry] = rotatePoint(startPegs[i].x, startPegs[i].y, startPivotX, startPivotY, radDelta);
        p.x = Number(rx.toFixed(2));
        p.y = Number(ry.toFixed(2));
      });
    }
  }

  c2d.style.cursor = 'grab';
  c2d.addEventListener('contextmenu', (e) => e.preventDefault());
  c2d.addEventListener('mousedown', (e) => {
    const fig = getActiveFigure();
    if (!fig || !fig.pegs.length) return;
    const [mmX, mmY] = canvasPxToMm(e.clientX, e.clientY);
    dragMode = (e.button === 2 || e.shiftKey) ? 'rotate' : 'move';
    startMmX = mmX;
    startMmY = mmY;
    startOffsetX = Number(fig.centerOffsetX) || 0;
    startOffsetY = Number(fig.centerOffsetY) || 0;
    startStanceAngle = Number(fig.stanceAngle) || 0;
    startPegs = fig.pegs.map((p) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0, enabled: p.enabled }));
    [startPivotX, startPivotY] = getGroupPivot(fig, startPegs);
    startAngle = Math.atan2(mmY - startPivotY, mmX - startPivotX);
    c2d.style.cursor = dragMode === 'rotate' ? 'alias' : 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragMode) return;
    const fig = getActiveFigure();
    const [mmX, mmY] = canvasPxToMm(e.clientX, e.clientY);

    if (dragMode === 'move') {
      const dx = mmX - startMmX;
      const dy = mmY - startMmY;
      if (fig.mode === 'distance') {
        fig.centerOffsetX = Number((startOffsetX + dx).toFixed(2));
        fig.centerOffsetY = Number((startOffsetY + dy).toFixed(2));
        for (let i = 2; i < fig.pegs.length; i++) {
          fig.pegs[i].x = Number((startPegs[i].x + dx).toFixed(2));
          fig.pegs[i].y = Number((startPegs[i].y + dy).toFixed(2));
        }
      } else {
        fig.pegs.forEach((p, i) => {
          p.x = Number((startPegs[i].x + dx).toFixed(2));
          p.y = Number((startPegs[i].y + dy).toFixed(2));
        });
      }
    } else if (dragMode === 'rotate') {
      const currAngle = Math.atan2(mmY - startPivotY, mmX - startPivotX);
      applyRotationFromSnapshot(fig, currAngle - startAngle);
    }

    renderPegControls();
    rebuildAndDraw();
  });

  window.addEventListener('mouseup', () => {
    if (!dragMode) return;
    dragMode = null;
    c2d.style.cursor = 'grab';
    saveState();
  });

  function rotateStep(deg) {
    const fig = getActiveFigure();
    if (!fig || !fig.pegs.length) return;
    startStanceAngle = Number(fig.stanceAngle) || 0;
    startPegs = fig.pegs.map((p) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0, enabled: p.enabled }));
    [startPivotX, startPivotY] = getGroupPivot(fig, startPegs);
    applyRotationFromSnapshot(fig, (deg * Math.PI) / 180);
    syncDistanceToPegs(fig);
    refreshAutoLabelsIfStandard(fig);
    saveState();
    renderPegControls();
    rebuildAndDraw();
  }

  const rotateBindings = [
    ['btnRotateLeft', 15],
    ['btnRotateRight', -15],
    ['btnRotateLeft90', 90],
    ['btnRotateRight90', -90],
    ['btnRotate180', 180],
  ];
  for (const [id, deg] of rotateBindings) {
    document.getElementById(id).onclick = () => rotateStep(deg);
  }

  document.getElementById('btnCenterPegs').onclick = () => {
    const fig = getActiveFigure();
    const activePegs = fig.pegs.filter((p) => p.enabled !== false);
    if (!activePegs.length) return;
    if (fig.mode === 'distance') {
      fig.centerOffsetX = 0;
      fig.centerOffsetY = 0;
      syncDistanceToPegs(fig);
    }
    fitPegGroupInsideBase(fig);
    refreshAutoLabelsIfStandard(fig);
    saveState();
    renderPegControls();
    rebuildAndDraw();
  };
})();
