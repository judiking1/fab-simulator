# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

- **Name**: fab-simulator
- **Description**: OHT(Overhead Hoist Transport) transfer efficiency test simulator for semiconductor giga-fab
- **Target**: Desktop-only web SPA (no responsive/mobile)
- **Deploy**: Vercel (static SPA)

## Domain Context

This simulator models OHT vehicle logistics in a semiconductor fabrication facility.

### Layout Hierarchy
```
Fab → Bay → Area → Module → Equipment
```
- Giga-fab scale: 3-4 mid-size fabs (1000+ OHTs each) connected
- Each level has a unique ID: `fab_id > bay_id > area_id > module_id > eq_id`
- Normalized entity store: global unique IDs + parent references for O(1) lookup

### Equipment Types (discriminated union by `type` field)
| Type | Role | FOUP Capacity | Rail Attachment |
|------|------|---------------|-----------------|
| `process` | Wafer processing (etch, litho, etc.) | 1-3 port slots | Near rail via port |
| `stocker` | Bulk FOUP storage | 10-100+ shelves | Dedicated rail node |
| `ohb` | Overhead Buffer, temporary rail-side storage | 1-2 slots | Directly on rail |

All equipment types have **ports** (load/unload points for OHT) and track **FOUP presence** per slot.

### FOUP (Front Opening Unified Pod)
The physical transport unit. OHTs carry FOUPs, not wafers directly.
- Contains wafers belonging to a lot
- Always located at exactly one place: equipment slot, OHT, or in transit
- Tracking FOUP location is critical for simulation state

### Transfer Command — Core Simulation Entity
A transfer command is the trigger that moves an OHT. The full lifecycle:
```
created → assigned → move_to_pick → arrive_at_pick → picking → pick_done
  → move_to_deposit → arrive_at_deposit → depositing → deposit_done
```
Each state transition records a **timestamp** for KPI analysis:
- Transfer time (created → deposit_done)
- Wait time (created → assigned)
- Travel time (move_to_pick duration + move_to_deposit duration)
- Pick/deposit dwell time

### Simulation Model
- **Discrete Event Simulation (DES)**: batch compute in Web Worker, then replay results in 3D
- **NOT real-time**: simulation runs to completion first, 3D viewport plays back results
- Key entities: OHT vehicles, Rail network (graph), FOUP, Transfer Commands
- Core problems: route optimization, OHT count/placement, bottleneck detection, wait time minimization

### 3D Camera System
Not simple OrbitControls — uses `CameraControls` (drei) for programmatic control via ref:
| Mode | Behavior |
|------|----------|
| `free` | WASD/drag movement, free rotation |
| `follow_oht` | Camera tracks a specific OHT during playback |
| `overview` | Top-down fab-wide view |
| `equipment_focus` | Zoom into specific equipment with smooth transition |

## Tech Stack

| Area | Tech | Notes |
|------|------|-------|
| Framework | React 19 + Vite | SPA |
| Language | TypeScript (strict) | no-any |
| 3D Engine | React Three Fiber + drei | R3F declarative 3D, CameraControls for cam |
| Validation | zod | Layout JSON schema validation + TS type inference |
| Styling | Tailwind CSS v4 | Dark/Light theme support |
| State | Zustand | Layout, sim config, results stores |
| Sim Engine | Web Worker | DES engine runs off main thread |
| Data | JSON/CSV files | No backend, no DB |
| Package Manager | pnpm | |
| Lint/Format | Biome | |

TanStack Query is NOT needed (no server/API — all local computation).

## Architecture

```
src/
├── core/                    # Simulation engine (Web Worker context)
│   ├── engine/              # DES event loop, priority queue, simulation clock
│   ├── entities/            # OHT, Equipment, Rail, FOUP data structures
│   ├── algorithms/          # Pathfinding (A*), dispatching, scheduling
│   └── network/             # Rail graph, topology, shortest path cache
├── models/                  # TypeScript interfaces for layout hierarchy
├── stores/                  # Zustand stores (layout, simConfig, simResult)
├── workers/                 # Web Worker entry points & message protocol
├── components/
│   ├── viewport/            # R3F 3D scene: rail, equipment, OHT meshes
│   ├── panels/              # Left sidebar (fab tree, params), right sidebar (KPI)
│   ├── controls/            # Simulation playback controls, timeline
│   ├── dashboard/           # Charts (throughput, wait time, utilization)
│   └── ui/                  # Shared UI primitives (buttons, inputs, etc.)
├── hooks/                   # Custom hooks (useSimulation, useLayoutTree, etc.)
├── types/                   # Shared type definitions
├── utils/                   # Pure utility functions
├── constants/               # Config constants, default parameters
├── styles/                  # Global styles, theme tokens
└── assets/                  # Static assets (icons, textures)
```

### Key Architectural Boundaries

1. **Worker ↔ Main Thread**: Communication via structured message protocol (`postMessage`). The simulation engine (`src/core/`) must be completely independent of React — no DOM, no React imports. This is enforced by the Web Worker boundary.

2. **Simulation ↔ Visualization**: Simulation produces a time-indexed event log. The 3D viewport reads this log for playback. They never run simultaneously on the same data.

3. **Layout Model ↔ 3D Scene**: Zustand layout store holds the hierarchical data model. R3F components read from the store to render. Editing the layout updates the store, which re-renders the scene.

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

- **Typed Arrays** (`Float32Array`) for OHT position data — 1000+ vehicles updated per frame during playback
- **InstancedMesh** in R3F for rendering 1000+ OHTs and equipment with a single draw call
- **Spatial indexing** for rail network pathfinding (grid or R-tree)
- **Web Worker** keeps simulation off main thread — UI stays responsive during batch compute
- **`useRef` over `useState`** for values that change every animation frame (OHT positions during playback)
- Code splitting with `React.lazy()` for dashboard/chart views

## Builder Principles

- **Boil the Lake**: Full implementation over shortcuts, but distinguish achievable "lake" from endless "ocean"
- **Search Before Building**: Check existing code/patterns/libraries before creating new
- **Anti-Sycophancy**: Take positions. "That's interesting" → judge why good/bad. Argue against strongest version of claims (no strawman)
- **Investigation-First**: No fix before root cause is identified
- **Scope Control**: >5 file changes → notify user. 3 failed attempts → escalate

## Naming Conventions

| Target | Pattern | Example |
|--------|---------|---------|
| Component files | PascalCase | `FabTree.tsx` |
| Hook/util files | camelCase | `useSimulation.ts` |
| Directories | kebab-case | `rail-network/` |
| Variables/functions | camelCase | `ohtCount`, `handleDispatch` |
| Types/interfaces | PascalCase | `OhtVehicle`, `SimulationConfig` |
| Constants | SCREAMING_SNAKE | `MAX_OHT_SPEED` |
| Boolean | is/has/should prefix | `isSimulating`, `hasBottleneck` |

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
