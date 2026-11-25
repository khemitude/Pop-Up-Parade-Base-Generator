# Step-by-Step Tutorial: Creating Your First Uniform PUP Base

This guide walks you through measuring a POP UP PARADE figure, designing a uniform base style, and exporting a watertight STL ready for your 3D printer.

---

## Step 1: Print the Calibration & Fit-Test Tools (Optional, Recommended)

Before designing bases for your whole shelf, print two small helper tools:

1. **Peg-Fit Test Gauge** (~10 min print):
   - Use [`pup_peg_fit_test_gauge_1.8_to_6.2mm.stl`](../pup_peg_fit_test_gauge_1.8_to_6.2mm.stl) (or pick a range from the **Gauge** dropdown in the app header—`1.8–6.2mm (0.2mm)`, `3.0–5.0mm (0.1mm Fine)`, or `3.6–4.6mm (0.1mm Micro)`—and click **Download Gauge STL**).
   - Test your figure's foot pegs in the numbered holes (1.8 mm to 6.2 mm in 0.2 mm steps) to find the exact diameter that slides in snugly without forcing.
2. **Photo Calibration Frame** (only needed if you don't have calipers):
   - Print [`pup_photo_calibration_frame_70mm.stl`](../pup_photo_calibration_frame_70mm.stl) (a 70×70 mm square frame) or [`pup_photo_calibration_l_bracket_70mm.stl`](../pup_photo_calibration_l_bracket_70mm.stl) (a 70×70 mm L-bracket for poses where a closed frame won't fit around the feet).

---

## Step 2: Select or Create Your Figure

1. Open [`index.html`](../index.html) in your browser.
2. Under **2. Your Figures** (left panel), use the search box to filter by name, group, or notes and click an existing preset to inspect/edit it, or click **+ Add Custom Figure** to create a new entry.

---

## Step 3: Measure the Figure's Pegs

Choose **Method A** if you want to measure from a photo, or **Method B** if you have digital calipers.

### Method A: Photo Peg Measurer (No Calipers)

1. Place the **70×70 mm Calibration Frame** (or **L-Bracket**, a **Credit/ID Card**, or a **Standard 103.65 mm PUP Hex Base**) flat on the same plane as the soles of the figure's feet.
   - *Tip*: If you're measuring an existing flat original base, you can place the original base inside the 70×70 mm frame and photograph it from directly above.
2. Take a top-down photo (avoid extreme angles, though perspective correction will compensate for moderate tilt).
3. In the right panel (**3. Peg Layout & Measurements**), click **Measure Pegs from Photo (No Calipers)**.
4. Load your photo by clicking **Upload Photo**, dragging and dropping it onto the canvas, or pressing `Ctrl+V` to paste from clipboard.
5. **Calibrate**:
   - Select your reference under **1. Calibration Reference**.
   - If using the 70×70 mm Frame, click **Auto-Detect Frame Corners** (or manually click the 4 outer corners in order).
   - Once calibrated, the badge turns green (e.g., `4 / 4 pts`) and an optional 10 mm perspective-corrected grid overlays the photo.
6. **Measure Each Peg**:
   - **Auto-Detect Base Holes** (best when photographing a flat original base inside the 70 mm frame), *or*
   - Choose a manual tool under **2. Measure Pegs**:
     - **3-Pt Circle**: Click 3 points around a peg or hole rim to compute both center and diameter.
     - **2-Pt Edge**: Click opposite edges of a peg.
     - **1-Pt Center**: Enter the pin diameter you found with the **Peg-Fit Test Gauge** and click the center of each peg.
7. **Orientation & Options**:
   - Check **Auto-center pegs around base (0, 0)** to keep the figure centered on the base.
   - Check **Mirror X (only if looking up at soles)** *only* if your photo was taken looking up at the bottom of the figure's feet (flipping left/right so the top-down base matches).
   - Set **Figure Facing in Photo** to match which edge of the photo the figure is facing (`Bottom (-Y)` is default).
   - Set **Hole Clearance (+mm)** to **`0.15–0.20 mm`** by default so holes have safe printing tolerance (`0.00` only if you already tested the exact hole on the physical **Peg-Fit Test Gauge** or have XY hole compensation enabled in your slicer).

> **Important — Always Keep a Hole Tolerance:** 3D-printed holes almost always shrink slightly inward. Printing with `0.00` clearance and no slicer XY hole compensation can make holes too tight and **snap fragile figure pegs**—never force a tight peg into a hole.
8. Click **Apply to Active Figure**.

### Method B: Calipers (Manual Entry)

1. Measure each peg's diameter, peg length (depth), and center-to-center distance.
2. Under **3. Peg Layout & Measurements**:
   - Use **Distance & Angle** mode for standard 2-peg stances (enter **Peg-to-Peg Dist (mm)**, **Stance Angle (°)**, and optional **Center Offset X / Y**).
   - Use **Center-to-Center (C2C) Distances** for 3-peg triangles: enter your measured `P1 ↔ P2`, `P1 ↔ P3`, and `P2 ↔ P3` distances and click **Apply C2C → X / Y** (use **Flip** if the triangle is mirrored, then rotate as needed).
   - Use **Manual X / Y** mode for 1-peg or direct coordinate adjustments.
3. For each peg card, set:
   - **Diameter (mm)** and **Depth (mm)**
   - **Peg Shape**: `Round`, `Hexagon (Keyed)`, `D-Shape (Keyed)`, `Round + Square Key`, or `Oval / Slot`
   - **Key Angle (°)** (for keyed shapes) or **Through** (for round through-holes)
4. Set **Hole Clearance (+mm)** to **`0.15–0.20 mm`** (recommended for FDM even when measuring with calipers, unless you use XY hole compensation in your slicer or already verified the exact fit on the **Peg-Fit Test Gauge**). Never force a tight peg—if it resists, widen the hole or increase clearance.

---

## Step 4: Customize Your Uniform Base Style

In **1. Uniform Base Style** (left panel), configure the shared look for all your figures:

1. **Base Shape**: Pick `Circle`, `Hexagon (Flat-Top — Classic PUP)`, `Hexagon (Pointy-Top)`, `Octagon`, `Rounded Square`, or `Rounded Rectangle`.
2. **Width / Diameter (mm)** and **Thickness (mm)**: E.g., `65–103.65 mm` wide and `6–14 mm` thick (ensure thickness exceeds your deepest blind peg depth, or enable **Through** for round holes).
3. Optional styling:
   - **Top Chamfer**: Adds a clean beveled top edge.
   - **Stepped Plinth**: Creates a 2-tier beveled display base (**Step Inset** and **Lower Tier Height**).
   - **Underside Magnet Pocket**: Adds a centered bottom recess (e.g., `8.2 mm` × `2.2 mm` for an 8×2 mm magnet or steel washer).
   - **Hollow Shell (Face-Down Print)**: Hollows the underside with internal peg bosses so the base prints face-down like an injection-molded PUP base. When paired with **Stepped Plinth**, it automatically adds an internal 45° chamfer so the step overhang prints cleanly without supports.
   - **Stamp Figure Name on Underside (Hollow Shell)**: Embosses the figure's name on the inner cavity floor—handy when batch-printing multiple bases.

---

## Step 5: Preview & Verify

- **3D Isometric Preview**: Drag to rotate, scroll to zoom, and click **Flip Bottom** to inspect underside magnet pockets, hollow bosses, or through-holes.
- **Top-Down 1:1 Blueprint**: Shows the base outline and peg holes on a 10 mm grid.
  - **Drag** a peg to reposition it, or **Right-drag / `Shift+drag`** to rotate the peg group.
  - Use **Center Holes** or the **Rotate ±15° / ±90° / 180°** buttons to align the figure's facing direction.
- Confirm the status bar reads: `Mesh ready — watertight manifold geometry.`
- Check **Mark this figure as Measured & Verified** when you're happy with the layout.

---

## Step 6: Export STL & 3D Print

1. Click **Download Fit-Test Disc (3 mm)** first if you want a ~10-minute flat test wafer to verify pin spacing and fit before printing the full plinth, **Download STL** for the active figure's full base, or **Download All Measured STLs (.zip)** to batch-export every figure marked as measured into a single `.zip` file.
2. **Slicing Tips**:
   - **Solid / Stepped Bases**: Print right-side up (flat bottom on the build plate). `0.16–0.20 mm` layer height, `15–20%` gyroid infill, 3–4 walls. No supports needed.
   - **Hollow Shell Bases**: Print **face-down** (top display surface on the build plate) for a smooth textured/PEI top finish.
3. **Backup & Share**: Click **Export Config JSON** in the header to back up your entire collection, or use **Export Figure JSON**, **Copy Shareable Figure Link**, and **Merge Figure(s)** under **2. Your Figures** to share or import individual figures.
