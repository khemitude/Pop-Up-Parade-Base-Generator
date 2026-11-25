// =========================================================================
// Photo Measurement & Perspective Homography Module
// =========================================================================
(function initPhotoMeasurer() {
  const modal = document.getElementById('photoModal');
  const canvas = document.getElementById('photoCanvas');
  const wrap = document.getElementById('photoCanvasWrap');
  const ctx = canvas.getContext('2d');

  let img = null;
  let viewScale = 1;
  let viewX = 0;
  let viewY = 0;
  let panMode = false;
  let isPanning = false;
  let panStartX = 0, panStartY = 0;
  let hoverCanvasPt = null;
  let dragCalIdx = -1;
  let dragPegIdx = -1;

  let calMode = 'frame70'; // 'frame70' | 'card' | 'twopoint'
  let calPts = []; // image pixel coords [[u, v], ...]
  let H_imgToMm = null;
  let H_mmToImg = null;
  let twoPointScale = null; // { origin: [u, v], mmPerPx: number }

  let pegTool = '3pt'; // '3pt' | '2pt' | '1pt'
  let pendingPegPts = []; // image pixel coords
  let measuredPegs = []; // [{ x, y, diameter, imgX, imgY, imgR }]

  const CAL_CORNER_LABELS = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'];

  function solveLinearSystem(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let maxRow = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
      }
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
      const pivot = M[col][col];
      if (Math.abs(pivot) < 1e-10) return null;
      for (let j = col; j <= n; j++) M[col][j] /= pivot;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = M[r][col];
        for (let j = col; j <= n; j++) M[r][j] -= factor * M[col][j];
      }
    }
    return M.map((row) => row[n]);
  }

  function computeHomography(srcPts, dstPts) {
    if (srcPts.length !== 4 || dstPts.length !== 4) return null;
    const A = [];
    const b = [];
    for (let i = 0; i < 4; i++) {
      const [sx, sy] = srcPts[i];
      const [dx, dy] = dstPts[i];
      A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
      b.push(dx);
      A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
      b.push(dy);
    }
    const h = solveLinearSystem(A, b);
    if (!h) return null;
    return [...h, 1];
  }

  function applyH(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    if (Math.abs(w) < 1e-10) return [0, 0];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  }

  function getTargetCalDims() {
    if (calMode === 'frame70') return { w: 70, h: 70, pts: 4 };
    if (calMode === 'lbracket70') return { w: 70, h: 70, pts: 3 };
    if (calMode === 'puphex') return { w: 103.65 / (2 * Math.cos(Math.PI / 6)), h: 103.65, pts: 4 }; // 59.84 x 103.65mm top/bottom flat-edge corners
    if (calMode === 'card') return { w: 85.6, h: 53.98, pts: 4 };
    return { w: Number(document.getElementById('twoPointMm').value) || 50, h: 0, pts: 2 };
  }

  let affine3 = null; // for 3-point L-bracket

  function isCalibrated() {
    if (calMode === 'twopoint') return twoPointScale !== null;
    if (calMode === 'lbracket70') return affine3 !== null;
    return H_imgToMm !== null;
  }

  function imgToMm(u, v) {
    if (calMode === 'twopoint' && twoPointScale) {
      return [
        (u - twoPointScale.origin[0]) * twoPointScale.mmPerPx,
        -(v - twoPointScale.origin[1]) * twoPointScale.mmPerPx,
      ];
    }
    if (calMode === 'lbracket70' && affine3) {
      const dx = u - affine3.origin[0];
      const dy = v - affine3.origin[1];
      const s = (dx * affine3.vy[1] - dy * affine3.vy[0]) / affine3.det;
      const t = (affine3.vx[0] * dy - affine3.vx[1] * dx) / affine3.det;
      return [-35 + s * 70, -35 + t * 70];
    }
    if (H_imgToMm) return applyH(H_imgToMm, u, v);
    return null;
  }

  function mmToImgPt(mmX, mmY) {
    if (calMode === 'lbracket70' && affine3) {
      const s = (mmX + 35) / 70;
      const t = (mmY + 35) / 70;
      return [
        affine3.origin[0] + s * affine3.vx[0] + t * affine3.vy[0],
        affine3.origin[1] + s * affine3.vx[1] + t * affine3.vy[1],
      ];
    }
    if (H_mmToImg) return applyH(H_mmToImg, mmX, mmY);
    return null;
  }

  function recomputeCalibration() {
    H_imgToMm = null;
    H_mmToImg = null;
    twoPointScale = null;
    affine3 = null;
    const spec = getTargetCalDims();

    if (calMode === 'twopoint' && calPts.length === 2) {
      const pxDist = Math.hypot(calPts[1][0] - calPts[0][0], calPts[1][1] - calPts[0][1]);
      if (pxDist > 1) {
        twoPointScale = {
          origin: calPts[0],
          mmPerPx: spec.w / pxDist,
        };
      }
    } else if (calMode === 'lbracket70' && calPts.length === 3) {
      // Order: calPts[0] = Arm Tip 1 (+Y), calPts[1] = 90-deg Outer Corner (origin), calPts[2] = Arm Tip 2 (+X)
      const [tip1, corner, tip2] = calPts;
      const vx = [tip2[0] - corner[0], tip2[1] - corner[1]];
      const vy = [tip1[0] - corner[0], tip1[1] - corner[1]];
      const det = vx[0] * vy[1] - vx[1] * vy[0];
      if (Math.abs(det) > 10) {
        affine3 = { origin: corner, vx, vy, det };
      }
    } else if (calMode !== 'twopoint' && calMode !== 'lbracket70' && calPts.length === 4) {
      const hw = spec.w / 2;
      const hh = spec.h / 2;
      const mmPts = [
        [-hw, hh],
        [hw, hh],
        [hw, -hh],
        [-hw, -hh],
      ];
      H_imgToMm = computeHomography(calPts, mmPts);
      H_mmToImg = computeHomography(mmPts, calPts);
    }
    updateSidebarUI();
  }

  function fitCircle3Points(p1, p2, p3) {
    const [x1, y1] = p1, [x2, y2] = p2, [x3, y3] = p3;
    const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(d) < 1e-6) return null;
    const s1 = x1 * x1 + y1 * y1;
    const s2 = x2 * x2 + y2 * y2;
    const s3 = x3 * x3 + y3 * y3;
    const cx = (s1 * (y2 - y3) + s2 * (y3 - y1) + s3 * (y1 - y2)) / d;
    const cy = (s1 * (x3 - x2) + s2 * (x1 - x3) + s3 * (x2 - x1)) / d;
    const r = Math.hypot(x1 - cx, y1 - cy);
    return { x: cx, y: cy, diameter: r * 2 };
  }

  function canvasToImg(cx, cy) {
    return [(cx - viewX) / viewScale, (cy - viewY) / viewScale];
  }

  function imgToCanvas(ix, iy) {
    return [ix * viewScale + viewX, iy * viewScale + viewY];
  }

  function fitImage() {
    if (!img) return;
    const rect = wrap.getBoundingClientRect();
    canvas.width = Math.max(300, Math.floor(rect.width));
    canvas.height = Math.max(300, Math.floor(rect.height));
    const sx = (canvas.width - 32) / img.width;
    const sy = (canvas.height - 32) / img.height;
    viewScale = Math.min(sx, sy);
    viewX = (canvas.width - img.width * viewScale) / 2;
    viewY = (canvas.height - img.height * viewScale) / 2;
    drawPhotoCanvas();
  }

  function updateSidebarUI() {
    const spec = getTargetCalDims();
    const badge = document.getElementById('calStatusBadge');
    const banner = document.getElementById('photoPromptBanner');

    if (isCalibrated()) {
      badge.className = 'step-badge ready';
      badge.textContent = calMode === 'twopoint' ? 'Scaled ✓' : 'Perspective ✓';
      const needed = pegTool === '3pt' ? 3 : pegTool === '2pt' ? 2 : 1;
      banner.textContent = `Calibrated! Click peg ${pendingPegPts.length + 1}/${needed} (${pegTool === '3pt' ? 'rim' : pegTool === '2pt' ? 'edge' : 'center'})`;
    } else {
      badge.className = 'step-badge pending';
      badge.textContent = `${calPts.length} / ${spec.pts} pts`;
      if (!img) {
        banner.textContent = "Upload or paste (Ctrl+V) a photo of the figure's feet";
      } else if (calPts.length >= spec.pts) {
        banner.textContent = 'Corners invalid/collinear — drag a corner or Reset Calibration';
      } else if (calMode === 'twopoint') {
        banner.textContent = `Click point ${calPts.length + 1}/2 of your ${spec.w} mm reference`;
      } else if (calMode === 'lbracket70') {
        const lLabels = ['First Arm Tip', 'Outer 90° Corner', 'Second Arm Tip'];
        banner.textContent = `Click ${lLabels[calPts.length]} (${calPts.length + 1}/3)`;
      } else if (calMode === 'puphex') {
        banner.textContent = `Click ${CAL_CORNER_LABELS[calPts.length]} corner of Top/Bottom flat edges (${calPts.length + 1}/4)`;
      } else {
        banner.textContent = `Click ${CAL_CORNER_LABELS[calPts.length]} corner of reference (${calPts.length + 1}/4)`;
      }
    }

    const list = document.getElementById('measuredPegsList');
    const pairInfo = document.getElementById('measuredPairInfo');
    const applyBtn = document.getElementById('btnApplyPhotoPegs');

    if (!measuredPegs.length) {
      list.innerHTML = '<div style="font-size:0.78rem; color:var(--muted);">No pegs measured yet.</div>';
      pairInfo.style.display = 'none';
      applyBtn.disabled = true;
    } else {
      list.innerHTML = '';
      measuredPegs.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'measured-peg-item';
        row.innerHTML = `
          <div style="flex:1;">
            <strong>Peg ${idx + 1}</strong>
            <div style="color:var(--muted); font-size:0.74rem;">(${p.x.toFixed(2)}, ${p.y.toFixed(2)}) mm</div>
          </div>
          <label style="display:flex; align-items:center; gap:4px; font-size:0.74rem; color:var(--muted);">
            Ø
            <input type="number" data-edit-dia="${idx}" step="0.1" min="1" max="15" value="${p.diameter.toFixed(2)}" style="width:58px; padding:3px 5px; font-size:0.78rem;" />
          </label>
          <button data-del-peg="${idx}" style="padding:2px 7px; font-size:0.74rem;">✕</button>
        `;
        list.appendChild(row);
      });
      list.querySelectorAll('[data-edit-dia]').forEach((inp) => {
        inp.oninput = () => {
          const idx = Number(inp.dataset.editDia);
          const val = Number(inp.value);
          if (val > 0) {
            measuredPegs[idx].diameter = val;
            drawPhotoCanvas();
          }
        };
      });
      list.querySelectorAll('[data-del-peg]').forEach((btn) => {
        btn.onclick = () => {
          measuredPegs.splice(Number(btn.dataset.delPeg), 1);
          updateSidebarUI();
          drawPhotoCanvas();
        };
      });

      if (measuredPegs.length >= 2) {
        const lines = [];
        for (let i = 0; i < measuredPegs.length; i++) {
          for (let j = i + 1; j < measuredPegs.length; j++) {
            const d = Math.hypot(measuredPegs[j].x - measuredPegs[i].x, measuredPegs[j].y - measuredPegs[i].y);
            lines.push(`Peg ${i + 1} ↔ Peg ${j + 1}: ${d.toFixed(2)} mm`);
          }
        }
        pairInfo.textContent = lines.join(' | ');
        pairInfo.style.display = '';
      } else {
        pairInfo.style.display = 'none';
      }
      applyBtn.disabled = false;
    }
  }

  function drawPhotoCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!img) return;

    ctx.save();
    ctx.drawImage(img, viewX, viewY, img.width * viewScale, img.height * viewScale);

    // Draw 10mm perspective grid overlay if calibrated
    if (document.getElementById('chkPhotoGrid').checked && (H_mmToImg || affine3)) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1;
      for (let g = -60; g <= 60; g += 10) {
        const [ax, ay] = mmToImgPt(g, -60);
        const [bx, by] = mmToImgPt(g, 60);
        const [cax, cay] = imgToCanvas(ax, ay);
        const [cbx, cby] = imgToCanvas(bx, by);
        ctx.beginPath();
        ctx.moveTo(cax, cay);
        ctx.lineTo(cbx, cby);
        ctx.stroke();

        const [cx0, cy0] = mmToImgPt(-60, g);
        const [dx0, dy0] = mmToImgPt(60, g);
        const [ccx, ccy] = imgToCanvas(cx0, cy0);
        const [cdx, cdy] = imgToCanvas(dx0, dy0);
        ctx.beginPath();
        ctx.moveTo(ccx, ccy);
        ctx.lineTo(cdx, cdy);
        ctx.stroke();
      }
    }

    // Draw calibration polygon / line
    if (calPts.length > 0) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (calMode === 'puphex' && H_mmToImg) {
        const hexPts = PUPMesh.generateOuterPolygon('hexagon', 103.65);
        hexPts.forEach(([hx, hy], i) => {
          const [ix, iy] = mmToImgPt(hx, hy);
          const [cx, cy] = imgToCanvas(ix, iy);
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        });
        ctx.closePath();
      } else {
        calPts.forEach(([ix, iy], i) => {
          const [cx, cy] = imgToCanvas(ix, iy);
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        });
        if (calMode !== 'twopoint' && calMode !== 'lbracket70' && calPts.length === 4) ctx.closePath();
      }
      ctx.stroke();

      calPts.forEach(([ix, iy], i) => {
        const [cx, cy] = imgToCanvas(ix, iy);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f131a';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(String(i + 1), cx - 3, cy + 3.5);
      });
    }

    // Draw pending peg points
    pendingPegPts.forEach(([ix, iy]) => {
      const [cx, cy] = imgToCanvas(ix, iy);
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw measured pegs
    measuredPegs.forEach((p, idx) => {
      const [cx, cy] = imgToCanvas(p.imgX, p.imgY);
      const rPx = Math.max(6, (p.imgR || 8) * viewScale);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      const label = `#${idx + 1} (Ø${p.diameter.toFixed(1)})`;
      ctx.font = 'bold 12px sans-serif';
      const tw = ctx.measureText(label).width;
      const tx = cx + rPx + 6;
      const ty = cy + 4;
      ctx.fillStyle = 'rgba(10, 14, 22, 0.85)';
      ctx.fillRect(tx - 4, ty - 12, tw + 8, 16);
      ctx.fillStyle = '#34d399';
      ctx.fillText(label, tx, ty);
    });

    // Draw 4x Magnifier Loupe in top-right corner when hovering
    if (hoverCanvasPt && !isPanning && !panMode) {
      const [hx, hy] = hoverCanvasPt;
      const [ix, iy] = canvasToImg(hx, hy);
      if (ix >= 0 && iy >= 0 && ix <= img.width && iy <= img.height) {
        const loupeSize = 128;
        const zoom = 4;
        const lx = canvas.width - loupeSize - 12;
        const ly = 12;
        const srcSize = loupeSize / (viewScale * zoom);

        ctx.save();
        ctx.beginPath();
        ctx.rect(lx, ly, loupeSize, loupeSize);
        ctx.clip();
        ctx.fillStyle = '#000';
        ctx.fillRect(lx, ly, loupeSize, loupeSize);
        ctx.drawImage(
          img,
          ix - srcSize / 2, iy - srcSize / 2, srcSize, srcSize,
          lx, ly, loupeSize, loupeSize
        );
        ctx.restore();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(lx, ly, loupeSize, loupeSize);

        // Crosshair in loupe
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx + loupeSize / 2, ly);
        ctx.lineTo(lx + loupeSize / 2, ly + loupeSize);
        ctx.moveTo(lx, ly + loupeSize / 2);
        ctx.lineTo(lx + loupeSize, ly + loupeSize / 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function loadImageFromFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const loaded = new Image();
    loaded.onload = () => {
      img = loaded;
      document.getElementById('photoDropHint').style.display = 'none';
      calPts = [];
      pendingPegPts = [];
      measuredPegs = [];
      recomputeCalibration();
      fitImage();
      URL.revokeObjectURL(url);
    };
    loaded.src = url;
  }

  document.getElementById('btnOpenPhotoMeasurer').onclick = () => {
    const photoClr = document.getElementById('photoHoleClearance');
    if (photoClr) photoClr.value = state.defaults.clearance;
    modal.classList.add('open');
    setTimeout(() => {
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.max(300, Math.floor(rect.width));
      canvas.height = Math.max(300, Math.floor(rect.height));
      if (img) fitImage();
      updateSidebarUI();
    }, 20);
  };
  document.getElementById('photoHoleClearance').oninput = (e) => {
    state.defaults.clearance = Number(e.target.value) || 0;
    document.getElementById('holeClearance').value = state.defaults.clearance;
    saveState();
    rebuildAndDraw();
  };

  document.getElementById('btnClosePhotoModal').onclick = () => modal.classList.remove('open');

  document.getElementById('btnPhotoUpload').onclick = () => document.getElementById('photoFileInput').click();
  document.getElementById('photoFileInput').onchange = (e) => loadImageFromFile(e.target.files[0]);

  wrap.addEventListener('dragover', (e) => e.preventDefault());
  wrap.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) loadImageFromFile(e.dataTransfer.files[0]);
  });

  window.addEventListener('paste', (e) => {
    if (!modal.classList.contains('open')) return;
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        loadImageFromFile(item.getAsFile());
        break;
      }
    }
  });

  document.getElementById('calRefMode').onchange = (e) => {
    calMode = e.target.value;
    document.getElementById('twoPointWrap').style.display = calMode === 'twopoint' ? '' : 'none';
    calPts = [];
    recomputeCalibration();
    drawPhotoCanvas();
  };
  document.getElementById('twoPointMm').oninput = () => {
    recomputeCalibration();
    drawPhotoCanvas();
  };
  document.getElementById('btnCalReset').onclick = () => {
    calPts = [];
    recomputeCalibration();
    drawPhotoCanvas();
  };

  const { autoDetectLBracket, autoDetectHexBase } = window.PUPPhotoDetect;
  const autoDetectCalibrationQuad = (sourceImg) =>
    window.PUPPhotoDetect.autoDetectCalibrationQuad(sourceImg, { calMode, computeHomography, applyH });
  const autoDetectBaseHoles = () =>
    window.PUPPhotoDetect.autoDetectBaseHoles({ img, calMode, H_mmToImg, affine3, mmToImgPt, applyH, H_imgToMm });

  document.getElementById('btnAutoDetectCal').onclick = () => {
    if (!img) {
      alert('Upload or paste a photo first.');
      return;
    }
    if (calMode === 'twopoint') {
      alert('Auto-Detect works with 4-corner references or the 70mm L-Bracket.');
      return;
    }
    const detected = calMode === 'lbracket70'
      ? autoDetectLBracket(img)
      : calMode === 'puphex'
        ? autoDetectHexBase(img)
        : autoDetectCalibrationQuad(img);
    if (!detected) {
      alert('Could not auto-detect clear corners. Try higher contrast with the desk, or tap the corners manually.');
      return;
    }
    calPts = detected;
    recomputeCalibration();
    drawPhotoCanvas();
  };


  document.getElementById('btnAutoDetectHoles').onclick = () => {
    if (!img || (!H_mmToImg && !affine3)) {
      alert('Calibrate the reference corners first.');
      return;
    }
    const found = autoDetectBaseHoles();
    if (!found.length) {
      alert('No clear holes detected inside the frame. Try tapping them with 1-Pt Center.');
      return;
    }
    measuredPegs = found;
    pendingPegPts = [];
    updateSidebarUI();
    drawPhotoCanvas();
  };
  document.getElementById('chkPhotoGrid').onchange = () => drawPhotoCanvas();

  function setPegTool(tool) {
    pegTool = tool;
    pendingPegPts = [];
    document.getElementById('toolPeg3Pt').className = tool === '3pt' ? 'active' : '';
    document.getElementById('toolPeg2Pt').className = tool === '2pt' ? 'active' : '';
    document.getElementById('toolPeg1Pt').className = tool === '1pt' ? 'active' : '';
    document.getElementById('onePtDiaWrap').style.display = tool === '1pt' ? '' : 'none';
    document.getElementById('pegToolHint').textContent =
      tool === '3pt' ? 'Click 3 pts on peg rim' : tool === '2pt' ? 'Click 2 opposite edges' : 'Click peg center';
    updateSidebarUI();
    drawPhotoCanvas();
  }
  document.getElementById('toolPeg3Pt').onclick = () => setPegTool('3pt');
  document.getElementById('toolPeg2Pt').onclick = () => setPegTool('2pt');
  document.getElementById('toolPeg1Pt').onclick = () => setPegTool('1pt');

  document.getElementById('btnClearPhotoPegs').onclick = () => {
    pendingPegPts = [];
    measuredPegs = [];
    updateSidebarUI();
    drawPhotoCanvas();
  };

  document.getElementById('btnPhotoZoomIn').onclick = () => {
    viewScale *= 1.25;
    drawPhotoCanvas();
  };
  document.getElementById('btnPhotoZoomOut').onclick = () => {
    viewScale /= 1.25;
    drawPhotoCanvas();
  };
  document.getElementById('btnPhotoZoomFit').onclick = () => fitImage();
  document.getElementById('btnPhotoPanToggle').onclick = (e) => {
    panMode = !panMode;
    e.target.classList.toggle('active', panMode);
    wrap.classList.toggle('panning', panMode);
  };

  canvas.addEventListener('wheel', (e) => {
    if (!img) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.max(0.1, Math.min(20, viewScale * factor));
    viewX = mx - (mx - viewX) * (newScale / viewScale);
    viewY = my - (my - viewY) * (newScale / viewScale);
    viewScale = newScale;
    drawPhotoCanvas();
  }, { passive: false });

  function placePhotoPoint(ix, iy) {
    const spec = getTargetCalDims();
    if (!isCalibrated() && calPts.length < spec.pts) {
      calPts.push([ix, iy]);
      recomputeCalibration();
      drawPhotoCanvas();
      return;
    }

    if (isCalibrated()) {
      pendingPegPts.push([ix, iy]);
      const needed = pegTool === '3pt' ? 3 : pegTool === '2pt' ? 2 : 1;
      if (pendingPegPts.length === needed) {
        const mmPts = pendingPegPts.map(([px, py]) => imgToMm(px, py));
        if (pegTool === '3pt') {
          const res = fitCircle3Points(mmPts[0], mmPts[1], mmPts[2]);
          const imgFit = fitCircle3Points(pendingPegPts[0], pendingPegPts[1], pendingPegPts[2]);
          if (res) {
            measuredPegs.push({
              x: res.x, y: res.y, diameter: res.diameter,
              imgX: imgFit ? imgFit.x : pendingPegPts[0][0],
              imgY: imgFit ? imgFit.y : pendingPegPts[0][1],
              imgR: imgFit ? imgFit.diameter / 2 : 10,
            });
          }
        } else if (pegTool === '2pt') {
          const cx = (mmPts[0][0] + mmPts[1][0]) / 2;
          const cy = (mmPts[0][1] + mmPts[1][1]) / 2;
          const dia = Math.hypot(mmPts[1][0] - mmPts[0][0], mmPts[1][1] - mmPts[0][1]);
          measuredPegs.push({
            x: cx, y: cy, diameter: dia,
            imgX: (pendingPegPts[0][0] + pendingPegPts[1][0]) / 2,
            imgY: (pendingPegPts[0][1] + pendingPegPts[1][1]) / 2,
            imgR: Math.hypot(pendingPegPts[1][0] - pendingPegPts[0][0], pendingPegPts[1][1] - pendingPegPts[0][1]) / 2,
          });
        } else {
          const dia = Number(document.getElementById('onePtDiameter').value) || 4.0;
          measuredPegs.push({
            x: mmPts[0][0], y: mmPts[0][1], diameter: dia,
            imgX: pendingPegPts[0][0], imgY: pendingPegPts[0][1], imgR: 10,
          });
        }
        pendingPegPts = [];
      }
      updateSidebarUI();
      drawPhotoCanvas();
    }
  }

  function findHitCalCorner(mx, my, hitRadius) {
    let bestIdx = -1;
    let bestDist = hitRadius;
    for (let i = 0; i < calPts.length; i++) {
      const [cx, cy] = imgToCanvas(calPts[i][0], calPts[i][1]);
      const d = Math.hypot(mx - cx, my - cy);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function findHitMeasuredPeg(mx, my, hitRadius) {
    let bestIdx = -1;
    let bestDist = hitRadius;
    for (let i = 0; i < measuredPegs.length; i++) {
      const [cx, cy] = imgToCanvas(measuredPegs[i].imgX, measuredPegs[i].imgY);
      const d = Math.hypot(mx - cx, my - cy);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function updateDraggedPeg(idx, mx, my) {
    const [ix, iy] = canvasToImg(mx, my);
    const mm = imgToMm(ix, iy);
    measuredPegs[idx].imgX = ix;
    measuredPegs[idx].imgY = iy;
    if (mm) {
      measuredPegs[idx].x = mm[0];
      measuredPegs[idx].y = mm[1];
    }
  }

  // Desktop mouse handlers
  canvas.addEventListener('mousedown', (e) => {
    if (!img) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (panMode || e.button === 1 || e.button === 2 || e.shiftKey) {
      isPanning = true;
      panStartX = mx - viewX;
      panStartY = my - viewY;
      return;
    }

    const hitIdx = findHitCalCorner(mx, my, 12);
    if (hitIdx >= 0) {
      dragCalIdx = hitIdx;
      return;
    }

    const hitPeg = findHitMeasuredPeg(mx, my, 14);
    if (hitPeg >= 0) {
      dragPegIdx = hitPeg;
      return;
    }

    const [ix, iy] = canvasToImg(mx, my);
    placePhotoPoint(ix, iy);
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('mousemove', (e) => {
    if (!modal.classList.contains('open') || !img) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    hoverCanvasPt = [mx, my];

    if (isPanning) {
      viewX = mx - panStartX;
      viewY = my - panStartY;
    } else if (dragCalIdx >= 0) {
      calPts[dragCalIdx] = canvasToImg(mx, my);
      recomputeCalibration();
    } else if (dragPegIdx >= 0) {
      updateDraggedPeg(dragPegIdx, mx, my);
    }
    drawPhotoCanvas();
  });

  window.addEventListener('mouseup', () => {
    if (dragPegIdx >= 0) updateSidebarUI();
    isPanning = false;
    dragCalIdx = -1;
    dragPegIdx = -1;
  });

  // Mobile touch handlers (pinch-to-zoom, 2-finger pan, drag corners, slide-aim with 4x loupe)
  let touchMode = null; // 'aim' | 'dragCal' | 'pan' | 'pinch'
  let lastTouchPt = null;
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let pinchLastMid = null;

  function touchPos(t) {
    const rect = canvas.getBoundingClientRect();
    return [t.clientX - rect.left, t.clientY - rect.top];
  }

  canvas.addEventListener('touchstart', (e) => {
    if (!img) return;
    e.preventDefault();

    if (e.touches.length >= 2) {
      touchMode = 'pinch';
      dragCalIdx = -1;
      isPanning = false;
      hoverCanvasPt = null;
      const p0 = touchPos(e.touches[0]);
      const p1 = touchPos(e.touches[1]);
      pinchStartDist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      pinchStartScale = viewScale;
      pinchLastMid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      drawPhotoCanvas();
      return;
    }

    const [mx, my] = touchPos(e.touches[0]);
    lastTouchPt = [mx, my];

    if (panMode) {
      touchMode = 'pan';
      isPanning = true;
      panStartX = mx - viewX;
      panStartY = my - viewY;
      hoverCanvasPt = null;
      drawPhotoCanvas();
      return;
    }

    const hitIdx = findHitCalCorner(mx, my, 28);
    if (hitIdx >= 0) {
      touchMode = 'dragCal';
      dragCalIdx = hitIdx;
      hoverCanvasPt = [mx, my];
      drawPhotoCanvas();
      return;
    }

    const hitPeg = findHitMeasuredPeg(mx, my, 28);
    if (hitPeg >= 0) {
      touchMode = 'dragPeg';
      dragPegIdx = hitPeg;
      hoverCanvasPt = [mx, my];
      drawPhotoCanvas();
      return;
    }

    touchMode = 'aim';
    hoverCanvasPt = [mx, my];
    drawPhotoCanvas();
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!img) return;
    e.preventDefault();

    if (e.touches.length >= 2) {
      const p0 = touchPos(e.touches[0]);
      const p1 = touchPos(e.touches[1]);
      const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      if (touchMode !== 'pinch' || !pinchLastMid) {
        touchMode = 'pinch';
        pinchStartDist = dist;
        pinchStartScale = viewScale;
        pinchLastMid = mid;
      }
      const newScale = Math.max(0.1, Math.min(20, pinchStartScale * (dist / pinchStartDist)));
      viewX = mid[0] - (pinchLastMid[0] - viewX) * (newScale / viewScale);
      viewY = mid[1] - (pinchLastMid[1] - viewY) * (newScale / viewScale);
      viewScale = newScale;
      pinchLastMid = mid;
      hoverCanvasPt = null;
      drawPhotoCanvas();
      return;
    }

    if (e.touches.length === 1 && touchMode !== 'pinch') {
      const [mx, my] = touchPos(e.touches[0]);
      lastTouchPt = [mx, my];

      if (touchMode === 'pan') {
        viewX = mx - panStartX;
        viewY = my - panStartY;
      } else if (touchMode === 'dragCal' && dragCalIdx >= 0) {
        hoverCanvasPt = [mx, my];
        calPts[dragCalIdx] = canvasToImg(mx, my);
        recomputeCalibration();
      } else if (touchMode === 'dragPeg' && dragPegIdx >= 0) {
        hoverCanvasPt = [mx, my];
        updateDraggedPeg(dragPegIdx, mx, my);
      } else if (touchMode === 'aim') {
        hoverCanvasPt = [mx, my];
      }
      drawPhotoCanvas();
    }
  }, { passive: false });

  function endTouch(e) {
    if (!img) return;
    e.preventDefault();

    if (e.touches.length === 0) {
      if (touchMode === 'aim' && lastTouchPt && e.type === 'touchend') {
        const [ix, iy] = canvasToImg(lastTouchPt[0], lastTouchPt[1]);
        touchMode = null;
        hoverCanvasPt = null;
        lastTouchPt = null;
        placePhotoPoint(ix, iy);
        return;
      }
      if (touchMode === 'dragPeg') updateSidebarUI();
      touchMode = null;
      isPanning = false;
      dragCalIdx = -1;
      dragPegIdx = -1;
      hoverCanvasPt = null;
      lastTouchPt = null;
      pinchLastMid = null;
      drawPhotoCanvas();
    }
  }

  canvas.addEventListener('touchend', endTouch, { passive: false });
  canvas.addEventListener('touchcancel', endTouch, { passive: false });

  document.getElementById('btnApplyPhotoPegs').onclick = () => {
    if (!measuredPegs.length) return;
    const fig = getActiveFigure();
    const autoCenter = document.getElementById('chkAutoCenterPegs').checked;
    const mirrorX = document.getElementById('chkMirrorSoleX').checked;

    let cx = 0, cy = 0;
    if (autoCenter) {
      cx = measuredPegs.reduce((s, p) => s + p.x, 0) / measuredPegs.length;
      cy = measuredPegs.reduce((s, p) => s + p.y, 0) / measuredPegs.length;
    }

    const rawMapped = measuredPegs.map((p, idx) => {
      const existing = fig.pegs[idx];
      const px = (p.x - cx) * (mirrorX ? -1 : 1);
      const py = p.y - cy;
      return {
        label: existing?.label || `Peg ${idx + 1}`,
        x: Number(px.toFixed(2)),
        y: Number(py.toFixed(2)),
        diameter: Number(Math.max(1.0, p.diameter).toFixed(2)),
        depth: existing?.depth ?? 10.0,
        shape: existing?.shape || 'hexagon',
        flatAngle: existing?.flatAngle || 0,
        through: existing?.through || false,
        enabled: true,
      };
    });

    const facing = document.getElementById('photoFacing')?.value || 'down';
    relabelPegsByFacing(rawMapped, facing);

    const mapped = rawMapped;

    fig.pegs = mapped;
    fig.facing = facing;
    fig.measured = true;
    if (mapped.length === 2) {
      fig.mode = 'distance';
      const dx = mapped[1].x - mapped[0].x;
      const dy = mapped[1].y - mapped[0].y;
      fig.pegDistance = Number(Math.hypot(dx, dy).toFixed(2));
      fig.stanceAngle = Number(((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1));
      fig.centerOffsetX = 0;
      fig.centerOffsetY = 0;
    } else {
      fig.mode = 'manual';
    }
    if (autoCenter) fitPegGroupInsideBase(fig);

    saveState();
    renderAll();
    modal.classList.remove('open');
  };
})();
