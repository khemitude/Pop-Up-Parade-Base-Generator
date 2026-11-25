# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-25

### Added
- **Parametric Uniform Base Generator** (`mesh.js`, `app.js`): Circle, Hexagon (Flat-Top & Pointy-Top), Octagon, Rounded Square, and Rounded Rectangle bases with configurable width/diameter, thickness, top chamfer, 2-tier stepped plinth, underside magnet pocket, and experimental hollow shell mode.
- **Per-Figure Peg Layouts**: Distance & Angle and Manual X/Y modes, 5 peg hole shapes (`Round`, `Hexagon`, `D-Shape`, `Round + Square Key`, `Oval / Slot`), blind or through-holes, key angle rotation, and hole clearance.
- **Photo Peg Measurer** (`photo-measurer.js`, `photo-detect.js`): Perspective-corrected homography measurement with 70×70 mm Calibration Frame, 70×70 mm L-Bracket, 103.65 mm PUP Hex Base, Credit/ID Card, and 2-point ruler calibration, plus corner and base-hole auto-detection.
- **Interactive 2D & 3D Previews** (`preview.js`): WebGL isometric 3D preview with underside flip/zoom and 1:1 10 mm grid 2D blueprint with drag-to-move and right-drag/`Shift+drag` rotation.
- **Calibration & Test-Fit STLs**: Pre-generated peg-fit test gauges and 70×70 mm photo calibration frame / L-bracket STLs, plus `verify_mesh.js` watertight manifold verification.
- **Documentation**: `README.md`, `docs/TUTORIAL.md`, and `docs/FEATURES.md`.
