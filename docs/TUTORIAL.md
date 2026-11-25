# Step-by-Step Tutorial: Creating Your First Uniform PUP Base

This guide walks you through measuring a POP UP PARADE figure, designing a uniform base style, and exporting a watertight STL ready for your 3D printer.

---

## Step 1: Print the Calibration & Fit-Test Tools (Optional, Recommended)

Before designing bases for your whole shelf, print two small helper tools:

1. **Peg-Fit Test Gauge** (~10 min print):
   - Use [`pup_peg_fit_test_gauge_1.8_to_6.2mm.stl`](../pup_peg_fit_test_gauge_1.8_to_6.2mm.stl) (or click **Download Peg-Fit Test Gauge STL** in the app header).
   - Test your figure's foot pegs in the numbered holes (1.8 mm to 6.2 mm in 0.2 mm steps) to find the exact diameter that slides in snugly without forcing.
2. **Photo Calibration Frame** (only needed if you don't have calipers):
   - Print [`pup_photo_calibration_frame_70mm.stl`](../pup_photo_calibration_frame_70mm.stl) (a 70×70 mm square frame) or [`pup_photo_calibration_l_bracket_70mm.stl`](../pup_photo_calibration_l_bracket_70mm.stl) (a 70×70 mm L-bracket for poses where a closed frame won't fit around the feet).

---

## Step 2: Select or Create Your Figure

1. Open [`index.html`](../index.html) in your browser.
2. Under **2. Your Figures** (left panel), click an existing preset to inspect/edit it, or click **+ Add Custom Figure** to create a new entry.

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
   - Set **Hole Clearance (+mm)** (`0.00` if you already used the physical Test Gauge or Auto-Detect Base Holes; `0.15–0.25` if you measured raw peg diameters and want printing tolerance).
8. Click **Apply to Active Figure**.

### Method B: Calipers (Manual Entry)

1. Measure each peg's diameter, peg length (depth), and center-to-center distance.
2. Under **3. Peg Layout & Measurements**:
   - Use **Distance & Angle** mode for standard 2-peg stances (enter **Peg-to-Peg Dist (mm)**, **Stance Angle (°)**, and optional **Center Offset X / Y**).
   - Use **Manual X / Y** mode for 1-peg, 3-peg, or asymmetric stances.
3. For each peg card, set:
   - **Diameter (mm)** and **Depth (mm)**
   - **Peg Shape**: `Round`, `Hexagon (Keyed)`, `D-Shape (Keyed)`, `Round + Square Key`, or `Oval / Slot`
   - **Key Angle (°)** (for keyed shapes) or **Through** (for round through-holes)
4. Set **Hole Clearance (+mm)** to `0` if your caliper measurement already accounts for fit, or `0.15–0.25` mm for typical FDM tolerance.

---

## Step 4: Customize Your Uniform Base Style

In **1. Uniform Base Style** (left panel), configure the shared look for all your figures:

1. **Base Shape**: Pick `Circle`, `Hexagon (Flat-Top — Classic PUP)`, `Hexagon (Pointy-Top)`, `Octagon`, `Rounded Square`, or `Rounded Rectangle`.
2. **Width / Diameter (mm)** and **Thickness (mm)**: E.g., `65–103.65 mm` wide and `6–14 mm` thick (ensure thickness exceeds your deepest blind peg depth, or enable **Through** for round holes).
3. Optional styling:
   - **Top Chamfer**: Adds a clean beveled top edge.
   - **Stepped Plinth**: Creates a 2-tier beveled display base (**Step Inset** and **Lower Tier Height**).
   - **Underside Magnet Pocket**: Adds a centered bottom recess (e.g., `8.2 mm` × `2.2 mm` for an 8×2 mm magnet or steel washer).
   - **Hollow Shell (Face-Down Print — Experimental)**: Hollows the underside with internal peg bosses so the base prints face-down like an injection-molded PUP base.

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

1. Click **Download STL** to export the active figure's base, or **Download All Measured STLs** to batch-export every figure marked as measured.
2. **Slicing Tips**:
   - **Solid / Stepped Bases**: Print right-side up (flat bottom on the build plate). `0.16–0.20 mm` layer height, `15–20%` gyroid infill, 3–4 walls. No supports needed.
   - **Hollow Shell Bases**: Print **face-down** (top display surface on the build plate) for a smooth textured/PEI top finish.
3. **Backup Your Collection**: Click **Export Config JSON** in the header to save all your figures and base settings to a portable `.json` file.
