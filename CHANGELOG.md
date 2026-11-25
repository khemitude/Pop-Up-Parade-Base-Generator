# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Live C2C Blueprint Lines**: Toggleable **C2C Lines** overlay on the Top-Down 1:1 Blueprint showing live millimeter distances between pegs.
- **Copy Wiki Row (Markdown)**: **Copy Wiki Row** copies a formatted Markdown table row for GitHub Issues or the Wiki `Figure Measurements Database`.
- **Compact Fit-Test Strip (2 mm)**: **Download Fit-Test Strip (2 mm)** exports a fast `2 mm` rounded-rectangle strip tightly wrapping just the figure's peg holes and clearance.
- **Per-Figure Base Width Override**: Optional **Base Width Override (mm)** per figure for oversized POP UP PARADE L/SP or wide-stance figures.
- **Shareable Figure Links (`#fig=...`)**: **Copy Shareable Figure Link** encodes a figure into a URL hash that prompts to import when opened.
- **Center-to-Center (C2C) Pin Solver**: Live `P1 ↔ P2`, `P1 ↔ P3`, and `P2 ↔ P3` distance readout and trilateration solver (**Apply C2C → X / Y** with **Flip** toggle) for 2- and 3-peg caliper measurements.
- **Workflow Hints**: Added concise UI hints for global base settings, browser auto-save/backups, caliper-vs-photo entry, and `.zip` batch export filtering; removed inaccurate print-time estimates for test gauges/strips.
- **Figure Search Box**: Filter figures in **2. Your Figures** in real time by name, group, or notes.
- **Single-Figure Share & Merge**: Export/copy a single figure's JSON (`Export Figure JSON`) and merge imported figure(s) (`Merge Figure(s)`) without overwriting existing presets.
- **Underside Name Stamp**: Optional embossed figure name on the inner cavity floor in Hollow Shell mode (`mesh.js`: `appendStampedLabel`), auto-scaling to fit smaller base diameters.
- **Batch ZIP Export**: **Download All Measured STLs** now bundles all measured STLs into a single `.zip` archive (`createZipBytes`).
- **Depth & Edge Safety Warnings**: Live validation warnings when blind holes leave `< 0.8 mm` floor or pegs sit within `2 mm` of the top perimeter.
- **Fine & Micro Test Gauge Presets**: Header gauge selector for `1.8–6.2 mm (0.2 mm)`, `3.0–5.0 mm (0.1 mm Fine)`, and `3.6–4.6 mm (0.1 mm Micro)`.

### Changed
- **Hollow Shell Graduated**: Removed the "Experimental" label from **Hollow Shell (Face-Down Print)** and documented its internal 45° stepped-plinth chamfer for support-free printing.
- **Default Hole Clearance**: Changed default `clearance` to `0.15 mm` and added UI/documentation warnings against `0.00` clearance without gauge testing or slicer XY hole compensation.
- **Modular Presets**: Extracted `DEFAULT_CONFIG` into `figures.js`, removed redundant `figures.json`, and updated Nekomata Okayu's peg triangle (`14.00 mm` right-foot c2c, `52.50 mm` left-to-right).

## [1.0.0] - 2026-11-25

### Added
- **Parametric Uniform Base Generator** (`mesh.js`, `app.js`): Circle, Hexagon (Flat-Top & Pointy-Top), Octagon, Rounded Square, and Rounded Rectangle bases with configurable width/diameter, thickness, top chamfer, 2-tier stepped plinth, underside magnet pocket, and experimental hollow shell mode.
- **Per-Figure Peg Layouts**: Distance & Angle and Manual X/Y modes, 5 peg hole shapes (`Round`, `Hexagon`, `D-Shape`, `Round + Square Key`, `Oval / Slot`), blind or through-holes, key angle rotation, and hole clearance.
- **Photo Peg Measurer** (`photo-measurer.js`, `photo-detect.js`): Perspective-corrected homography measurement with 70×70 mm Calibration Frame, 70×70 mm L-Bracket, 103.65 mm PUP Hex Base, Credit/ID Card, and 2-point ruler calibration, plus corner and base-hole auto-detection.
- **Interactive 2D & 3D Previews** (`preview.js`): WebGL isometric 3D preview with underside flip/zoom and 1:1 10 mm grid 2D blueprint with drag-to-move and right-drag/`Shift+drag` rotation.
- **Calibration & Test-Fit STLs**: Pre-generated peg-fit test gauges and 70×70 mm photo calibration frame / L-bracket STLs, plus `verify_mesh.js` watertight manifold verification.
- **Documentation**: `README.md`, `docs/TUTORIAL.md`, and `docs/FEATURES.md`.
