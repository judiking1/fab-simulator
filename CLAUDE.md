# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

- **Name**: fab-simulator
- **Description**: Standalone OHT logistics simulator for semiconductor giga-fab — map editor + auto-simulation + 3D visualization in one app
- **Motivation**: Merge VOS (3D visualization) + VCU (vehicle control) into a single web SPA with built-in map editing and autonomous simulation
- **Target**: Desktop-only web SPA (no responsive/mobile)
- **Deploy**: Vercel (static SPA)

## Domain Context

This simulator models OHT (Overhead Hoist Transport) vehicle logistics in a semiconductor fabrication facility.

### Terminology (our terms, NOT VOS terms)

| Concept | Our Term | VOS Term | Notes |
|---------|----------|----------|-------|
| Waypoint | **Node** | node | Graph vertex |
| Rail segment | **Rail** | edge | Directed: fromNode → toNode |
| Load/unload point | **Port** | station | Attached to Rail at ratio |
| Rail loop group | **Bay** | bay | Closed CCW loop |
| Equipment group | **Module** | (none) | Future: user-defined |
| Bay group | **Area** | (none) | Future: user-defined |

VOS terms appear ONLY inside the VOS import adapter — everywhere else uses our terms.

### Core Data Model

**Node** — Waypoints in 3D space (Y-up coordinate system)
**Rail** — Directed rail segments connecting nodes. Types: LINEAR, CURVE, LEFT_CURVE, RIGHT_CURVE, S_CURVE, CSC_CURVE
**Port** — Load/unload points on equipment (EQ, STK, OHB), attached to a Rail at a ratio
**Bay** — Ordered list of Rails forming a closed loop (default: counter-clockwise)

### Position Model
Everything is positioned by **rail + ratio (0.0~1.0)**:
- `ratio = 0.0` → at fromNode
- `ratio = 1.0` → at toNode
- OHT movement = ratio advancing along rail sequence

### File Format
- **Native**: `.fab.json` — full model with metadata, grouping, presets
- **Custom CSV**: `nodes.csv`, `rails.csv`, `ports.csv` — our terms, simulation-relevant columns only
- **VOS Import**: Separate adapter converts VOS `.map` files → internal model (only place VOS terms exist)
- **VOS Export**: Internal model → VOS `.map` CSV (compatibility layer)

### Coordinate System
CSV (editor space) → Three.js (world space): `editor_x→X, editor_z→Y(up), editor_y→Z(depth)`
This swap happens ONLY in CSV parser. Internal model uses Y-up convention.

### Equipment Types
| Type | Role | Description |
|------|------|-------------|
| `EQ` | Process equipment | Wafer processing tools with FOUP ports |
| `STK` | Stocker | Bulk FOUP storage (automated crane) |
| `OHB` | Overhead Buffer | Temporary rail-side FOUP storage |

### FOUP (Front Opening Unified Pod)
The physical transport unit. OHTs carry FOUPs between locations.
- Always at exactly one place: location port, OHT, or in transit
- Transfer = move FOUP from source location to destination location

### Transfer Command Lifecycle
```
created → assigned → move_to_pick → arrive_at_pick → picking → pick_done
  → move_to_drop → arrive_at_drop → dropping → drop_done
```

### OHT Movement Model (from VCU)
- **Pathfinding**: Dijkstra on rail graph (edge-to-edge)
- **Three-segment routing**: START edge check → MIDDLE path search → END edge check
- **Collision avoidance**: Sensor zones (approach → brake → stop)
- **Confluence locking**: Lazy lock at junction nodes
- **Speed control**: Per-edge speed limits, acceleration/deceleration, curve speed reduction

### Hierarchy (future feature)
```
Fab → Bay → (Area → Module →) Equipment
```
Users can group edges/locations into organizational units. This is metadata for analysis, NOT required for simulation to function.

### Simulation Model
- **Real-time simulation** (NOT batch DES): OHTs move continuously, transfers generated automatically
- **Speed control**: 1x, 2x, 4x, 8x, 16x, 32x playback speed
- **All-in-one**: No external VCU/MQTT — routing, dispatching, collision all internal
- **Web Worker**: Simulation tick runs off main thread

### 3D Camera System
Uses `CameraControls` (drei) for programmatic control:
| Mode | Behavior |
|------|----------|
| `free` | WASD/drag movement, free rotation |
| `follow_oht` | Camera tracks a specific OHT |
| `overview` | Top-down fab-wide view |
| `equipment_focus` | Zoom into specific equipment |

## Tech Stack

| Area | Tech | Notes |
|------|------|-------|
| Framework | React 19 + Vite | SPA |
| Language | TypeScript (strict) | no-any |
| 3D Engine | React Three Fiber + drei | R3F declarative 3D, CameraControls |
| UI Components | shadcn/ui | Modern, Tailwind-based, customizable |
| Styling | Tailwind CSS v4 | Dark theme primary |
| State | Zustand | Map, simulation, UI stores |
| Charts | ECharts | High-performance canvas charts |
| Data Grid | AG Grid | Large dataset tables |
| Sim Engine | Web Worker | Simulation tick off main thread |
| Data | CSV/JSON import/export | No backend, no DB |
| Package Manager | pnpm | |
| Lint/Format | Biome | |

## Architecture

```
src/
├── core/                    # Simulation engine (Web Worker context)
│   ├── engine/              # Simulation loop, clock, speed control
│   ├── pathfinding/         # Dijkstra router, graph traversal
│   ├── dispatcher/          # Auto transfer generation & OHT assignment
│   ├── collision/           # Sensor-based collision avoidance
│   └── vehicle/             # OHT state machine, movement physics
├── models/                  # TypeScript interfaces & types
│   ├── node.ts              # RailNode
│   ├── edge.ts              # RailEdge (with curve geometry)
│   ├── location.ts          # Location/Port (EQ, STK, OHB)
│   ├── vehicle.ts           # OHT vehicle state
│   ├── transfer.ts          # Transfer command
│   └── map.ts               # MapData (nodes + edges + locations)
├── stores/                  # Zustand stores
│   ├── mapStore.ts          # Rail network data (nodes, edges, locations)
│   ├── vehicleStore.ts      # OHT fleet state
│   ├── simStore.ts          # Simulation config & runtime state
│   └── uiStore.ts           # UI state (panels, selection, camera)
├── workers/                 # Web Worker entry points
│   └── simWorker.ts         # Simulation tick worker
├── components/
│   ├── viewport/            # R3F 3D scene
│   │   ├── Scene.tsx        # Main canvas setup
│   │   ├── RailEdges.tsx    # InstancedMesh rail rendering
│   │   ├── RailNodes.tsx    # Node markers
│   │   ├── Equipment.tsx    # EQ/STK/OHB instances
│   │   ├── Vehicles.tsx     # OHT InstancedMesh
│   │   └── Camera.tsx       # CameraControls modes
│   ├── editor/              # Map editor UI
│   │   ├── EditorToolbar.tsx
│   │   ├── NodeEditor.tsx
│   │   ├── EdgeEditor.tsx
│   │   └── LocationEditor.tsx
│   ├── panels/              # Side panels
│   │   ├── InfoPanel.tsx    # Vehicle/edge/location info
│   │   ├── MapTreePanel.tsx # Hierarchical map browser
│   │   └── SimPanel.tsx     # Simulation controls
│   ├── dashboard/           # Statistics & charts
│   │   ├── KpiCards.tsx
│   │   ├── ThroughputChart.tsx
│   │   ├── TransferTable.tsx
│   │   └── HeatmapChart.tsx
│   └── ui/                  # shadcn/ui components
├── parsers/                 # CSV/JSON import/export
│   ├── csvParser.ts         # Parse VOS-format CSV maps
│   └── csvExporter.ts       # Export to CSV
├── hooks/                   # Custom hooks
├── utils/                   # Pure utility functions
├── constants/               # Config constants
└── assets/                  # Static assets
```

### Key Architectural Boundaries

1. **Worker ↔ Main Thread**: Simulation engine in `src/core/` is pure logic — no DOM, no React. Communicates via `postMessage` with typed protocol.

2. **Simulation ↔ Visualization**: Simulation updates vehicle positions (edge+ratio). Main thread interpolates 3D positions from edge geometry every frame. They run concurrently (not batch-then-replay).

3. **Map Data ↔ 3D Scene (3-Layer Architecture)**:
   - **Layer 1**: Zustand store (source of truth, CRUD operations)
   - **Layer 2**: Geometry cache (refs, curve cache, SoA buffers, dirty flags)
   - **Layer 3**: InstancedMesh (imperative setMatrixAt, only dirty indices)
   - Node CRUD → dirty flag → useFrame recalcs only affected rails/ports
   - React re-renders ONLY when entity count changes (add/delete), NOT on position updates

4. **Import ↔ Internal Model**: VOS import adapter is separate from internal CSV format. Internal model uses own terms (Rail/Port/Node). Map editor works on internal model directly.

## Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Dev server (Vite)
pnpm build                # Production build
pnpm preview              # Preview production build
pnpm check                # Biome lint + format check
pnpm check:fix            # Biome auto-fix
pnpm test                 # Run tests (Vitest)
pnpm test <pattern>       # Run single test file
```

## Performance Considerations

- **Float32Array** for OHT position/rotation data — 1000+ vehicles updated per frame
- **InstancedMesh** for OHTs, equipment, rail segments — single draw call per category
- **Edge curve cache**: Pre-sample CatmullRomCurve3 points (VOS uses 500 samples/curve)
- **Web Worker** for simulation tick — main thread only renders
- **useRef over useState** for per-frame data (positions, rotations)
- **SoA (Structure of Arrays)** for batch geometry data
- **RAF chunking** for heavy operations (CSV parsing, path generation)
- Code splitting with `React.lazy()` for dashboard views

## Builder Principles

- **Boil the Lake**: Full implementation over shortcuts, but distinguish achievable "lake" from endless "ocean"
- **Search Before Building**: Check existing VOS/VCU patterns before creating new
- **Anti-Sycophancy**: Take positions with evidence. No hedging.
- **Investigation-First**: No fix before root cause is identified
- **Scope Control**: >5 file changes → notify user. 3 failed attempts → escalate

## Naming Conventions

| Target | Pattern | Example |
|--------|---------|---------|
| Component files | PascalCase | `RailEdges.tsx` |
| Hook/util files | camelCase | `useSimulation.ts` |
| Directories | kebab-case | `rail-network/` |
| Variables/functions | camelCase | `ohtCount`, `handleDispatch` |
| Types/interfaces | PascalCase | `RailEdge`, `OhtVehicle` |
| Constants | SCREAMING_SNAKE | `MAX_OHT_SPEED` |
| Boolean | is/has/should prefix | `isSimulating`, `hasFoup` |

## TypeScript Rules

- `any` forbidden → `unknown` + type guards
- Explicit return types on all public functions
- `interface` preferred (`type` only for unions/intersections)
- `as const` objects instead of `enum`
- Minimize `as` type assertions

## Git Rules

- **Branch**: `main` + `feat/`, `fix/`, `refactor/`
- **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`, `chore:`)

## Detailed Rules

> Auto-loaded from `.claude/rules/`:
> - `typescript.md`, `components.md`, `performance.md`
> - `error-handling.md`, `design-system.md`, `git-workflow.md`, `safety.md`
