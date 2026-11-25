# Project Guidelines — Pop Up Parade Base Generator

## 1. Git & Branch Workflow
- Always develop and commit on the **`dev`** branch. Do **not** push directly to **`main`** (`main` deploys to GitHub Pages and is merged via Pull Request).
- Follow Semantic Versioning in [`CHANGELOG.md`](CHANGELOG.md) (log ongoing work under `## [Unreleased]`) and [`package.json`](package.json).

## 2. Automatic Documentation Updates
- Whenever adding, removing, or modifying features, UI controls, or figure presets, **automatically update all relevant documentation** without being asked:
  - [`README.md`](README.md) (features & repository contents)
  - [`docs/FEATURES.md`](docs/FEATURES.md) & [`docs/TUTORIAL.md`](docs/TUTORIAL.md)
  - [`CHANGELOG.md`](CHANGELOG.md) (`[Unreleased]`)
  - The GitHub Wiki (`Pop-Up-Parade-Base-Generator.wiki.git`), when figure measurements or printing/troubleshooting guidance changes.

## 3. Architecture & `file://` Compatibility
- Keep the web app zero-build and 100% compatible with both **`file://`** (double-clicking [`index.html`](index.html)) and **GitHub Pages**. Load scripts via standard `<script src="...">` tags—do not introduce `fetch()` calls for local data or ES module imports that break on `file://`.
- Keep all default base settings and pre-measured figure presets in [`figures.js`](figures.js) (`DEFAULT_CONFIG`) as the single source of truth.

## 4. 3D Printing Safety & Verification
- Maintain a positive default hole clearance (`0.15 mm` in `DEFAULT_CONFIG.defaults.clearance`) and keep UI/doc warnings against `0.00` clearance without physical Peg-Fit Test Gauge testing or slicer XY hole compensation.
- After any JS or mesh change, run `node --check` on modified JS files and `npm test` (`node verify_mesh.js`) to verify watertight manifold STL generation.
