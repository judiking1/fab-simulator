# Changelog

## [0.1.0] - 2026-04-02

### Added
- **Fab Layout Data Model**: Full hierarchy (Fab → Bay → Area → Module → Equipment) with three equipment types — Process Equipment, Stocker, and OHB (Overhead Buffer)
- **FOUP Carrier Model**: Track wafer carriers across equipment ports, storage slots, and OHT vehicles
- **Transfer Command State Machine**: 10-step lifecycle (created → deposit_done) with per-transition timestamps for KPI analysis
- **OHT Vehicle Model**: State machine for vehicle behavior (idle, moving, picking, depositing)
- **Normalized Layout Store**: Zustand store with flat entity maps and parent-child relationship tracking — O(1) entity lookup with cascading delete
- **Simulation Config Store**: OHT count, speed, pickup/deposit duration, dispatching algorithm parameters
- **Camera Store**: Four camera modes — free navigation, OHT follow, fab overview, equipment focus
- **Rail Network Graph**: Directed adjacency list with Dijkstra shortest path and weak connectivity analysis
- **Layout File I/O**: JSON import/export with Zod v4 schema validation supporting discriminated union equipment types
- **3D Viewport**: React Three Fiber scene with equipment meshes (color-coded by type), rail line rendering, and rail node visualization
- **CameraControls**: Programmatic camera control via drei CameraControls with dolly-to-cursor
- **Fab Tree Panel**: Collapsible hierarchy tree with equipment type badges (EQ/STK/OHB) and entity selection
- **Dark/Light Theme**: Toggle with Tailwind CSS v4 custom properties
- **Demo Layout**: Auto-seeded sample fab with equipment, stockers, OHB, and rail loop

### For contributors
- Web Worker boundary enforced via `tsconfig.core.json` (no DOM lib for `src/core/`)
- Biome lint + format with Tailwind CSS directive support
- 26 unit tests covering models, stores, and graph algorithms
