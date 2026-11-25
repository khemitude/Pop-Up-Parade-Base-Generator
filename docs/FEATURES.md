# Features & Reference Guide

A complete reference for every control, geometry option, measurement tool, and developer API in **POP UP PARADE — Uniform Base Generator**.

---

## 1. Uniform Base Style (Global Settings)

All settings in **1. Uniform Base Style** apply uniformly across every figure in your collection so your display shelf shares a consistent footprint.

| Setting | Description |
| :--- | :--- |
| **Base Shape** | `Circle`, `Hexagon (Flat-Top — Classic PUP)`, `Hexagon (Pointy-Top)`, `Octagon`, `Rounded Square`, `Rounded Rectangle` |
| **Width / Diameter (mm)** | Outer width (or flat-to-flat width for polygons). Range: `45–150 mm`. Standard PUP hex is `103.65 mm`. |
| **Thickness (mm)** | Total height of the base (`3–25 mm`). |
| **Top Chamfer** | Adds a beveled edge around the top perimeter (`0.2–5 mm`). |
| **Stepped Plinth** | Splits the base into a lower tier and an inset upper tier (`Step Inset` and `Lower Tier Height`). |
| **Underside Magnet Pocket** | Cuts a centered circular recess into the bottom face (`Magnet Dia` and `Magnet Depth`). |
| **Hollow Shell (Face-Down Print)** | Hollows the underside and generates internal peg bosses (mirroring injection-molded bases) for face-down printing. When combined with **Stepped Plinth**, the inner cavity wall adds a 45° chamfer/bevel so overhangs print cleanly without supports. |
| **Stamp Figure Name on Underside** | Available in Hollow Shell mode; embosses the figure's name onto the inner cavity floor (auto-scaling down to fit smaller base diameters) so batch-printed bases are easy to tell apart. |

---

## 2. Figure Collection & Persistence

- **Preloaded Presets & Safe Update Prompt**: Ships with measured POP UP PARADE presets in [`figures.js`](../figures.js) (`DEFAULT_CONFIG`). When built-in presets are updated (`presetsVersion`), returning users are shown the exact list of changed figures and fields (peg layout/sizes, facing, notes) before choosing to update built-in figures while preserving custom figures and base style.
- **Figure Search**: Filter the figure list in real time by figure name, group/series, or notes.
- **Export Figure JSON / Merge Figure(s) / Shareable Link / Wiki Row**: Share a single figure's JSON (downloads + copies to clipboard), copy a one-click **`#fig=...` Shareable Figure Link**, copy a formatted **Wiki Markdown Row** for GitHub/Wiki contributions, or merge imported figure(s) into your existing collection without overwriting it.
- **Per-Figure Base Width Override**: Optionally override **Width / Diameter (mm)** for a specific figure (e.g., oversized POP UP PARADE L/SP bases) while keeping the shared uniform style.
- **Auto-Save**: All edits automatically save to browser `localStorage`.
- **Undo / Redo**: Header buttons and keyboard shortcuts (`Ctrl+Z` to Undo, `Ctrl+Y` or `Ctrl+Shift+Z` to Redo).
- **Reset Defaults / Undo Reset**: Restores the built-in presets, with a one-click **Undo Reset (Restore Previous)** safety net.
- **Export / Import Config JSON**: Save or restore your entire base style and figure list as a `.json` file.
- **Fit-Test Strip (2 mm) & Batch ZIP**: **Download Fit-Test Strip (2 mm)** exports a compact `2 mm` rounded-rectangle strip tightly wrapping just the peg holes to test spacing & fit quickly; **Download All Measured STLs (.zip)** bundles all measured bases into a single `.zip` archive; the header **Gauge** selector exports `1.8–6.2 mm (0.2 mm)`, `3.0–5.0 mm (0.1 mm Fine)`, or `3.6–4.6 mm (0.1 mm Micro)` fit-test gauges.
- **Safety Warnings**: The status bar warns if any peg hole sits within `2 mm` of the top perimeter or if a blind hole leaves less than `0.8 mm` of floor thickness.

---

## 3. Peg Layout & Measurements

### Measurement Modes
- **Distance & Angle**: Ideal for standard 2-peg figures. Automatically computes `(x, y)` coordinates from **Peg-to-Peg Dist (mm)**, **Stance Angle (°)**, and **Center Offset X / Y (mm)**.
- **Manual X / Y**: Direct coordinate control for 1-peg, 3-peg, or asymmetric poses.
- **Center-to-Center (C2C) Distances**: Live readout of `P1 ↔ P2`, `P1 ↔ P3`, and `P2 ↔ P3` spacing (for 2–3+ peg figures) with **Apply C2C → X / Y** trilateration and a **Flip** toggle—type your caliper pin-to-pin distances directly to solve `(X, Y)` coordinates automatically.

### Supported Peg Hole Shapes
Defined in [`mesh.js`](../mesh.js) (`generateHolePolygon`):

| Shape | Behavior |
| :--- | :--- |
| **Round** | Smooth 32-segment circle. Supports **Through-hole** option. |
| **Hexagon (Keyed)** | 6-sided hole where `diameter` is the flat-to-flat width; rotated by `Key Angle (°)`. |
| **D-Shape (Keyed)** | Circle with one flat side (at `0.72 × radius`), rotated by `Key Angle (°)`. |
| **Round + Square Key** | Circular hole with a protruding square key tab (`1.38 × radius` reach), rotated by `Key Angle (°)`. |
| **Oval / Slot** | Pill-shaped elongated slot, rotated by `Key Angle (°)`. |

### Hole Clearance
**Hole Clearance (+mm)** adds extra diameter to every peg hole on the active figure (`0.00–0.80 mm`, default `0.15 mm`).
- **Always keep a positive tolerance** (`0.15–0.20 mm` recommended for FDM) unless you have already verified the exact fit on the **Peg-Fit Test Gauge** or enabled XY hole compensation (e.g., `+0.10 mm`) in your slicer—printing at `0.00` clearance without compensation can make holes too tight and snap figure pegs.

### Group Transform Helpers
- **Center Holes**: Translates all enabled holes so their bounding center sits at `(0, 0)`.
- **Rotate ±15° / ±90° / 180°**: Rotates the entire peg group around `(0, 0)`.
- **Figure Facing (Front Edge)**: Sets which edge of the base the figure faces (`Bottom (-Y)`, `Top (+Y)`, `Left (-X)`, `Right (+X)`).

---

## 4. Photo Peg Measurer (Perspective-Corrected)

The modal computes a 2D projective homography from your photo to real-world millimeter coordinates.

### Calibration References
- **Calibration Frame (70 × 70 mm)** — Best accuracy; supports **Auto-Detect Frame Corners**.
- **L-Bracket (70 × 70 mm, 3-Corner)** — Useful when a figure's coat/hair blocks a closed square frame.
- **Standard PUP Hex Base (103.65 mm)** — Use an existing official hex base as the scale reference.
- **Credit / ID Card (85.6 × 53.98 mm)** — Standard ISO/IEC 7810 ID-1 card.
- **2-Point Known Distance** — Click two points on a ruler or coin and enter the distance in mm.

### Peg Measurement Tools
- **3-Pt Circle**: Click 3 points on a peg/hole rim to fit a circle (center + diameter).
- **2-Pt Edge**: Click opposite edges of a peg.
- **1-Pt Center**: Click the peg center and assign a known diameter (e.g., from the Test Gauge).
- **Auto-Detect Base Holes**: Automatically detects circular/hex holes on a flat original base placed inside the 70 mm frame.

### Photo Canvas Controls
- **Upload / Drag & Drop / Paste (`Ctrl+V`)**: Load any image.
- **Zoom / Pan**: Scroll wheel or `+` / `−` / `Fit` buttons; toggle **Pan**, hold `Space`, or right-drag to pan.
- **10 mm Grid**: Toggles the perspective-warped millimeter grid overlay.

---

## 5. Mesh Engine & Node.js Verification (`mesh.js` & `verify_mesh.js`)

[`mesh.js`](../mesh.js) is a UMD module (`window.PUPMesh` in browsers, `require('./mesh.js')` in Node.js) exporting:
- `generateOuterPolygon(shape, diameter, opts)`
- `generateHolePolygon(peg, clearance)`
- `buildBaseMesh(params, figure)`
- `buildTestGaugeMesh(startDia, step, count)`
- `buildCalibrationBlockMesh(outerSize, rimWidth, height)`
- `buildCalibrationLBracketMesh(armLen, armWidth, height)`
- `trianglesToBinarySTL(triangles, headerText)`

Running `node verify_mesh.js` checks:
- Zero degenerate triangles
- Zero open edges and zero non-manifold edges (every directed edge `u->v` has exactly one twin `v->u`)
- Exact binary STL byte length (`84 + triangles.length * 50`)
- Regenerates the test gauge and 70 mm calibration frame/L-bracket STLs in the workspace.
