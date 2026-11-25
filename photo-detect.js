/**
 * POP UP PARADE — Photo Auto-Detection (Computer Vision)
 * Pure-JS corner & hole detectors for 70mm Calibration Frame, L-Bracket, PUP Hex Base, and Base Holes.
 */

window.PUPPhotoDetect = (function () {
  'use strict';

  // Pure-JS Auto-Detect for 4-corner Calibration Frame / Card
  function autoDetectCalibrationQuad(sourceImg, { calMode, computeHomography, applyH } = {}) {
    const maxDim = 480;
    const scale = Math.min(1, maxDim / Math.max(sourceImg.width, sourceImg.height));
    const w = Math.max(32, Math.round(sourceImg.width * scale));
    const h = Math.max(32, Math.round(sourceImg.height * scale));
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(sourceImg, 0, 0, w, h);
    const data = octx.getImageData(0, 0, w, h).data;

    const gray = new Float32Array(w * h);
    const hist = new Int32Array(256);
    for (let i = 0; i < w * h; i++) {
      const g = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      gray[i] = g;
      hist[Math.min(255, Math.max(0, Math.round(g)))]++;
    }

    // Otsu threshold
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, maxVar = -1, otsuT = 128;
    const total = w * h;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) { maxVar = between; otsuT = t; }
    }

    // Sobel gradient magnitude for edge validation
    const grad = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const gx = -gray[idx - w - 1] + gray[idx - w + 1] - 2 * gray[idx - 1] + 2 * gray[idx + 1] - gray[idx + w - 1] + gray[idx + w + 1];
        const gy = -gray[idx - w - 1] - 2 * gray[idx - w] - gray[idx - w + 1] + gray[idx + w - 1] + 2 * gray[idx + w] + gray[idx + w + 1];
        grad[idx] = Math.hypot(gx, gy);
      }
    }

    function convexHull(pts) {
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lower = [];
      for (const p of pts) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
      }
      const upper = [];
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
      }
      upper.pop();
      lower.pop();
      return lower.concat(upper);
    }

    function simplifyToQuad(poly) {
      if (poly.length <= 4) return poly;
      const pts = poly.slice();
      while (pts.length > 4) {
        let minArea = Infinity;
        let minIdx = 0;
        const n = pts.length;
        for (let i = 0; i < n; i++) {
          const a = pts[(i - 1 + n) % n];
          const b = pts[i];
          const c = pts[(i + 1) % n];
          const area = Math.abs((a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])) * 0.5);
          if (area < minArea) { minArea = area; minIdx = i; }
        }
        pts.splice(minIdx, 1);
      }
      return pts;
    }

    function polyArea(pts) {
      let a = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        a += p[0] * q[1] - q[0] * p[1];
      }
      return Math.abs(a) * 0.5;
    }

    function edgeGradientScore(quad) {
      let totalScore = 0;
      const samples = 24;
      for (let e = 0; e < 4; e++) {
        const a = quad[e], b = quad[(e + 1) % 4];
        for (let s = 1; s < samples; s++) {
          const t = s / samples;
          const x = Math.round(a[0] + (b[0] - a[0]) * t);
          const y = Math.round(a[1] + (b[1] - a[1]) * t);
          let best = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                best = Math.max(best, grad[ny * w + nx]);
              }
            }
          }
          totalScore += best;
        }
      }
      return totalScore / (4 * (samples - 1));
    }

    let bestQuad = null;
    let bestBoundary = null;
    let bestScore = -1;
    const minCompArea = total * 0.015;
    const maxCompArea = total * 0.78;
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);

    // Sweep dark & bright thresholds (handles 3-tone scenes like black frame + tan cardboard + white base)
    const passes = [
      { thresh: 55, invert: true },
      { thresh: 75, invert: true },
      { thresh: 105, invert: true },
      { thresh: otsuT, invert: true },
      { thresh: otsuT, invert: false },
      { thresh: 155, invert: false },
      { thresh: 185, invert: false },
    ];

    for (const { thresh: T, invert } of passes) {
      visited.fill(0);
      for (let start = 0; start < total; start++) {
        if (visited[start]) continue;
        const isFg = invert ? gray[start] < T : gray[start] > T;
        if (!isFg) continue;

        let qh = 0, qt = 0;
        queue[qt++] = start;
        visited[start] = 1;
        const boundary = [];
        let count = 0;
        let borderEdges = 0;
        let hitL = false, hitR = false, hitT = false, hitB = false;

        while (qh < qt) {
          const idx = queue[qh++];
          count++;
          const x = idx % w;
          const y = (idx / w) | 0;
          if (x === 0) hitL = true;
          if (x === w - 1) hitR = true;
          if (y === 0) hitT = true;
          if (y === h - 1) hitB = true;

          let isBoundary = false;
          const nbrs = [idx - 1, idx + 1, idx - w, idx + w];
          for (let ni = 0; ni < 4; ni++) {
            const nIdx = nbrs[ni];
            if (ni === 0 && x === 0) { isBoundary = true; continue; }
            if (ni === 1 && x === w - 1) { isBoundary = true; continue; }
            if (ni === 2 && y === 0) { isBoundary = true; continue; }
            if (ni === 3 && y === h - 1) { isBoundary = true; continue; }
            const nFg = invert ? gray[nIdx] < T : gray[nIdx] > T;
            if (!nFg) {
              isBoundary = true;
            } else if (!visited[nIdx]) {
              visited[nIdx] = 1;
              queue[qt++] = nIdx;
            }
          }
          if (isBoundary) boundary.push([x, y]);
        }

        borderEdges = (hitL ? 1 : 0) + (hitR ? 1 : 0) + (hitT ? 1 : 0) + (hitB ? 1 : 0);
        if (borderEdges >= 2 || count < minCompArea || count > maxCompArea || boundary.length < 20) continue;

        const hull = convexHull(boundary);
        let quad = simplifyToQuad(hull);
        if (quad.length !== 4) continue;

        const qArea = polyArea(quad);
        if (qArea < minCompArea || qArea > maxCompArea) continue;

        // Check interior angles (reject skinny/degenerate quads) and squareness for frame70
        let anglesOk = true;
        let minSide = Infinity, maxSide = 0;
        for (let i = 0; i < 4; i++) {
          const p0 = quad[(i + 3) % 4], p1 = quad[i], p2 = quad[(i + 1) % 4];
          const v1x = p0[0] - p1[0], v1y = p0[1] - p1[1];
          const v2x = p2[0] - p1[0], v2y = p2[1] - p1[1];
          const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
          if (l1 < 12 || l2 < 12) { anglesOk = false; break; }
          minSide = Math.min(minSide, l1);
          maxSide = Math.max(maxSide, l1);
          const cosA = (v1x * v2x + v1y * v2y) / (l1 * l2);
          if (cosA > 0.72 || cosA < -0.72) { anglesOk = false; break; }
        }
        if (!anglesOk) continue;
        if (calMode === 'frame70' && minSide / (maxSide || 1) < 0.62) continue;

        const fillRatio = count / qArea;
        let scoreBonus = 1.0;
        let isExpandedWindow = false;

        // If in frame70 mode and we found the inner 54x54mm window (either dark-in-white OR white-in-black),
        // project its 4 corners outward from +-27mm to the +-35mm outer frame corners!
        if (calMode === 'frame70' && fillRatio > 0.68) {
          const cxQ = quad.reduce((s, p) => s + p[0], 0) / 4;
          const cyQ = quad.reduce((s, p) => s + p[1], 0) / 4;
          const qTL = quad.reduce((b, p) => ((p[0] - cxQ) + (p[1] - cyQ) < (b[0] - cxQ) + (b[1] - cyQ) ? p : b));
          const qBR = quad.reduce((b, p) => ((p[0] - cxQ) + (p[1] - cyQ) > (b[0] - cxQ) + (b[1] - cyQ) ? p : b));
          const qTR = quad.reduce((b, p) => ((p[0] - cxQ) - (p[1] - cyQ) > (b[0] - cxQ) - (b[1] - cyQ) ? p : b));
          const qBL = quad.reduce((b, p) => ((p[0] - cxQ) - (p[1] - cyQ) < (b[0] - cxQ) - (b[1] - cyQ) ? p : b));
          const H_win = computeHomography([[-27, 27], [27, 27], [27, -27], [-27, -27]], [qTL, qTR, qBR, qBL]);
          if (H_win) {
            const rimPts = [[0, 31], [31, 0], [0, -31], [-31, 0]].map(([rx, ry]) => applyH(H_win, rx, ry));
            let rimMatch = 0;
            for (const [rx, ry] of rimPts) {
              const ix = Math.round(rx), iy = Math.round(ry);
              if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
                const rimMatchesPolarity = invert ? (gray[iy * w + ix] > T) : (gray[iy * w + ix] < T);
                if (rimMatchesPolarity) rimMatch++;
              }
            }
            if (rimMatch >= 3) {
              quad = [[-35, 35], [35, 35], [35, -35], [-35, -35]].map(([ox, oy]) => applyH(H_win, ox, oy));
              scoreBonus = 2.0;
              isExpandedWindow = true;
            }
          }
        }

        // Frame70 has ~40.5% rim fill; Card or expanded inner window has ~96% fill
        const expectedFill = (calMode === 'frame70' && !isExpandedWindow) ? 0.41 : 0.96;
        const fillDiff = Math.abs(fillRatio - expectedFill);
        if (calMode === 'frame70' && !isExpandedWindow && fillDiff > 0.22) continue;
        const fillPenalty = Math.max(0.1, 1 - fillDiff * 2.2);
        const gScore = edgeGradientScore(quad);
        const borderPenalty = borderEdges > 0 ? 0.05 : 1.0;
        const score = gScore * fillPenalty * Math.pow(qArea, 0.25) * scoreBonus * borderPenalty;

        if (score > bestScore) {
          bestScore = score;
          bestQuad = quad;
          bestBoundary = isExpandedWindow ? null : boundary;
        }
      }
    }

    if (!bestQuad) return null;

    // Order corners: Top-Left, Top-Right, Bottom-Right, Bottom-Left
    const cx = bestQuad.reduce((s, p) => s + p[0], 0) / 4;
    const cy = bestQuad.reduce((s, p) => s + p[1], 0) / 4;
    const tl = bestQuad.reduce((b, p) => ((p[0] - cx) + (p[1] - cy) < (b[0] - cx) + (b[1] - cy) ? p : b));
    const br = bestQuad.reduce((b, p) => ((p[0] - cx) + (p[1] - cy) > (b[0] - cx) + (b[1] - cy) ? p : b));
    const tr = bestQuad.reduce((b, p) => ((p[0] - cx) - (p[1] - cy) > (b[0] - cx) - (b[1] - cy) ? p : b));
    const bl = bestQuad.reduce((b, p) => ((p[0] - cx) - (p[1] - cy) < (b[0] - cx) - (b[1] - cy) ? p : b));
    let ordered = [tl, tr, br, bl];

    // Refine corners by fitting straight lines to the middle 70% of each edge & intersecting them
    if (bestBoundary && bestBoundary.length > 40) {
      const fitLine = (pts) => {
        const n = pts.length;
        if (n < 5) return null;
        let mx = 0, my = 0;
        for (const [x, y] of pts) { mx += x; my += y; }
        mx /= n; my /= n;
        let sxx = 0, syy = 0, sxy = 0;
        for (const [x, y] of pts) {
          const dx = x - mx, dy = y - my;
          sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
        }
        const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
        const nx = -Math.sin(theta), ny = Math.cos(theta);
        return { nx, ny, c: nx * mx + ny * my };
      };
      const intersectLines = (L1, L2) => {
        if (!L1 || !L2) return null;
        const det = L1.nx * L2.ny - L1.ny * L2.nx;
        if (Math.abs(det) < 1e-6) return null;
        return [(L1.c * L2.ny - L1.ny * L2.c) / det, (L1.nx * L2.c - L1.c * L2.nx) / det];
      };
      const edgeLines = [];
      for (let e = 0; e < 4; e++) {
        const a = ordered[e], b = ordered[(e + 1) % 4];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const len = Math.hypot(ex, ey) || 1;
        const ux = ex / len, uy = ey / len;
        const ptsOnEdge = [];
        for (const p of bestBoundary) {
          const dx = p[0] - a[0], dy = p[1] - a[1];
          const along = (dx * ux + dy * uy) / len;
          const perp = Math.abs(dx * -uy + dy * ux);
          if (along > 0.15 && along < 0.85 && perp < 4.5) ptsOnEdge.push(p);
        }
        edgeLines.push(fitLine(ptsOnEdge));
      }
      const refined = [
        intersectLines(edgeLines[3], edgeLines[0]),
        intersectLines(edgeLines[0], edgeLines[1]),
        intersectLines(edgeLines[1], edgeLines[2]),
        intersectLines(edgeLines[2], edgeLines[3]),
      ];
      if (refined.every((p) => p && Math.hypot(p[0] - cx, p[1] - cy) < Math.max(w, h))) {
        ordered = refined;
      }
    }

    ordered = ordered.map(([x, y]) => [x / scale, y / scale]);
    // Ensure 4 distinct points
    const unique = new Set(ordered.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`));
    return unique.size === 4 ? ordered : null;
  }

  // Pure-JS Auto-Detect for 3-corner 70x70mm L-Bracket
  function autoDetectLBracket(sourceImg) {
    const maxDim = 480;
    const scale = Math.min(1, maxDim / Math.max(sourceImg.width, sourceImg.height));
    const w = Math.max(32, Math.round(sourceImg.width * scale));
    const h = Math.max(32, Math.round(sourceImg.height * scale));
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(sourceImg, 0, 0, w, h);
    const data = octx.getImageData(0, 0, w, h).data;

    const gray = new Float32Array(w * h);
    const hist = new Int32Array(256);
    for (let i = 0; i < w * h; i++) {
      const g = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      gray[i] = g;
      hist[Math.min(255, Math.max(0, Math.round(g)))]++;
    }

    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, maxVar = -1, otsuT = 128;
    const total = w * h;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) { maxVar = between; otsuT = t; }
    }

    const convexHull = (pts) => {
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lower = [], upper = [];
      for (const p of pts) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
      }
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
      }
      upper.pop(); lower.pop();
      return lower.concat(upper);
    };

    const simplifyTo3 = (poly) => {
      const pts = poly.slice();
      while (pts.length > 3) {
        let minArea = Infinity, minIdx = 0, n = pts.length;
        for (let i = 0; i < n; i++) {
          const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
          const area = Math.abs((a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])) * 0.5);
          if (area < minArea) { minArea = area; minIdx = i; }
        }
        pts.splice(minIdx, 1);
      }
      return pts;
    };

    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    const minCompArea = total * 0.01;
    const maxCompArea = total * 0.45;
    let bestTri = null, bestScore = -1;

    for (const { thresh: T, invert } of [{ thresh: 55, invert: true }, { thresh: 75, invert: true }, { thresh: 95, invert: true }, { thresh: otsuT, invert: true }, { thresh: otsuT, invert: false }, { thresh: 185, invert: false }]) {
      visited.fill(0);
      for (let start = 0; start < total; start++) {
        if (visited[start]) continue;
        if (!(invert ? gray[start] < T : gray[start] > T)) continue;
        let qh = 0, qt = 0;
        queue[qt++] = start;
        visited[start] = 1;
        const boundary = [];
        let count = 0;
        let hitL = false, hitR = false, hitT = false, hitB = false;

        while (qh < qt) {
          const idx = queue[qh++];
          count++;
          const x = idx % w, y = (idx / w) | 0;
          if (x === 0) hitL = true; if (x === w - 1) hitR = true;
          if (y === 0) hitT = true; if (y === h - 1) hitB = true;
          let isB = false;
          const nbrs = [idx - 1, idx + 1, idx - w, idx + w];
          for (let ni = 0; ni < 4; ni++) {
            if ((ni === 0 && x === 0) || (ni === 1 && x === w - 1) || (ni === 2 && y === 0) || (ni === 3 && y === h - 1)) { isB = true; continue; }
            const nIdx = nbrs[ni];
            if (!(invert ? gray[nIdx] < T : gray[nIdx] > T)) isB = true;
            else if (!visited[nIdx]) { visited[nIdx] = 1; queue[qt++] = nIdx; }
          }
          if (isB) boundary.push([x, y]);
        }

        if ((hitL + hitR + hitT + hitB) >= 2 || count < minCompArea || count > maxCompArea || boundary.length < 20) continue;
        const tri = simplifyTo3(convexHull(boundary));
        if (tri.length !== 3) continue;

        const triArea = Math.abs((tri[0][0] * (tri[1][1] - tri[2][1]) + tri[1][0] * (tri[2][1] - tri[0][1]) + tri[2][0] * (tri[0][1] - tri[1][1])) * 0.5);
        if (triArea < minCompArea) continue;

        // For a 70x70mm L-bracket (10mm arms), area / triArea is ~0.53 (1300 / 2450)
        const fillRatio = count / triArea;
        if (fillRatio < 0.30 || fillRatio > 0.68) continue;

        // Find the ~90-deg outer corner
        let rightIdx = -1, bestCos = 1;
        for (let i = 0; i < 3; i++) {
          const p0 = tri[i], p1 = tri[(i + 1) % 3], p2 = tri[(i + 2) % 3];
          const v1x = p1[0] - p0[0], v1y = p1[1] - p0[1];
          const v2x = p2[0] - p0[0], v2y = p2[1] - p0[1];
          const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
          if (l1 < 20 || l2 < 20) continue;
          const lenRatio = Math.min(l1, l2) / Math.max(l1, l2);
          const cosA = Math.abs((v1x * v2x + v1y * v2y) / (l1 * l2));
          if (cosA < 0.38 && lenRatio > 0.65 && cosA < bestCos) {
            bestCos = cosA;
            rightIdx = i;
          }
        }
        if (rightIdx < 0) continue;

        const fillScore = 1 - Math.abs(fillRatio - 0.53);
        const score = fillScore * (1 - bestCos) * Math.sqrt(triArea);
        if (score > bestScore) {
          bestScore = score;
          let corner = tri[rightIdx];
          let tip1 = tri[(rightIdx + 1) % 3];
          let tip2 = tri[(rightIdx + 2) % 3];
          // Ensure tip2 (+X) x tip1 (+Y) < 0 in screen coords (so 1=Up/Tip1, 2=Corner, 3=Right/Tip2)
          const cross = (tip2[0] - corner[0]) * (tip1[1] - corner[1]) - (tip2[1] - corner[1]) * (tip1[0] - corner[0]);
          if (cross > 0) [tip1, tip2] = [tip2, tip1];

          // Snap corner, tip1, tip2 onto the outermost boundary along each arm (avoids inner 10mm notch)
          const snapOuterArm = (c, t) => {
            const dx = t[0] - c[0], dy = t[1] - c[1];
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len, uy = dy / len;
            // Outward normal pointing away from the other arm
            let nx = -uy, ny = ux;
            const midOther = [(tip1[0] + tip2[0]) * 0.5 - c[0], (tip1[1] + tip2[1]) * 0.5 - c[1]];
            if (midOther[0] * nx + midOther[1] * ny > 0) { nx = -nx; ny = -ny; }
            let maxProj = -Infinity, bestTip = t;
            for (const p of boundary) {
              const px = p[0] - c[0], py = p[1] - c[1];
              const along = px * ux + py * uy;
              const out = px * nx + py * ny;
              if (along > len * 0.6 && out > -3.5 && along + out * 0.5 > maxProj) {
                maxProj = along + out * 0.5;
                bestTip = p;
              }
            }
            return bestTip;
          };
          tip1 = snapOuterArm(corner, tip1);
          tip2 = snapOuterArm(corner, tip2);

          // Refine outer 90-deg corner by fitting straight lines to the two outer arm edges & intersecting
          const fitOuterEdge = (c, t, otherTip) => {
            const dx = t[0] - c[0], dy = t[1] - c[1];
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len, uy = dy / len;
            let nx = -uy, ny = ux;
            const midO = [otherTip[0] - c[0], otherTip[1] - c[1]];
            if (midO[0] * nx + midO[1] * ny > 0) { nx = -nx; ny = -ny; }
            const pts = [];
            for (const p of boundary) {
              const px = p[0] - c[0], py = p[1] - c[1];
              const along = (px * ux + py * uy) / len;
              const out = px * nx + py * ny;
              if (along > 0.15 && along < 0.85 && out > -3.5 && out < 5.5) pts.push(p);
            }
            if (pts.length < 6) return null;
            let mx = 0, my = 0;
            for (const [x, y] of pts) { mx += x; my += y; }
            mx /= pts.length; my /= pts.length;
            let sxx = 0, syy = 0, sxy = 0;
            for (const [x, y] of pts) {
              const ex = x - mx, ey = y - my;
              sxx += ex * ex; syy += ey * ey; sxy += ex * ey;
            }
            const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
            const lnx = -Math.sin(theta), lny = Math.cos(theta);
            return { nx: lnx, ny: lny, c: lnx * mx + lny * my };
          };
          const L1 = fitOuterEdge(corner, tip1, tip2);
          const L2 = fitOuterEdge(corner, tip2, tip1);
          if (L1 && L2) {
            const detL = L1.nx * L2.ny - L1.ny * L2.nx;
            if (Math.abs(detL) > 1e-6) {
              const ix = (L1.c * L2.ny - L1.ny * L2.c) / detL;
              const iy = (L1.nx * L2.c - L1.c * L2.nx) / detL;
              if (Math.hypot(ix - corner[0], iy - corner[1]) < 15) corner = [ix, iy];
            }
          }
          bestTri = [tip1, corner, tip2];
        }
      }
    }
    return bestTri ? bestTri.map(([x, y]) => [x / scale, y / scale]) : null;
  }

  // Pure-JS Auto-Detect for Standard 103.65mm PUP Hexagon Base (returns 4 top/bottom flat-edge corners)
  function autoDetectHexBase(sourceImg) {
    const maxDim = 480;
    const scale = Math.min(1, maxDim / Math.max(sourceImg.width, sourceImg.height));
    const w = Math.max(32, Math.round(sourceImg.width * scale));
    const h = Math.max(32, Math.round(sourceImg.height * scale));
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(sourceImg, 0, 0, w, h);
    const data = octx.getImageData(0, 0, w, h).data;

    const gray = new Float32Array(w * h);
    const hist = new Int32Array(256);
    for (let i = 0; i < w * h; i++) {
      const g = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      gray[i] = g;
      hist[Math.min(255, Math.max(0, Math.round(g)))]++;
    }

    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, maxVar = -1, otsuT = 128;
    const total = w * h;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) { maxVar = between; otsuT = t; }
    }

    const grad = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const gx = -gray[idx - w - 1] + gray[idx - w + 1] - 2 * gray[idx - 1] + 2 * gray[idx + 1] - gray[idx + w - 1] + gray[idx + w + 1];
        const gy = -gray[idx - w - 1] - 2 * gray[idx - w] - gray[idx - w + 1] + gray[idx + w - 1] + 2 * gray[idx + w] + gray[idx + w + 1];
        grad[idx] = Math.hypot(gx, gy);
      }
    }

    const convexHull = (pts) => {
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lower = [], upper = [];
      for (const p of pts) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
      }
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
      }
      upper.pop(); lower.pop();
      return lower.concat(upper);
    };

    const simplifyTo6 = (poly) => {
      const pts = poly.slice();
      while (pts.length > 6) {
        let minArea = Infinity, minIdx = 0, n = pts.length;
        for (let i = 0; i < n; i++) {
          const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
          const area = Math.abs((a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])) * 0.5);
          if (area < minArea) { minArea = area; minIdx = i; }
        }
        pts.splice(minIdx, 1);
      }
      return pts;
    };

    const polyArea = (pts) => {
      let a = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        a += p[0] * q[1] - q[0] * p[1];
      }
      return Math.abs(a) * 0.5;
    };

    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    const minCompArea = total * 0.04;
    const maxCompArea = total * 0.80;
    let bestHex = null, bestBoundary = null, bestScore = -1;

    for (const { thresh: T, invert } of [{ thresh: 185, invert: false }, { thresh: otsuT, invert: false }, { thresh: otsuT, invert: true }, { thresh: 105, invert: true }]) {
      visited.fill(0);
      for (let start = 0; start < total; start++) {
        if (visited[start]) continue;
        if (!(invert ? gray[start] < T : gray[start] > T)) continue;
        let qh = 0, qt = 0;
        queue[qt++] = start;
        visited[start] = 1;
        const boundary = [];
        let count = 0;
        let hitL = false, hitR = false, hitT = false, hitB = false;

        while (qh < qt) {
          const idx = queue[qh++];
          count++;
          const x = idx % w, y = (idx / w) | 0;
          if (x === 0) hitL = true; if (x === w - 1) hitR = true;
          if (y === 0) hitT = true; if (y === h - 1) hitB = true;
          let isB = false;
          const nbrs = [idx - 1, idx + 1, idx - w, idx + w];
          for (let ni = 0; ni < 4; ni++) {
            if ((ni === 0 && x === 0) || (ni === 1 && x === w - 1) || (ni === 2 && y === 0) || (ni === 3 && y === h - 1)) { isB = true; continue; }
            const nIdx = nbrs[ni];
            if (!(invert ? gray[nIdx] < T : gray[nIdx] > T)) isB = true;
            else if (!visited[nIdx]) { visited[nIdx] = 1; queue[qt++] = nIdx; }
          }
          if (isB) boundary.push([x, y]);
        }

        if ((hitL + hitR + hitT + hitB) >= 2 || count < minCompArea || count > maxCompArea || boundary.length < 30) continue;
        const hex = simplifyTo6(convexHull(boundary));
        if (hex.length !== 6) continue;

        const hArea = polyArea(hex);
        if (hArea < minCompArea) continue;
        const fillRatio = count / hArea;
        if (fillRatio < 0.80) continue;

        // Validate ~120-deg angles and similar edge lengths
        let minE = Infinity, maxE = 0, ok = true;
        for (let i = 0; i < 6; i++) {
          const p0 = hex[(i + 5) % 6], p1 = hex[i], p2 = hex[(i + 1) % 6];
          const v1x = p0[0] - p1[0], v1y = p0[1] - p1[1];
          const v2x = p2[0] - p1[0], v2y = p2[1] - p1[1];
          const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
          if (l1 < 12 || l2 < 12) { ok = false; break; }
          minE = Math.min(minE, l1); maxE = Math.max(maxE, l1);
          const cosA = (v1x * v2x + v1y * v2y) / (l1 * l2);
          if (cosA > -0.1 || cosA < -0.85) { ok = false; break; }
        }
        if (!ok || minE / maxE < 0.55) continue;

        let gScore = 0;
        for (let e = 0; e < 6; e++) {
          const a = hex[e], b = hex[(e + 1) % 6];
          for (let s = 1; s < 12; s++) {
            const t = s / 12;
            const x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t);
            if (x >= 0 && x < w && y >= 0 && y < h) gScore += grad[y * w + x];
          }
        }
        const score = (gScore / 66) * fillRatio * Math.pow(hArea, 0.25);
        if (score > bestScore) {
          bestScore = score;
          bestHex = hex;
          bestBoundary = boundary;
        }
      }
    }

    if (!bestHex) return null;

    // Refine 6 edges by line-fitting & intersection
    const fitLine = (pts) => {
      if (pts.length < 5) return null;
      let mx = 0, my = 0;
      for (const [x, y] of pts) { mx += x; my += y; }
      mx /= pts.length; my /= pts.length;
      let sxx = 0, syy = 0, sxy = 0;
      for (const [x, y] of pts) {
        const dx = x - mx, dy = y - my;
        sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
      }
      const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
      const nx = -Math.sin(theta), ny = Math.cos(theta);
      return { nx, ny, c: nx * mx + ny * my };
    };
    const intersectLines = (L1, L2) => {
      if (!L1 || !L2) return null;
      const det = L1.nx * L2.ny - L1.ny * L2.nx;
      if (Math.abs(det) < 1e-6) return null;
      return [(L1.c * L2.ny - L1.ny * L2.c) / det, (L1.nx * L2.c - L1.c * L2.nx) / det];
    };

    const edgeLines = [];
    for (let e = 0; e < 6; e++) {
      const a = bestHex[e], b = bestHex[(e + 1) % 6];
      const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey) || 1;
      const ux = ex / len, uy = ey / len;
      const ptsOnEdge = [];
      for (const p of bestBoundary) {
        const dx = p[0] - a[0], dy = p[1] - a[1];
        const along = (dx * ux + dy * uy) / len;
        const perp = Math.abs(dx * -uy + dy * ux);
        if (along > 0.15 && along < 0.85 && perp < 4.5) ptsOnEdge.push(p);
      }
      edgeLines.push(fitLine(ptsOnEdge));
    }
    const refinedHex = [];
    for (let i = 0; i < 6; i++) {
      const p = intersectLines(edgeLines[(i + 5) % 6], edgeLines[i]);
      refinedHex.push(p || bestHex[i]);
    }

    // Pick the two most horizontal edges (top and bottom flat edges) -> [TL, TR, BR, BL]
    const edges = [];
    for (let e = 0; e < 6; e++) {
      const a = refinedHex[e], b = refinedHex[(e + 1) % 6];
      const midY = (a[1] + b[1]) / 2;
      const horizScore = Math.abs(b[0] - a[0]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
      edges.push({ a, b, midY, horizScore });
    }
    edges.sort((u, v) => v.horizScore - u.horizScore);
    const topTwo = edges.slice(0, 2).sort((u, v) => u.midY - v.midY);
    const topEdge = topTwo[0];
    const botEdge = topTwo[1];
    const [tl, tr] = topEdge.a[0] <= topEdge.b[0] ? [topEdge.a, topEdge.b] : [topEdge.b, topEdge.a];
    const [bl, br] = botEdge.a[0] <= botEdge.b[0] ? [botEdge.a, botEdge.b] : [botEdge.b, botEdge.a];

    return [tl, tr, br, bl].map(([x, y]) => [x / scale, y / scale]);
  }

  // Local-contrast blob detector in rectified mm-space for holes on a flat original base
  function autoDetectBaseHoles({ img, calMode, H_mmToImg, affine3, mmToImgPt, applyH, H_imgToMm }) {
    if (!img || (!H_mmToImg && !affine3)) return [];
    const pxPerMm = 3.5;
    let minMmX = -26, maxMmX = 26, minMmY = -26, maxMmY = 26;
    if (calMode === 'puphex') {
      minMmX = -40; maxMmX = 40; minMmY = -40; maxMmY = 40;
    } else if (calMode === 'lbracket70') {
      // Scan only the open quadrant inside the L-bracket arms (skip the 10mm arms at <-23mm)
      minMmX = -22; maxMmX = 48; minMmY = -22; maxMmY = 48;
    }
    const N = Math.round((maxMmX - minMmX) * pxPerMm);

    const off = document.createElement('canvas');
    off.width = img.width;
    off.height = img.height;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0);
    const srcData = octx.getImageData(0, 0, img.width, img.height).data;
    const iw = img.width, ih = img.height;

    const rectGray = new Float32Array(N * N);
    for (let py = 0; py < N; py++) {
      const mmY = maxMmY - (py + 0.5) / pxPerMm;
      for (let px = 0; px < N; px++) {
        const mmX = minMmX + (px + 0.5) / pxPerMm;
        const [ix, iy] = mmToImgPt(mmX, mmY);
        const sx = Math.round(ix), sy = Math.round(iy);
        if (sx >= 0 && sx < iw && sy >= 0 && sy < ih) {
          const k = (sy * iw + sx) * 4;
          rectGray[py * N + px] = 0.299 * srcData[k] + 0.587 * srcData[k + 1] + 0.114 * srcData[k + 2];
        }
      }
    }

    // Estimate base brightness (75th percentile of rectified pixels) so dark frame/arms don't poison local bg
    const sortedG = Array.from(rectGray).sort((a, b) => a - b);
    const baseLum = sortedG[Math.floor(sortedG.length * 0.75)] || 180;

    // Integral image for fast 29x29 (~7.25mm) local background mean (clamping dark frame/holes up to baseLum)
    const integ = new Float64Array((N + 1) * (N + 1));
    for (let y = 0; y < N; y++) {
      let rowSum = 0;
      for (let x = 0; x < N; x++) {
        const g = rectGray[y * N + x];
        rowSum += g < baseLum - 38 ? baseLum : g;
        integ[(y + 1) * (N + 1) + (x + 1)] = integ[y * (N + 1) + (x + 1)] + rowSum;
      }
    }

    const winR = 14;
    const diff = new Float32Array(N * N);
    let maxDiff = 0;
    for (let y = 0; y < N; y++) {
      const y0 = Math.max(0, y - winR), y1 = Math.min(N - 1, y + winR);
      for (let x = 0; x < N; x++) {
        const x0 = Math.max(0, x - winR), x1 = Math.min(N - 1, x + winR);
        const area = (x1 - x0 + 1) * (y1 - y0 + 1);
        const sum = integ[(y1 + 1) * (N + 1) + (x1 + 1)] - integ[y0 * (N + 1) + (x1 + 1)] - integ[(y1 + 1) * (N + 1) + x0] + integ[y0 * (N + 1) + x0];
        const d = (sum / area) - rectGray[y * N + x];
        diff[y * N + x] = d;
        if (d > maxDiff) maxDiff = d;
      }
    }

    const thresh = Math.max(15, Math.min(35, maxDiff * 0.25));
    const visited = new Uint8Array(N * N);
    const queue = new Int32Array(N * N);
    const minPxArea = Math.PI * 0.8 * 0.8 * pxPerMm * pxPerMm; // ~1.6mm eq dia
    const maxPxArea = Math.PI * 3.6 * 3.6 * pxPerMm * pxPerMm; // ~7.2mm eq dia
    const blobs = [];

    for (let start = 0; start < N * N; start++) {
      if (visited[start] || diff[start] < thresh) continue;
      let qh = 0, qt = 0;
      queue[qt++] = start;
      visited[start] = 1;
      let cnt = 0, sumX = 0, sumY = 0, sumDiff = 0;
      let minX = N, maxX = -1, minY = N, maxY = -1;

      while (qh < qt) {
        const idx = queue[qh++];
        const x = idx % N, y = (idx / N) | 0;
        cnt++;
        sumX += x; sumY += y; sumDiff += diff[idx];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;

        if (x > 0 && !visited[idx - 1] && diff[idx - 1] >= thresh) { visited[idx - 1] = 1; queue[qt++] = idx - 1; }
        if (x < N - 1 && !visited[idx + 1] && diff[idx + 1] >= thresh) { visited[idx + 1] = 1; queue[qt++] = idx + 1; }
        if (y > 0 && !visited[idx - N] && diff[idx - N] >= thresh) { visited[idx - N] = 1; queue[qt++] = idx - N; }
        if (y < N - 1 && !visited[idx + N] && diff[idx + N] >= thresh) { visited[idx + N] = 1; queue[qt++] = idx + N; }
      }

      if (cnt < minPxArea || cnt > maxPxArea) continue;
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      if (Math.max(bw, bh) / Math.min(bw, bh) > 1.65) continue;
      const fill = cnt / (bw * bh);
      if (fill < 0.45 || fill > 0.95) continue;
      if (minX <= 1 || maxX >= N - 2 || minY <= 1 || maxY >= N - 2) continue;

      const cx = sumX / cnt;
      const cy = sumY / cnt;
      const avgDiff = sumDiff / cnt;
      const eqDia = (2 * Math.sqrt(cnt / Math.PI)) / pxPerMm;
      blobs.push({ cx, cy, eqDia, score: avgDiff * fill });
    }

    blobs.sort((a, b) => b.score - a.score);
    const picked = [];
    const minSepPx = 5.5 * pxPerMm;
    for (const b of blobs) {
      if (picked.some((p) => Math.hypot(p.cx - b.cx, p.cy - b.cy) < minSepPx)) continue;
      picked.push(b);
      if (picked.length >= 4) break;
    }

    // Refine each picked hole's diameter using local annulus background vs core median
    return picked.map((b) => {
      const cxInt = Math.round(b.cx);
      const cyInt = Math.round(b.cy);
      const scanR = Math.round(3.6 * pxPerMm);
      const outerR = Math.round(4.8 * pxPerMm);
      const innerR = Math.max(2, Math.round(0.9 * pxPerMm));
      const ringVals = [], coreVals = [];
      for (let dy = -outerR; dy <= outerR; dy++) {
        for (let dx = -outerR; dx <= outerR; dx++) {
          const r2 = dx * dx + dy * dy;
          const nx = cxInt + dx, ny = cyInt + dy;
          if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
          const g = rectGray[ny * N + nx];
          if (r2 <= innerR * innerR) coreVals.push(g);
          else if (r2 >= scanR * scanR && r2 <= outerR * outerR && g >= baseLum - 38) ringVals.push(g);
        }
      }
      ringVals.sort((a, b) => a - b);
      coreVals.sort((a, b) => a - b);
      const bgLocal = ringVals.length ? ringVals[Math.floor(ringVals.length * 0.75)] : baseLum;
      const coreMed = coreVals.length ? coreVals[Math.floor(coreVals.length * 0.5)] : (bgLocal - 30);
      const edgeDrop = Math.max(10, (bgLocal - coreMed) * 0.40);
      let halfCount = 0;
      for (let dy = -scanR; dy <= scanR; dy++) {
        for (let dx = -scanR; dx <= scanR; dx++) {
          if (dx * dx + dy * dy > scanR * scanR) continue;
          const nx = cxInt + dx, ny = cyInt + dy;
          if (nx >= 0 && nx < N && ny >= 0 && ny < N && (bgLocal - rectGray[ny * N + nx]) >= edgeDrop) {
            halfCount++;
          }
        }
      }
      const refinedDia = halfCount > 4
        ? (2 * Math.sqrt(halfCount / Math.PI)) / pxPerMm
        : b.eqDia;
      const estDia = Number(Math.min(6.0, Math.max(1.5, refinedDia)).toFixed(1));
      const mmX = minMmX + (b.cx + 0.5) / pxPerMm;
      const mmY = maxMmY - (b.cy + 0.5) / pxPerMm;
      const rMm = estDia / 2;
      const [imgX, imgY] = mmToImgPt(mmX, mmY);
      const [edgeX, edgeY] = mmToImgPt(mmX + rMm, mmY);
      return {
        x: mmX,
        y: mmY,
        diameter: estDia,
        imgX,
        imgY,
        imgR: Math.hypot(edgeX - imgX, edgeY - imgY),
      };
    });
  }

  return {
    autoDetectCalibrationQuad,
    autoDetectLBracket,
    autoDetectHexBase,
    autoDetectBaseHoles,
  };
})();
