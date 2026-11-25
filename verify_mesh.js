const fs = require('fs');
const path = require('path');
const PUPMesh = require('./mesh.js');

function checkWatertight(name, tris) {
  if (!tris.length) throw new Error(`${name}: 0 triangles`);
  const edgeMap = new Map();
  const keyV = (v) => `${v[0].toFixed(4)},${v[1].toFixed(4)},${v[2].toFixed(4)}`;

  for (let i = 0; i < tris.length; i++) {
    const [a, b, c] = tris[i];
    const ka = keyV(a), kb = keyV(b), kc = keyV(c);
    if (ka === kb || kb === kc || kc === ka) {
      throw new Error(`${name}: degenerate triangle at ${i}`);
    }
    const edges = [[ka, kb], [kb, kc], [kc, ka]];
    for (const [u, v] of edges) {
      const k = `${u}->${v}`;
      edgeMap.set(k, (edgeMap.get(k) || 0) + 1);
    }
  }

  let openEdges = 0;
  let nonManifold = 0;
  for (const [k, count] of edgeMap.entries()) {
    if (count !== 1) nonManifold++;
    const [u, v] = k.split('->');
    const twin = `${v}->${u}`;
    if (!edgeMap.has(twin)) openEdges++;
  }

  if (openEdges > 0 || nonManifold > 0) {
    throw new Error(`${name}: NOT watertight! openEdges=${openEdges}, nonManifold=${nonManifold}`);
  }

  const stl = PUPMesh.trianglesToBinarySTL(tris, name);
  const expectedBytes = 84 + tris.length * 50;
  if (stl.byteLength !== expectedBytes) {
    throw new Error(`${name}: STL size mismatch ${stl.byteLength} != ${expectedBytes}`);
  }
  console.log(`PASS ${name}: ${tris.length} tris, ${stl.byteLength} bytes, watertight manifold.`);
}

const sampleFig = {
  pegs: [
    { x: -13, y: 0, diameter: 4.0, depth: 4.5, shape: 'hexagon', flatAngle: 0, enabled: true },
    { x: 13, y: 0, diameter: 4.0, depth: 4.5, shape: 'd_shape', flatAngle: 45, enabled: true },
    { x: 0, y: -16, diameter: 3.2, depth: 6.0, through: true, shape: 'slot', slotLength: 2.0, enabled: true },
    { x: 0, y: 16, diameter: 4.2, depth: 10.0, shape: 'keyhole', flatAngle: 90, enabled: true },
  ],
};

const shapes = ['circle', 'hexagon', 'octagon', 'rounded_square', 'rounded_rect'];
for (const shape of shapes) {
  checkWatertight(
    `flat_${shape}`,
    PUPMesh.buildBaseMesh({ shape, diameter: 80, height: 6, chamfer: 1.2, clearance: 0.2 }, sampleFig)
  );
  checkWatertight(
    `stepped_magnet_${shape}`,
    PUPMesh.buildBaseMesh(
      { shape, diameter: 80, height: 7, chamfer: 1.0, stepped: true, stepInset: 4, stepHeight: 2.5, magnetPocket: true, magnetDiameter: 8.2, magnetDepth: 2.2, clearance: 0.2 },
      sampleFig
    )
  );
}

checkWatertight(
  'hollow_circle',
  PUPMesh.buildBaseMesh({ shape: 'circle', diameter: 65, height: 14, hollow: true, clearance: 0.2 }, sampleFig)
);
checkWatertight(
  'hollow_stepped_hexagon',
  PUPMesh.buildBaseMesh({ shape: 'hexagon', diameter: 103.65, height: 14, stepped: true, stepInset: 2, stepHeight: 8.65, hollow: true, clearance: 0.2 }, sampleFig)
);
checkWatertight(
  'hollow_stepped_hexagon_stamped',
  PUPMesh.buildBaseMesh({ shape: 'hexagon', diameter: 103.65, height: 14, stepped: true, stepInset: 2, stepHeight: 8.65, hollow: true, stampName: true, clearance: 0.2 }, { id: 'suisei_sp', name: 'Hoshimachi Suisei (SP)', pegs: sampleFig.pegs })
);

const gaugeTris = PUPMesh.buildTestGaugeMesh(1.8, 0.2, 23);
checkWatertight('test_gauge', gaugeTris);
fs.writeFileSync(path.join(__dirname, 'pup_peg_fit_test_gauge_1.8_to_6.2mm.stl'), PUPMesh.trianglesToBinarySTL(gaugeTris, 'PUP Peg-Fit Test Gauge 1.8-6.2mm (0.2mm step)'));

const fineGaugeTris = PUPMesh.buildTestGaugeMesh(3.0, 0.1, 21);
checkWatertight('test_gauge_fine_0.1mm', fineGaugeTris);

const calTris = PUPMesh.buildCalibrationBlockMesh(70, 8, 2.4);
checkWatertight('calibration_frame_70mm', calTris);
fs.writeFileSync(path.join(__dirname, 'pup_photo_calibration_frame_70mm.stl'), PUPMesh.trianglesToBinarySTL(calTris, 'PUP Photo Calibration Frame 70x70mm'));

const lBracketTris = PUPMesh.buildCalibrationLBracketMesh(70, 10, 2.4);
checkWatertight('calibration_l_bracket_70mm', lBracketTris);
fs.writeFileSync(path.join(__dirname, 'pup_photo_calibration_l_bracket_70mm.stl'), PUPMesh.trianglesToBinarySTL(lBracketTris, 'PUP Photo Calibration L-Bracket 70x70mm'));
console.log('All mesh checks passed!');
