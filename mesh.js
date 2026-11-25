/**
 * Parametric 3D Mesh & Binary STL Generator for POP UP PARADE Replacement Bases.
 * Works in both Browser (window.PUPMesh) and Node.js (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PUPMesh = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EPS = 1e-7;

  function dist2D(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  function signedArea(poly) {
    let area = 0;
    for (let i = 0, n = poly.length; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return area * 0.5;
  }

  function ensureCCW(poly) {
    return signedArea(poly) < 0 ? poly.slice().reverse() : poly.slice();
  }

  function ensureCW(poly) {
    return signedArea(poly) > 0 ? poly.slice().reverse() : poly.slice();
  }

  /**
   * Generate 2D outer polygon in CCW order centered at (0, 0).
   */
  function generateOuterPolygon(shape, diameter, opts = {}) {
    const r = diameter / 2;
    const pts = [];

    if (shape === 'circle') {
      const segs = opts.segments || 72;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    } else if (shape === 'hexagon') {
      // Flat-top (0 deg) or pointy-top (30 deg); `diameter` is flat-to-flat width
      const offset = opts.hexPointy ? Math.PI / 6 : 0;
      const circumR = r / Math.cos(Math.PI / 6);
      for (let i = 0; i < 6; i++) {
        const a = offset + (i / 6) * Math.PI * 2;
        pts.push([Math.cos(a) * circumR, Math.sin(a) * circumR]);
      }
    } else if (shape === 'octagon') {
      const offset = Math.PI / 8;
      const circumR = r / Math.cos(Math.PI / 8);
      for (let i = 0; i < 8; i++) {
        const a = offset + (i / 8) * Math.PI * 2;
        pts.push([Math.cos(a) * circumR, Math.sin(a) * circumR]);
      }
    } else if (shape === 'rounded_square' || shape === 'rounded_rect') {
      const w = diameter;
      const h = shape === 'rounded_rect' ? (opts.depth || diameter * 0.78) : diameter;
      const cr = Math.min(opts.cornerRadius || Math.min(w, h) * 0.16, Math.min(w, h) * 0.45);
      const hw = w / 2 - cr;
      const hh = h / 2 - cr;
      const arcSegs = 10;
      const corners = [
        [hw, hh, 0],
        [-hw, hh, Math.PI / 2],
        [-hw, -hh, Math.PI],
        [hw, -hh, (3 * Math.PI) / 2],
      ];
      for (const [cx, cy, startA] of corners) {
        for (let i = 0; i <= arcSegs; i++) {
          const a = startA + (i / arcSegs) * (Math.PI / 2);
          pts.push([cx + Math.cos(a) * cr, cy + Math.sin(a) * cr]);
        }
      }
    } else {
      throw new Error('Unknown base shape: ' + shape);
    }

    return ensureCCW(pts);
  }

  /**
   * Inset a convex CCW polygon inward by `inset` mm using edge-normal mitered offsets.
   */
  function insetPolygon(polyCCW, inset) {
    if (inset <= 0) return polyCCW.map((p) => [p[0], p[1]]);
    const n = polyCCW.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const pPrev = polyCCW[(i - 1 + n) % n];
      const pCurr = polyCCW[i];
      const pNext = polyCCW[(i + 1) % n];

      const e1x = pCurr[0] - pPrev[0];
      const e1y = pCurr[1] - pPrev[1];
      const l1 = Math.hypot(e1x, e1y) || 1;
      // Inward normal for CCW is (-ey, ex)
      const n1x = -e1y / l1;
      const n1y = e1x / l1;

      const e2x = pNext[0] - pCurr[0];
      const e2y = pNext[1] - pCurr[1];
      const l2 = Math.hypot(e2x, e2y) || 1;
      const n2x = -e2y / l2;
      const n2y = e2x / l2;

      // Line 1: (pCurr + n1*inset) + t * e1
      // Line 2: (pCurr + n2*inset) + s * e2
      const bx = n1x + n2x;
      const by = n1y + n2y;
      const denom = 1 + (n1x * n2x + n1y * n2y);
      if (denom < 0.1) {
        out.push([pCurr[0] + n1x * inset, pCurr[1] + n1y * inset]);
      } else {
        const scale = inset / denom;
        out.push([pCurr[0] + bx * scale, pCurr[1] + by * scale]);
      }
    }
    return out;
  }

  /**
   * Generate a peg hole polygon in CW order.
   */
  function generateHolePolygon(peg, clearance) {
    const d = Math.max(0.5, (peg.diameter || 4.0) + (clearance || 0));
    const r = d / 2;
    const cx = peg.x || 0;
    const cy = peg.y || 0;
    const shape = peg.shape || 'round';
    const pts = [];

    if (shape === 'hexagon') {
      // Hexagonal keyed peg: `diameter` is flat-to-flat (wrench size) or circumdiameter;
      // using circumradius = r / cos(30 deg) so `diameter` = flat-to-flat width!
      const rot = ((peg.flatAngle || 0) * Math.PI) / 180;
      const circumR = r / Math.cos(Math.PI / 6);
      for (let i = 0; i < 6; i++) {
        const a = rot + (i / 6) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * circumR, cy + Math.sin(a) * circumR]);
      }
    } else if (shape === 'd_shape') {
      // Circle with one flat side (at flatAngle deg, flat at 0.72*r)
      const flatRad = ((peg.flatAngle || 0) * Math.PI) / 180;
      const halfChordA = Math.acos(0.72);
      const arcSegs = 26;
      const startA = flatRad + halfChordA;
      const sweep = Math.PI * 2 - 2 * halfChordA;
      for (let i = 0; i <= arcSegs; i++) {
        const a = startA + (i / arcSegs) * sweep;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    } else if (shape === 'slot') {
      const slotLen = Math.max(0.5, peg.slotLength || 2.0);
      const halfSpan = slotLen / 2;
      const rot = ((peg.flatAngle || 0) * Math.PI) / 180;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const arcSegs = 12;
      const raw = [];
      for (let i = 0; i <= arcSegs; i++) {
        const a = -Math.PI / 2 + (i / arcSegs) * Math.PI;
        raw.push([halfSpan + Math.cos(a) * r, Math.sin(a) * r]);
      }
      for (let i = 0; i <= arcSegs; i++) {
        const a = Math.PI / 2 + (i / arcSegs) * Math.PI;
        raw.push([-halfSpan + Math.cos(a) * r, Math.sin(a) * r]);
      }
      for (const [lx, ly] of raw) {
        pts.push([cx + lx * cosR - ly * sinR, cy + lx * sinR + ly * cosR]);
      }
    } else if (shape === 'keyhole') {
      // Round hole with a square key tab protruding at flatAngle (deg)
      const rot = ((peg.flatAngle || 0) * Math.PI) / 180;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const halfTabW = r * 0.44;
      const tabOut = r * 1.38;
      const halfA = Math.asin(Math.min(0.9, halfTabW / r));
      const arcSegs = 28;
      const raw = [];
      for (let i = 0; i <= arcSegs; i++) {
        const a = halfA + (i / arcSegs) * (Math.PI * 2 - 2 * halfA);
        raw.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      raw.push([tabOut, -halfTabW]);
      raw.push([tabOut, halfTabW]);
      for (const [lx, ly] of raw) {
        pts.push([cx + lx * cosR - ly * sinR, cy + lx * sinR + ly * cosR]);
      }
    } else {
      const segs = 32;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    }

    return ensureCW(pts);
  }

  // --- 2D Triangulation (Robust Earcut with Hole Bridging) ---

  function cross2D(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  }

  function ecArea(p, q, r) {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  }

  function ecEquals(p1, p2) {
    return Math.abs(p1.x - p2.x) < EPS && Math.abs(p1.y - p2.y) < EPS;
  }

  function ecPointInTriangle(ax, ay, bx, by, cx, cy, px, py) {
    return (
      (cx - px) * (ay - py) >= (ax - px) * (cy - py) &&
      (ax - px) * (by - py) >= (bx - px) * (ay - py) &&
      (bx - px) * (cy - py) >= (cx - px) * (by - py)
    );
  }

  function ecIntersects(p1, q1, p2, q2) {
    const o1 = Math.sign(ecArea(p1, q1, p2));
    const o2 = Math.sign(ecArea(p1, q1, q2));
    const o3 = Math.sign(ecArea(p2, q2, p1));
    const o4 = Math.sign(ecArea(p2, q2, q1));
    if (o1 !== o2 && o3 !== o4) return true;
    return false;
  }

  function ecLocallyInside(a, b) {
    return ecArea(a.prev, a, a.next) < 0
      ? ecArea(a, b, a.next) >= 0 && ecArea(a, a.prev, b) >= 0
      : ecArea(a, b, a.prev) < 0 || ecArea(a, a.next, b) < 0;
  }

  function ecMiddleInside(a, b) {
    let p = a;
    let inside = false;
    const px = (a.x + b.x) / 2;
    const py = (a.y + b.y) / 2;
    do {
      if (p.y > py !== p.next.y > py && p.next.y !== p.y && px < ((p.next.x - p.x) * (py - p.y)) / (p.next.y - p.y) + p.x) {
        inside = !inside;
      }
      p = p.next;
    } while (p !== a);
    return inside;
  }

  function ecIsValidDiagonal(a, b) {
    return (
      a.next.i !== b.i &&
      a.prev.i !== b.i &&
      !ecIntersectsPolygon(a, b) &&
      ((ecLocallyInside(a, b) && ecLocallyInside(b, a) && ecMiddleInside(a, b) && (ecArea(a.prev, a, b.prev) || ecArea(a, b.prev, b))) ||
        (ecEquals(a, b) && ecArea(a.prev, a, a.next) > 0 && ecArea(b.prev, b, b.next) > 0))
    );
  }

  function ecIntersectsPolygon(a, b) {
    let p = a;
    do {
      if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i && ecIntersects(p, p.next, a, b)) {
        return true;
      }
      p = p.next;
    } while (p !== a);
    return false;
  }

  function ecInsertNode(i, x, y, last) {
    const p = { i, x, y, prev: null, next: null, steiner: false };
    if (!last) {
      p.prev = p;
      p.next = p;
    } else {
      p.next = last.next;
      p.prev = last;
      last.next.prev = p;
      last.next = p;
    }
    return p;
  }

  function ecRemoveNode(p) {
    p.next.prev = p.prev;
    p.prev.next = p.next;
  }

  function ecLinkedList(pts, startIdx, clockwise) {
    let last = null;
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      sum += (b[0] - a[0]) * (a[1] + b[1]);
    }
    if (clockwise === sum > 0) {
      for (let i = 0; i < pts.length; i++) {
        last = ecInsertNode(startIdx + i, pts[i][0], pts[i][1], last);
      }
    } else {
      for (let i = pts.length - 1; i >= 0; i--) {
        last = ecInsertNode(startIdx + i, pts[i][0], pts[i][1], last);
      }
    }
    if (last && ecEquals(last, last.next)) {
      ecRemoveNode(last);
      last = last.next;
    }
    return last;
  }

  function ecFilterPoints(start, end) {
    if (!start) return start;
    if (!end) end = start;
    let p = start;
    let again;
    do {
      again = false;
      if (!p.steiner && (ecEquals(p, p.next) || ecArea(p.prev, p, p.next) === 0)) {
        ecRemoveNode(p);
        p = end = p.prev;
        if (p === p.next) break;
        again = true;
      } else {
        p = p.next;
      }
    } while (again || p !== end);
    return end;
  }

  function ecSplitPolygon(a, b) {
    const a2 = { i: a.i, x: a.x, y: a.y, prev: null, next: null, steiner: false };
    const b2 = { i: b.i, x: b.x, y: b.y, prev: null, next: null, steiner: false };
    const an = a.next;
    const bp = b.prev;
    a.next = b;
    b.prev = a;
    a2.next = an;
    an.prev = a2;
    b2.next = a2;
    a2.prev = b2;
    bp.next = b2;
    b2.prev = bp;
    return b2;
  }

  function ecFindHoleBridge(hole, outerNode) {
    let p = outerNode;
    const hx = hole.x;
    const hy = hole.y;
    let qx = -Infinity;
    let m = null;

    do {
      if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
        const x = p.x + ((hy - p.y) * (p.next.x - p.x)) / (p.next.y - p.y);
        if (x <= hx && x > qx) {
          qx = x;
          m = p.x < p.next.x ? p : p.next;
          if (x === hx) return m;
        }
      }
      p = p.next;
    } while (p !== outerNode);

    if (!m) return null;

    const stop = m;
    const mx = m.x;
    const my = m.y;
    let tanMin = Infinity;
    let tan;
    p = m;
    do {
      if (
        hx >= p.x &&
        p.x >= mx &&
        hx !== p.x &&
        ecPointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)
      ) {
        tan = Math.abs(hy - p.y) / (hx - p.x);
        if (ecLocallyInside(p, hole) && (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && ecSectorContainsSector(m, p)))))) {
          m = p;
          tanMin = tan;
        }
      }
      p = p.next;
    } while (p !== stop);
    return m;
  }

  function ecSectorContainsSector(m, p) {
    return ecArea(m.prev, m, p.prev) < 0 && ecArea(p.next, m, m.next) < 0;
  }

  function ecEliminateHole(hole, outerNode) {
    const bridge = ecFindHoleBridge(hole, outerNode);
    if (!bridge) return outerNode;
    const bridgeReverse = ecSplitPolygon(bridge, hole);
    ecFilterPoints(bridgeReverse, bridgeReverse.next);
    return ecFilterPoints(bridge, bridge.next);
  }

  function ecIsEar(ear) {
    const a = ear.prev;
    const b = ear;
    const c = ear.next;
    if (ecArea(a, b, c) >= 0) return false;
    const ax = a.x, bx = b.x, cx = c.x;
    const ay = a.y, by = b.y, cy = c.y;
    const x0 = Math.min(ax, bx, cx), y0 = Math.min(ay, by, cy);
    const x1 = Math.max(ax, bx, cx), y1 = Math.max(ay, by, cy);
    let p = c.next;
    while (p !== a) {
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && ecPointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && ecArea(p.prev, p, p.next) >= 0) {
        return false;
      }
      p = p.next;
    }
    return true;
  }

  function ecCureLocalIntersections(start, tris) {
    let p = start;
    do {
      const a = p.prev;
      const b = p.next.next;
      if (!ecEquals(a, b) && ecIntersects(a, p, p.next, b) && ecLocallyInside(a, b) && ecLocallyInside(b, a)) {
        tris.push([[a.x, a.y], [p.x, p.y], [b.x, b.y]]);
        ecRemoveNode(p);
        ecRemoveNode(p.next);
        p = start = b;
      }
      p = p.next;
    } while (p !== start);
    return ecFilterPoints(p);
  }

  function ecSplitEarcut(start, tris) {
    let a = start;
    do {
      let b = a.next.next;
      while (b !== a.prev) {
        if (a.i !== b.i && ecIsValidDiagonal(a, b)) {
          let c = ecSplitPolygon(a, b);
          a = ecFilterPoints(a, a.next);
          c = ecFilterPoints(c, c.next);
          ecEarcutLinked(a, tris, 0);
          ecEarcutLinked(c, tris, 0);
          return;
        }
        b = b.next;
      }
      a = a.next;
    } while (a !== start);
  }

  function ecEarcutLinked(ear, tris, pass) {
    if (!ear) return;
    let stop = ear;
    while (ear.prev !== ear.next) {
      const prev = ear.prev;
      const next = ear.next;
      if (ecIsEar(ear)) {
        // Ensure CCW order [prev, ear, next] -> note ecArea(prev, ear, next) < 0 means CW in screen-y, which is CCW in math-y!
        // Let's verify: ecArea(p, q, r) = (q.y-p.y)*(r.x-q.x) - (q.x-p.x)*(r.y-q.y) = -cross2D(p, q, r).
        // So ecArea < 0 means cross2D > 0 (CCW)!
        tris.push([[prev.x, prev.y], [ear.x, ear.y], [next.x, next.y]]);
        ecRemoveNode(ear);
        ear = next.next;
        stop = next.next;
        continue;
      }
      ear = next;
      if (ear === stop) {
        if (!pass) {
          ecEarcutLinked(ecFilterPoints(ear), tris, 1);
        } else if (pass === 1) {
          ear = ecCureLocalIntersections(ecFilterPoints(ear), tris);
          ecEarcutLinked(ear, tris, 2);
        } else if (pass === 2) {
          ecSplitEarcut(ear, tris);
        }
        break;
      }
    }
  }

  function earClip(polyCCW) {
    return triangulateWithHoles(polyCCW, []);
  }

  function triangulateWithHoles(outerCCW, holesCW) {
    let outerNode = ecLinkedList(outerCCW, 0, false);
    if (!outerNode || outerNode.next === outerNode.prev) return [];

    if (holesCW && holesCW.length) {
      let idxOffset = outerCCW.length;
      const queue = [];
      for (const h of holesCW) {
        const list = ecLinkedList(h, idxOffset, true);
        idxOffset += h.length;
        if (list) {
          if (list === list.next) list.steiner = true;
          let leftmost = list;
          let p = list;
          do {
            if (p.x < leftmost.x || (p.x === leftmost.x && p.y < leftmost.y)) leftmost = p;
            p = p.next;
          } while (p !== list);
          queue.push(leftmost);
        }
      }
      queue.sort((a, b) => a.x - b.x);
      for (const q of queue) {
        outerNode = ecEliminateHole(q, outerNode);
      }
    }

    const tris = [];
    ecEarcutLinked(ecFilterPoints(outerNode), tris, 0);
    return tris;
  }

  // --- 3D Mesh Builders ---

  function addQuad(tris, a, b, c, d) {
    tris.push([a, b, c]);
    tris.push([a, c, d]);
  }

  /**
   * Connect two aligned 2D rings at z0 and z1.
   * For outward-facing normals on a CCW outer ring going from z0 (bottom) to z1 (top):
   * ring0[i] -> ring0[i+1] -> ring1[i+1] -> ring1[i].
   */
  function stitchRings(tris, ring0, z0, ring1, z1, flip) {
    const n = ring0.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const p00 = [ring0[i][0], ring0[i][1], z0];
      const p10 = [ring0[j][0], ring0[j][1], z0];
      const p11 = [ring1[j][0], ring1[j][1], z1];
      const p01 = [ring1[i][0], ring1[i][1], z1];
      if (!flip) {
        addQuad(tris, p00, p10, p11, p01);
      } else {
        addQuad(tris, p00, p01, p11, p10);
      }
    }
  }

  /**
   * Build a hollow, face-down printable base shell with internal peg bosses
   * (top display face at z=0 on build plate, open hollow cavity facing +Z).
   */
  function buildHollowBaseMesh(params, figure) {
    const shape = params.shape || 'circle';
    const diameter = Number(params.diameter) || 65;
    const height = Math.max(5, Number(params.height) || 14);
    const wallThick = Math.max(1.2, Number(params.wallThickness) || 2.0);
    const deckThick = Math.max(1.0, Number(params.deckThickness) || 1.6);
    const stepped = Boolean(params.stepped);
    const stepInset = stepped ? Math.max(1, Number(params.stepInset) || 2) : 0;
    const stepHeight = stepped ? Math.min(height - 2.5, Math.max(1, Number(params.stepHeight) || 8.65)) : 0;
    const chamfer = (!stepped && params.chamfer) ? Math.min(Number(params.chamfer) || 0, 2.0) : 0;
    const clearance = Number(params.clearance) || 0;

    // Base outer polygon (bottom skirt when upright, top rim when face-down)
    const outerSkirtCCW = generateOuterPolygon(shape, diameter, params);
    const outerDisplayCCW = stepped
      ? insetPolygon(outerSkirtCCW, stepInset)
      : insetPolygon(outerSkirtCCW, chamfer);
    const innerFloorCCW = insetPolygon(outerDisplayCCW, wallThick);
    const innerFloorCW = ensureCW(innerFloorCCW);
    const innerRimCCW = stepped
      ? insetPolygon(outerSkirtCCW, wallThick)
      : innerFloorCCW;
    const innerRimCW = ensureCW(innerRimCCW);

    // Flip Y for face-down printing so when flipped upright, X/Y match the 2D blueprint
    const rawPegs = (figure && figure.pegs ? figure.pegs : []).filter((p) => p.enabled !== false);
    const pegs = rawPegs.map((p) => ({
      ...p,
      y: -(Number(p.y) || 0),
      flatAngle: -(Number(p.flatAngle) || 0),
    }));

    // Compute per-peg safe boss wall so adjacent bosses never overlap
    const bossWalls = pegs.map((p, i) => {
      let maxWall = 2.2;
      const ri = ((p.diameter || 4.0) + clearance) / 2;
      for (let j = 0; j < pegs.length; j++) {
        if (i === j) continue;
        const q = pegs[j];
        const rj = ((q.diameter || 4.0) + clearance) / 2;
        const d = Math.hypot((p.x || 0) - (q.x || 0), (p.y || 0) - (q.y || 0));
        const avail = (d - ri - rj - 0.5) / 2;
        if (avail < maxWall) maxWall = avail;
      }
      return Math.max(0.9, maxWall);
    });

    const holeEntries = pegs.map((p, i) => {
      const cw = generateHolePolygon(p, clearance);
      const depth = Math.min(height - 0.8, Math.max(1.0, Number(p.depth) || 7.0));
      const isThrough = Boolean(p.through) || depth >= height - 0.1;
      const zBossTop = isThrough ? height : Math.min(height, Math.max(deckThick + 0.8, depth + 1.2));
      const bossDia = (p.diameter || 4.0) + clearance + bossWalls[i] * 2;
      const bossCCW = ensureCCW(generateHolePolygon({ ...p, diameter: bossDia, shape: 'round' }, 0));
      const bossCW = ensureCW(bossCCW);
      return { cw, depth, isThrough, zBossTop, bossCCW, bossCW };
    });

    const tris = [];

    // 1. Outer walls (z = 0 is display face on bed; z = height is open bottom rim)
    if (!stepped) {
      if (chamfer > 0.01) {
        stitchRings(tris, outerDisplayCCW, 0, outerSkirtCCW, chamfer, false);
        stitchRings(tris, outerSkirtCCW, chamfer, outerSkirtCCW, height, false);
      } else {
        stitchRings(tris, outerSkirtCCW, 0, outerSkirtCCW, height, false);
      }
    } else {
      const topTierH = height - stepHeight;
      const zBevelEnd = Math.min(height - 0.6, topTierH + stepInset);
      stitchRings(tris, outerDisplayCCW, 0, outerDisplayCCW, topTierH, false);
      stitchRings(tris, outerDisplayCCW, topTierH, outerSkirtCCW, zBevelEnd, false);
      stitchRings(tris, outerSkirtCCW, zBevelEnd, outerSkirtCCW, height, false);
    }

    // 2. Display face at z = 0 (normal -Z) with all peg holes
    const bedTris = triangulateWithHoles(outerDisplayCCW, holeEntries.map((h) => h.cw));
    for (const [a, b, c] of bedTris) {
      tris.push([[a[0], a[1], 0], [c[0], c[1], 0], [b[0], b[1], 0]]);
    }

    // 3. Open bottom rim at z = height (normal +Z) — uniform wallThick wide
    const rimTris = triangulateWithHoles(outerSkirtCCW, [innerRimCW]);
    for (const [a, b, c] of rimTris) {
      tris.push([[a[0], a[1], height], [b[0], b[1], height], [c[0], c[1], height]]);
    }

    // 4. Inner cavity wall (z = deckThick to height, following stepped 45° bevel if stepped)
    if (!stepped) {
      stitchRings(tris, innerFloorCW, deckThick, innerFloorCW, height, false);
    } else {
      const topTierH = height - stepHeight;
      const zBevelEnd = Math.min(height - 0.6, topTierH + stepInset);
      if (topTierH > deckThick + 0.05) {
        stitchRings(tris, innerFloorCW, deckThick, innerFloorCW, topTierH, false);
        stitchRings(tris, innerFloorCW, topTierH, innerRimCW, zBevelEnd, false);
      } else {
        stitchRings(tris, innerFloorCW, deckThick, innerRimCW, zBevelEnd, false);
      }
      stitchRings(tris, innerRimCW, zBevelEnd, innerRimCW, height, false);
    }

    // 5. Inner cavity floor at z = deckThick (normal +Z) around all peg bosses
    const floorTris = triangulateWithHoles(innerFloorCCW, holeEntries.map((h) => h.bossCW));
    for (const [a, b, c] of floorTris) {
      tris.push([[a[0], a[1], deckThick], [b[0], b[1], deckThick], [c[0], c[1], deckThick]]);
    }

    // 6. Peg bosses & peg holes
    for (const h of holeEntries) {
      // Boss outer wall (z = deckThick to zBossTop)
      stitchRings(tris, h.bossCCW, deckThick, h.bossCCW, h.zBossTop, false);

      if (h.isThrough) {
        // Through-hole: open ring at zBossTop, hole wall from 0 to zBossTop
        const topRingTris = triangulateWithHoles(h.bossCCW, [h.cw]);
        for (const [a, b, c] of topRingTris) {
          tris.push([[a[0], a[1], h.zBossTop], [b[0], b[1], h.zBossTop], [c[0], c[1], h.zBossTop]]);
        }
        stitchRings(tris, h.cw, 0, h.cw, h.zBossTop, false);
      } else {
        // Blind hole inside closed boss: solid cap at zBossTop (+Z), hole wall from 0 to depth, blind cap at depth (-Z)
        const bossCapTris = earClip(h.bossCCW);
        for (const [a, b, c] of bossCapTris) {
          tris.push([[a[0], a[1], h.zBossTop], [b[0], b[1], h.zBossTop], [c[0], c[1], h.zBossTop]]);
        }
        stitchRings(tris, h.cw, 0, h.cw, h.depth, false);
        const holeCapTris = earClip(ensureCCW(h.cw));
        for (const [a, b, c] of holeCapTris) {
          tris.push([[a[0], a[1], h.depth], [c[0], c[1], h.depth], [b[0], b[1], h.depth]]);
        }
      }
    }

    return tris;
  }

  function buildBaseMesh(params, figure) {
    if (params.hollow) {
      return buildHollowBaseMesh(params, figure);
    }
    const shape = params.shape || 'circle';
    const diameter = Number(params.diameter) || 80;
    const height = Math.max(2, Number(params.height) || 6);
    const chamfer = Math.min(Number(params.chamfer) || 0, height * 0.45);
    const stepped = Boolean(params.stepped);
    const stepInset = stepped ? Math.max(1, Number(params.stepInset) || 4) : 0;
    const stepHeight = stepped ? Math.min(height - 1.5, Math.max(1, Number(params.stepHeight) || 2.5)) : 0;
    const clearance = Number(params.clearance) || 0;

    const outerBottom = generateOuterPolygon(shape, diameter, params);
    const outerTop = stepped
      ? insetPolygon(outerBottom, stepInset + chamfer)
      : insetPolygon(outerBottom, chamfer);

    // Prepare peg holes
    const pegs = (figure && figure.pegs ? figure.pegs : []).filter((p) => p.enabled !== false);
    const holeEntries = pegs.map((p) => {
      const cw = generateHolePolygon(p, clearance);
      const depth = Math.min(height, Math.max(0.5, Number(p.depth) || 4.5));
      const isThrough = Boolean(p.through) || depth >= height - 0.05;
      return { cw, depth, isThrough };
    });

    // Magnet pocket on underside — auto-place away from peg holes if (0, 0) interferes
    let magnetHoleCW = null;
    let magnetDepth = 0;
    let magnetPos = null;
    if (params.magnetPocket) {
      const mDia = Number(params.magnetDiameter) || 8.2;
      const mRad = mDia / 2;
      magnetDepth = Math.min(height - 1.2, Math.max(0.8, Number(params.magnetDepth) || 2.2));
      const minWall = 1.5;

      const isClear = (mx, my) => {
        for (let i = 0; i < pegs.length; i++) {
          const p = pegs[i];
          const pRad = ((p.diameter || 4.0) + clearance) / 2;
          if (Math.hypot(mx - (p.x || 0), my - (p.y || 0)) < mRad + pRad + minWall) {
            return false;
          }
        }
        return true;
      };

      let bestX = 0, bestY = 0;
      if (!isClear(0, 0)) {
        const maxR = Math.max(0, diameter / 2 - chamfer - stepInset - mRad - 3.0);
        let found = false;
        let bestScore = -Infinity;
        for (let r = Math.ceil(mRad + 4); r <= maxR && !found; r += 3) {
          for (let aIdx = 0; aIdx < 16; aIdx++) {
            const a = (aIdx / 16) * Math.PI * 2 - Math.PI / 2; // prefer -Y/+Y first
            const cx = Math.cos(a) * r;
            const cy = Math.sin(a) * r;
            let minDist = Infinity;
            for (const p of pegs) {
              const pRad = ((p.diameter || 4.0) + clearance) / 2;
              minDist = Math.min(minDist, Math.hypot(cx - (p.x || 0), cy - (p.y || 0)) - (mRad + pRad));
            }
            if (minDist >= minWall) {
              bestX = Number(cx.toFixed(2));
              bestY = Number(cy.toFixed(2));
              found = true;
              break;
            }
            if (minDist > bestScore) {
              bestScore = minDist;
              bestX = Number(cx.toFixed(2));
              bestY = Number(cy.toFixed(2));
            }
          }
        }
      }
      magnetPos = [bestX, bestY];
      magnetHoleCW = generateHolePolygon({ x: bestX, y: bestY, diameter: mDia, shape: 'round' }, 0);
    }

    const tris = [];

    // 1. Outer walls
    if (!stepped) {
      if (chamfer > 0.01) {
        const zMid = height - chamfer;
        stitchRings(tris, outerBottom, 0, outerBottom, zMid, false);
        stitchRings(tris, outerBottom, zMid, outerTop, height, false);
      } else {
        stitchRings(tris, outerBottom, 0, outerTop, height, false);
      }
    } else {
      const outerStep = insetPolygon(outerBottom, stepInset);
      stitchRings(tris, outerBottom, 0, outerBottom, stepHeight, false);
      stitchRings(tris, outerBottom, stepHeight, outerStep, stepHeight, false);
      if (chamfer > 0.01 && height - stepHeight > chamfer + 0.1) {
        const zMid = height - chamfer;
        stitchRings(tris, outerStep, stepHeight, outerStep, zMid, false);
        stitchRings(tris, outerStep, zMid, outerTop, height, false);
      } else {
        stitchRings(tris, outerStep, stepHeight, outerTop, height, false);
      }
    }

    // 2. Top face at z = height (with all peg holes)
    const topHolesCW = holeEntries.map((h) => h.cw);
    const topTris = triangulateWithHoles(outerTop, topHolesCW);
    for (const [a, b, c] of topTris) {
      tris.push([
        [a[0], a[1], height],
        [b[0], b[1], height],
        [c[0], c[1], height],
      ]);
    }

    // 3. Hole walls and blind-hole floors
    for (const h of holeEntries) {
      const zFloor = h.isThrough ? 0 : height - h.depth;
      // Hole ring is CW; going from zFloor to height with flip=false gives inward normal!
      // Wait: let's verify: for CW ring, e = p[i+1] - p[i] goes clockwise.
      // (p10 - p00) x (p01 - p00) = (dx, dy, 0) x (0, 0, +dz) = (dy*dz, -dx*dz, 0).
      // Right-hand normal of CW edge points INWARD (toward hole center)!
      stitchRings(tris, h.cw, zFloor, h.cw, height, false);

      if (!h.isThrough) {
        const floorCCW = ensureCCW(h.cw);
        const floorTris = earClip(floorCCW);
        for (const [a, b, c] of floorTris) {
          tris.push([
            [a[0], a[1], zFloor],
            [b[0], b[1], zFloor],
            [c[0], c[1], zFloor],
          ]);
        }
      }
    }

    // 4. Bottom face at z = 0 (with through-holes + optional magnet pocket)
    const bottomHolesCW = holeEntries.filter((h) => h.isThrough).map((h) => h.cw);
    if (magnetHoleCW) bottomHolesCW.push(magnetHoleCW);

    const botTris = triangulateWithHoles(outerBottom, bottomHolesCW);
    for (const [a, b, c] of botTris) {
      // Reverse winding for -Z normal
      tris.push([
        [a[0], a[1], 0],
        [c[0], c[1], 0],
        [b[0], b[1], 0],
      ]);
    }

    // 5. Magnet pocket wall & ceiling (at z = magnetDepth, normal -Z)
    if (magnetHoleCW) {
      stitchRings(tris, magnetHoleCW, 0, magnetHoleCW, magnetDepth, false);
      const magCCW = ensureCCW(magnetHoleCW);
      const magTris = earClip(magCCW);
      for (const [a, b, c] of magTris) {
        tris.push([
          [a[0], a[1], magnetDepth],
          [c[0], c[1], magnetDepth],
          [b[0], b[1], magnetDepth],
        ]);
      }
    }

    return tris;
  }

  /**
   * Append a closed, watertight axis-aligned box to `tris`.
   */
  function appendBox(tris, x0, y0, z0, x1, y1, z1) {
    const p = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    // Bottom (-Z), Top (+Z), Front (-Y), Back (+Y), Left (-X), Right (+X)
    const faces = [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
      [1, 2, 6, 5],
    ];
    for (const [a, b, c, d] of faces) {
      tris.push([p[a], p[b], p[c]], [p[a], p[c], p[d]]);
    }
  }

  /**
   * Append 7-segment style embossed digits/dots (e.g. "3.8") centered at (cx, cy).
   * Segments have small gaps so each prism is an independent watertight shell.
   */
  function appendEmbossedText(tris, text, cx, cy, zBottom, zTop, digitH = 5.6) {
    const SEG_MAP = {
      '0': [1, 1, 1, 1, 1, 1, 0],
      '1': [0, 1, 1, 0, 0, 0, 0],
      '2': [1, 1, 0, 1, 1, 0, 1],
      '3': [1, 1, 1, 1, 0, 0, 1],
      '4': [0, 1, 1, 0, 0, 1, 1],
      '5': [1, 0, 1, 1, 0, 1, 1],
      '6': [1, 0, 1, 1, 1, 1, 1],
      '7': [1, 1, 1, 0, 0, 0, 0],
      '8': [1, 1, 1, 1, 1, 1, 1],
      '9': [1, 1, 1, 1, 0, 1, 1],
    };
    const digitW = digitH * 0.65;
    const stroke = Math.max(0.55, digitH * 0.14);
    const gap = 0.04;
    const dotW = stroke * 1.15;
    const charGap = Math.max(0.85, stroke * 1.3);

    const chars = String(text).split('');
    const widths = chars.map((ch) => (ch === '.' ? dotW : digitW));
    const totalW = widths.reduce((s, w) => s + w, 0) + Math.max(0, chars.length - 1) * charGap;

    let cursorX = cx - totalW / 2;
    const yBot = cy - digitH / 2;
    const yTop = cy + digitH / 2;
    const yMid = cy;

    chars.forEach((ch, idx) => {
      const w = widths[idx];
      if (ch === '.') {
        appendBox(tris, cursorX, yBot, zBottom, cursorX + w, yBot + stroke * 1.15, zTop);
      } else if (SEG_MAP[ch]) {
        const s = SEG_MAP[ch];
        const xL = cursorX;
        const xR = cursorX + w;
        const vTopEnd = s[0] ? yTop - stroke - gap : yTop;
        const vBotStart = s[3] ? yBot + stroke + gap : yBot;
        // 0: top, 1: top-right, 2: bot-right, 3: bottom, 4: bot-left, 5: top-left, 6: middle
        if (s[0]) appendBox(tris, xL + gap, yTop - stroke, zBottom, xR - gap, yTop, zTop);
        if (s[3]) appendBox(tris, xL + gap, yBot, zBottom, xR - gap, yBot + stroke, zTop);
        if (s[6]) appendBox(tris, xL + gap, yMid - stroke / 2, zBottom, xR - gap, yMid + stroke / 2, zTop);

        if (s[1] && s[2] && !s[6]) {
          appendBox(tris, xR - stroke, vBotStart, zBottom, xR, vTopEnd, zTop);
        } else {
          if (s[1]) appendBox(tris, xR - stroke, yMid + stroke / 2 + gap, zBottom, xR, vTopEnd, zTop);
          if (s[2]) appendBox(tris, xR - stroke, vBotStart, zBottom, xR, yMid - stroke / 2 - gap, zTop);
        }

        if (s[4] && s[5] && !s[6]) {
          appendBox(tris, xL, vBotStart, zBottom, xL + stroke, vTopEnd, zTop);
        } else {
          if (s[4]) appendBox(tris, xL, vBotStart, zBottom, xL + stroke, yMid - stroke / 2 - gap, zTop);
          if (s[5]) appendBox(tris, xL, yMid + stroke / 2 + gap, zBottom, xL + stroke, vTopEnd, zTop);
        }
      }
      cursorX += w + charGap;
    });
  }

  /**
   * Build a fast, readable 2-row Peg-Fit Test Gauge (1.8-6.2mm in 0.2mm steps, 23 holes)
   * fitting inside a 120x28x1.8mm footprint with 1.0mm outer rim margin and 0.4mm embossed labels.
   */
  function buildTestGaugeMesh(startDia = 1.8, step = 0.2, count = 23) {
    const spacing = 10.0;
    const colsTop = Math.floor(count / 2);
    const colsBot = count - colsTop;
    const maxCols = Math.max(colsBot, colsTop);
    const width = (maxCols - 1) * spacing + 10; // 120mm for 23 holes
    const depth = 28;
    const height = 1.8;
    const chamfer = 0.3;
    const edgeMargin = 1.0;

    const outerBottom = generateOuterPolygon('rounded_rect', width, { depth, cornerRadius: 2 });
    const outerTop = insetPolygon(outerBottom, chamfer);

    const holeEntries = [];
    const botStartX = -((colsBot - 1) * spacing) / 2;
    const topStartX = -((colsTop - 1) * spacing) / 2;

    for (let i = 0; i < count; i++) {
      const dia = Number((startDia + i * step).toFixed(2));
      const isTop = i >= colsBot;
      const col = isTop ? i - colsBot : i;
      const x = (isTop ? topStartX : botStartX) + col * spacing;
      const absY = depth / 2 - chamfer - edgeMargin - dia / 2;
      const y = isTop ? absY : -absY;
      const labelY = isTop ? 3.0 : -3.0;
      holeEntries.push({
        cw: generateHolePolygon({ x, y, diameter: dia, shape: 'round' }, 0),
        x,
        labelY,
        dia,
      });
    }

    const tris = [];
    stitchRings(tris, outerBottom, 0, outerBottom, height - chamfer, false);
    stitchRings(tris, outerBottom, height - chamfer, outerTop, height, false);

    const topTris = triangulateWithHoles(
      outerTop,
      holeEntries.map((h) => h.cw)
    );
    for (const [a, b, c] of topTris) {
      tris.push([
        [a[0], a[1], height],
        [b[0], b[1], height],
        [c[0], c[1], height],
      ]);
    }

    for (const h of holeEntries) {
      stitchRings(tris, h.cw, 0, h.cw, height, false);
      appendEmbossedText(tris, h.dia.toFixed(1), h.x, h.labelY, height - 0.2, height + 0.4, 4.2);
    }

    const botTris = triangulateWithHoles(
      outerBottom,
      holeEntries.map((h) => h.cw)
    );
    for (const [a, b, c] of botTris) {
      tris.push([
        [a[0], a[1], 0],
        [c[0], c[1], 0],
        [b[0], b[1], 0],
      ]);
    }

    return tris;
  }

  /**
   * Build a quick-print Photo Calibration Frame (70x70mm outer square, 54x54mm open window).
   * Sharp 90-deg outer corners provide 4 exact points for perspective homography correction.
   * Includes a 3mm orientation hole on the Top (+Y) rim.
   */
  function buildCalibrationBlockMesh(outerSize = 70, rimWidth = 8, height = 2.4) {
    const half = outerSize / 2;
    const innerHalf = Math.max(10, half - rimWidth);

    const outerCCW = ensureCCW([
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ]);

    const innerCW = ensureCW([
      [-innerHalf, -innerHalf],
      [innerHalf, -innerHalf],
      [innerHalf, innerHalf],
      [-innerHalf, innerHalf],
    ]);

    const orientHoleCW = generateHolePolygon(
      { x: 0, y: half - rimWidth / 2, diameter: 3.0, shape: 'round' },
      0
    );
    const holes = [innerCW, orientHoleCW];

    const tris = [];
    stitchRings(tris, outerCCW, 0, outerCCW, height, false);
    for (const h of holes) {
      stitchRings(tris, h, 0, h, height, false);
    }

    const topTris = triangulateWithHoles(outerCCW, holes);
    for (const [a, b, c] of topTris) {
      tris.push([
        [a[0], a[1], height],
        [b[0], b[1], height],
        [c[0], c[1], height],
      ]);
    }

    const botTris = triangulateWithHoles(outerCCW, holes);
    for (const [a, b, c] of botTris) {
      tris.push([
        [a[0], a[1], 0],
        [c[0], c[1], 0],
        [b[0], b[1], 0],
      ]);
    }

    return tris;
  }

  /**
   * Build a 70x70mm L-Bracket Calibration Print (10mm arms, 2.4mm thick)
   * with 10mm ruler notches along the inner edges and a 3mm corner marker hole.
   */
  function buildCalibrationLBracketMesh(armLen = 70, armWidth = 10, height = 2.4) {
    const half = armLen / 2; // 35
    const xInner = -half + armWidth; // -25
    const yInner = half - armWidth;  // +25

    // CCW outer L-polygon with Top-Left at (-half, +half), Top-Right at (+half, +half), Bottom-Left at (-half, -half)
    const outerCCW = ensureCCW([
      [-half, -half],
      [xInner, -half],
      [xInner, yInner],
      [half, yInner],
      [half, half],
      [-half, half],
    ]);

    const cornerHoleCW = generateHolePolygon(
      { x: -half + armWidth / 2, y: half - armWidth / 2, diameter: 3.0, shape: 'round' },
      0
    );

    const tris = [];
    stitchRings(tris, outerCCW, 0, outerCCW, height, false);
    stitchRings(tris, cornerHoleCW, 0, cornerHoleCW, height, false);

    const topTris = triangulateWithHoles(outerCCW, [cornerHoleCW]);
    for (const [a, b, c] of topTris) {
      tris.push([[a[0], a[1], height], [b[0], b[1], height], [c[0], c[1], height]]);
    }

    const botTris = triangulateWithHoles(outerCCW, [cornerHoleCW]);
    for (const [a, b, c] of botTris) {
      tris.push([[a[0], a[1], 0], [c[0], c[1], 0], [b[0], b[1], 0]]);
    }

    // Add raised 10mm tick marks and numbers (20..60mm) along top and left arms
    for (let d = 10; d <= armLen - 10; d += 10) {
      // Top arm ticks & numbers (x = -half + d)
      const tx = -half + d;
      if (tx > xInner + 2) {
        appendBox(tris, tx - 0.4, yInner + 0.5, height - 0.2, tx + 0.4, yInner + 2.6, height + 0.6);
        appendEmbossedText(tris, String(d), tx, yInner + 5.6, height - 0.2, height + 0.6, 3.2);
      }
      // Left arm ticks & numbers (y = half - d)
      const ty = half - d;
      if (ty < yInner - 2) {
        appendBox(tris, xInner - 2.6, ty - 0.4, height - 0.2, xInner - 0.5, ty + 0.4, height + 0.6);
        appendEmbossedText(tris, String(d), xInner - 6.2, ty, height - 0.2, height + 0.6, 3.2);
      }
    }

    return tris;
  }

  function trianglesToBinarySTL(triangles, headerText) {
    const count = triangles.length;
    const buffer = new ArrayBuffer(84 + count * 50);
    const view = new DataView(buffer);

    const header = (headerText || 'POP UP PARADE Base Generator').slice(0, 79);
    for (let i = 0; i < header.length; i++) {
      view.setUint8(i, header.charCodeAt(i));
    }
    view.setUint32(80, count, true);

    let offset = 84;
    for (let i = 0; i < count; i++) {
      const [v0, v1, v2] = triangles[i];
      const ux = v1[0] - v0[0];
      const uy = v1[1] - v0[1];
      const uz = v1[2] - v0[2];
      const vx = v2[0] - v0[0];
      const vy = v2[1] - v0[1];
      const vz = v2[2] - v0[2];

      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      view.setFloat32(offset, nx, true);
      view.setFloat32(offset + 4, ny, true);
      view.setFloat32(offset + 8, nz, true);

      view.setFloat32(offset + 12, v0[0], true);
      view.setFloat32(offset + 16, v0[1], true);
      view.setFloat32(offset + 20, v0[2], true);

      view.setFloat32(offset + 24, v1[0], true);
      view.setFloat32(offset + 28, v1[1], true);
      view.setFloat32(offset + 32, v1[2], true);

      view.setFloat32(offset + 36, v2[0], true);
      view.setFloat32(offset + 40, v2[1], true);
      view.setFloat32(offset + 44, v2[2], true);

      view.setUint16(offset + 48, 0, true);
      offset += 50;
    }

    return new Uint8Array(buffer);
  }

  return {
    generateOuterPolygon,
    generateHolePolygon,
    buildBaseMesh,
    buildTestGaugeMesh,
    buildCalibrationBlockMesh,
    buildCalibrationLBracketMesh,
    trianglesToBinarySTL,
  };
});
