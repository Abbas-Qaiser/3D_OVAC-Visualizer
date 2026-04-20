# 3D OVAC Visualizer

An interactive **3D Oxygen Vacancy & Conductive Filament Formation Visualizer** for memristive (RRAM) devices, built with Three.js. Designed for semiconductor physics research and device-level analysis of resistive switching mechanisms.

![Three.js](https://img.shields.io/badge/Three.js-CDN-black?logo=three.js)
![WebGL](https://img.shields.io/badge/WebGL-2.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Overview

This tool simulates the **oxygen vacancy migration** and **conductive filament (CF) formation/rupture** process inside a Metal–Insulator–Metal (MIM) memristive device. It visually demonstrates the full resistive switching cycle — from pristine state through electroforming, LRS, and back to HRS — making it a powerful tool for understanding RRAM physics.

Developed at **Sejong University, Seoul** — Semiconductor & AI Research Lab.

---

## Physics Background

In oxide-based memristors (e.g., HfOx, TaOx, TiOx):

1. **Pristine State** — The oxide layer is intact with no vacancies.
2. **Vacancy Generation** — An applied electric field drifts oxygen ions (O²⁻) toward the anode, leaving behind positively charged **oxygen vacancies (V_O)**.
3. **Electroforming** — Vacancies align along the electric field direction forming a nascent conductive filament.
4. **LRS (Low Resistance State)** — A complete conductive filament bridges the top and bottom electrodes — device is in the ON state.
5. **Partial Rupture** — Localized Joule heating begins to dissolve the filament near the weakest point.
6. **HRS (High Resistance State)** — Filament is ruptured — device is in the OFF state (RESET operation).
7. **Re-forming** — Partial re-growth of the filament upon reverse bias (SET operation).

---

## Features

- **3D Memristive Device** — cylinder or block geometry with top/bottom metal electrodes and oxide body
- **Oxygen Vacancy Visualization** — animated V_O generation and drift inside the oxide layer
- **Conductive Filament Growth/Rupture** — real-time filament formation, progressive rupture simulation
- **8 Physics Presets**:
  - Pristine
  - Vacancy Generation
  - Electroforming
  - LRS (Low Resistance State)
  - Partial Rupture
  - HRS (High Resistance State)
  - Re-forming
  - Switching Demo (full cycle animation)
- **Shape Modes** — Cylinder / Block device geometry
- **Rendering Modes** — Solid / Hollow (cutaway view) / Semi-transparent
- **5 Themes** — Dark Lab, Light Publication, White PPT, Neutral Gray, High Contrast
- **Bloom / Glow Effect** — via UnrealBloomPass for publication-quality renders
- **Download Options** — Standard image, Hi-Res 4x, Transparent background PNG
- **Interactive Controls**:
  - Filament growth direction (bottom-up / top-down)
  - Polarity (top-positive / bottom-positive)
  - Rupture location & style (progressive / abrupt)
  - Electrode color, filament color, vacancy color
  - Opacity, glow intensity, animation speed
- **Labels & Grid** — toggleable atom labels and reference grid

---

## Tech Stack

| Technology | Purpose |
|---|---|
| [Three.js](https://threejs.org/) | 3D WebGL rendering |
| OrbitControls | Mouse/touch camera orbit |
| EffectComposer + UnrealBloomPass | Post-processing bloom/glow |
| Vanilla JS + HTML5 | Zero-dependency frontend |

---

## Getting Started

No build step required — open directly in a modern browser.

```bash
git clone https://github.com/Abbas-Qaiser/3D_OVAC-Visualizer.git
cd 3D_OVAC-Visualizer
# Open index.html in Chrome / Firefox / Edge
```

> For local ES module support, serve via a local HTTP server:

```bash
npx serve .
# or
python -m http.server 8080
```

> **Requires:** WebGL 2.0 — Chrome 80+, Firefox 79+, Edge 80+

---

## File Structure

```
3D_OVAC-Visualizer/
├── index.html    # UI layout — taskbar, control panel, presets, labels
├── script.js     # Three.js scene — device geometry, vacancy/filament physics, animation
└── style.css     # Theming, panel layout, responsive controls
```

---

## Research Context

This visualizer is developed to support research in:

- **RRAM / Memristor** physics — oxide-based resistive switching
- **Oxygen vacancy dynamics** — drift, diffusion, and clustering
- **Conductive filament** formation, rupture, and re-forming mechanisms
- **Neuromorphic computing** — analog synaptic weight modulation via partial filament states
- **3D device simulation** — visualization complement to TCAD or DFT results

---

## Author

**Qaiser Abbas**
Semiconductor & AI Researcher | Integrated MS/PhD
Sejong University, Seoul, South Korea
[LinkedIn](https://www.linkedin.com/in/qaiser-sju)

---

## License

MIT License — free to use for academic and research purposes.
