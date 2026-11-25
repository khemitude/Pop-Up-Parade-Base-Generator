# POP UP PARADE — Uniform Base Generator

A zero-dependency, browser-based parametric 3D base generator for **POP UP PARADE** (and similar pegged) figures. Design a single uniform base style—circle, hexagon, octagon, rounded square, or rounded rectangle—dial in per-figure peg layouts with calipers or the built-in **perspective-corrected Photo Peg Measurer**, preview in 3D and 1:1 2D, and export **watertight binary STL** files ready for 3D printing.

**[Launch Live App](https://khemitude.github.io/Pop-Up-Parade-Base-Generator/)**

---

## Features at a Glance

- **Uniform Base Styles**: Circle, Hexagon (Flat-Top or Pointy-Top), Octagon, Rounded Square, and Rounded Rectangle, with configurable width/diameter, thickness, optional top chamfer, 2-tier **Stepped Plinth**, **Underside Magnet Pocket**, and **Hollow Shell** (face-down print) mode.
- **Per-Figure Peg Layouts**: Supports multiple pegs/support rods per figure, **Distance & Angle** or **Manual X / Y** positioning, 5 peg hole shapes (`Round`, `Hexagon (Keyed)`, `D-Shape (Keyed)`, `Round + Square Key`, `Oval / Slot`), blind or through-holes, key angle rotation, and global/per-figure hole clearance.
- **Photo Peg Measurer (No Calipers Needed)**: Upload or paste (`Ctrl+V`) a photo of your figure's feet or original base alongside a calibration reference (70×70 mm Calibration Frame, 70×70 mm L-Bracket, standard 103.65 mm PUP hex base, credit/ID card, or 2-point ruler distance). Includes corner auto-detection, base-hole auto-detection, and 3-pt circle / 2-pt edge / 1-pt center measurement tools.
- **Interactive 3D & 1:1 2D Previews**: Drag-to-rotate 3D isometric preview (with underside flip and zoom) and a 1:1 10 mm grid top-down blueprint (drag to reposition pegs, right-drag or `Shift+drag` to rotate).
- **Watertight Manifold Mesh Engine**: Pure JavaScript earcut-with-hole-bridging triangulation in [`mesh.js`](mesh.js) that validates manifold geometry in real time and exports binary STLs.
- **Calibration & Fit-Test STLs Included**: Ready-to-print peg-fit test gauges and 70×70 mm photo calibration frames are included in the repository and can also be generated directly from the app.
- **Collection Management**: Preloaded with measured Hololive POP UP PARADE presets ([`figures.js`](figures.js)), live figure search (by name, group, or notes), custom figure creation, Undo/Redo (`Ctrl+Z` / `Ctrl+Y`), browser `localStorage` auto-save, and `Export` / `Import Config JSON`.

---

## How to Run

### Option 1: Use the Live Web App (No Setup)
Open **[https://khemitude.github.io/Pop-Up-Parade-Base-Generator/](https://khemitude.github.io/Pop-Up-Parade-Base-Generator/)** in any modern browser. Everything runs locally in your browser—no data or photos leave your device.

### Option 2: Open Locally in a Browser
The app is 100% client-side HTML, CSS, and vanilla JavaScript—no build step, bundler, or internet connection required.
1. Download or clone this repository.
2. Double-click [`index.html`](index.html) (or open it via **File → Open File…** in Chrome, Edge, Firefox, or Safari).

### Option 3: Run a Local Web Server
Serving over `localhost` is useful if you want to test in a clean HTTP origin or host on GitHub Pages:

```bash
# Python 3
python -m http.server 8080

# Or Node.js (npx)
npx serve .
```

Then open `http://localhost:8080` in your browser.

### Option 4: Run Mesh Verification (Node.js)
To verify that [`mesh.js`](mesh.js) produces watertight, non-degenerate manifold STLs across all base shapes, stepped/magnet/hollow variants, gauges, and calibration blocks:

```bash
node verify_mesh.js
```

Requires **Node.js** (tested on v22).

---

## Documentation

- **[Step-by-Step Tutorial](docs/TUTORIAL.md)** — How to print the test gauge and calibration frame, measure a figure with or without calipers, customize your uniform base, and export for 3D printing.
- **[Features & Reference Guide](docs/FEATURES.md)** — Detailed breakdown of every UI control, peg shape, calibration mode, keyboard shortcut, and the `PUPMesh` API.
- **[Project Wiki](https://github.com/khemitude/Pop-Up-Parade-Base-Generator/wiki)** — Community Figure Measurements Database, 3D Printing & Slicing Guide, and FAQ.

---

## Repository Contents

| File | Description |
| :--- | :--- |
| [`index.html`](index.html) | Main HTML layout and Photo Peg Measurer modal markup |
| [`styles.css`](styles.css) | Application, modal, and utility styles |
| [`app.js`](app.js) | State management, presets, undo/redo, form controls, and STL/JSON export |
| [`preview.js`](preview.js) | 2D 1:1 blueprint renderer, 3D WebGL preview, and canvas drag/rotate interactions |
| [`photo-measurer.js`](photo-measurer.js) | Photo Peg Measurer UI, perspective homography math, and canvas tools |
| [`photo-detect.js`](photo-detect.js) | Computer-vision auto-detectors for calibration frames, L-brackets, hex bases, and base holes |
| [`mesh.js`](mesh.js) | Parametric 3D mesh & binary STL generator (`PUPMesh`, works in browser & Node.js) |
| [`figures.js`](figures.js) | Default base configuration and pre-measured figure presets (`DEFAULT_CONFIG`) |
| [`verify_mesh.js`](verify_mesh.js) | Node.js watertight manifold test suite & utility STL generator (`npm test`) |
| [`docs/`](docs/) | Tutorial ([`TUTORIAL.md`](docs/TUTORIAL.md)) and reference guide ([`FEATURES.md`](docs/FEATURES.md)) |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history (SemVer) |
| [`package.json`](package.json) | Project metadata, version, keywords, and `npm test` script |
| [`LICENSE`](LICENSE) | MIT License |
| `pup_peg_fit_test_gauge_*.stl` | Pre-generated peg-fit test gauge (1.8–6.2 mm in 0.2 mm steps) |
| `pup_photo_calibration_frame_70mm.stl` | 70×70 mm square calibration frame for perspective-corrected photo measurements |
| `pup_photo_calibration_l_bracket_70mm.stl` | 70×70 mm 3-corner L-bracket calibration reference for figures that don't fit inside a closed frame |
