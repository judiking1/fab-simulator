# Roadmap: Fab Simulator

## Milestone 1: Foundation (Weeks 1-3)
> Project scaffolding + core data models + basic 3D viewport

- [x] Vite + React + TypeScript + Tailwind + Biome setup
- [x] Dark/Light theme toggle
- [ ] Layout data model: Fab → Bay → Area → Module → Equipment (Process, Stocker, OHB)
- [ ] FOUP model: carrier entity with location tracking
- [ ] Transfer Command model: state machine with timestamp tracking per transition
- [ ] Rail network graph data structure (nodes, edges, directionality)
- [ ] Normalized Zustand stores: LayoutStore (entity map + children), SimConfigStore
- [ ] CameraControls setup: free movement, overview mode, zoom-to-entity
- [ ] Basic R3F viewport: grid, placeholder equipment boxes, rail lines
- [ ] Layout file import/export (JSON with zod validation)

## Milestone 2: Layout Editor (Weeks 4-6)
> Interactive fab layout creation and editing in 3D

- [ ] Fab hierarchy tree panel (left sidebar)
- [ ] 3D equipment placement (drag & drop or coordinate input)
- [ ] Rail path editor: draw rail segments in 3D, set directionality
- [ ] Equipment port configuration (input/output ports for OHT pick/drop)
- [ ] Stocker and OHB placement
- [ ] Bay/Area boundary visualization
- [ ] Layout validation (connected rail graph, reachable equipment)

## Milestone 3: Simulation Engine (Weeks 7-10)
> DES engine in Web Worker + Transfer Command state machine

- [ ] Web Worker setup with typed message protocol
- [ ] DES core: priority event queue, simulation clock, event loop
- [ ] OHT entity: position, state (idle/carrying), current FOUP reference
- [ ] FOUP tracking: location state (at equipment / on OHT / in transit)
- [ ] Transfer Command state machine: full lifecycle (created → deposit_done)
- [ ] Timestamp recording per state transition for KPI extraction
- [ ] Rail network pathfinding (A* on graph)
- [ ] Basic dispatching: FIFO assignment to nearest idle OHT
- [ ] Equipment port model: FOUP slot management, pick/deposit operations
- [ ] Stocker/OHB buffer logic: temporary storage, capacity constraints
- [ ] Simulation run: config in → transfer event log out
- [ ] Progress reporting (Worker → Main thread percentage updates)

## Milestone 4: Playback & Dashboard (Weeks 11-13)
> 3D result playback + KPI visualization

- [ ] Timeline component: play, pause, step, speed control
- [ ] OHT movement animation (InstancedMesh for 1000+ vehicles)
- [ ] FOUP visualization on OHTs and at equipment ports
- [ ] Equipment status color coding during playback (idle/processing/waiting)
- [ ] Camera modes: OHT follow, equipment focus, fab overview with smooth transitions
- [ ] Right panel: KPI dashboard
  - Throughput (FOUPs/hour, lots/hour)
  - Transfer time breakdown (wait / travel / pick dwell / deposit dwell)
  - OHT utilization rate
  - Equipment utilization rate
  - Stocker/OHB occupancy rates
- [ ] Transfer history table: per-command timeline with state transitions
- [ ] Bottleneck heatmap overlay on rail segments
- [ ] Simulation result export (CSV)

## Milestone 5: Scenario Comparison (Weeks 14-16)
> Parameter tuning + multi-run comparison

- [ ] Parameter panel: OHT count, speed, dispatching algorithm selection
- [ ] Multiple dispatching algorithms (FIFO, nearest-first, priority-based)
- [ ] Scenario save/load
- [ ] Side-by-side comparison view (2 simulation results)
- [ ] Delta charts: "before vs after" for key metrics
- [ ] Sensitivity analysis: sweep a parameter range, plot metric curves

## Milestone 6: Giga-Fab Scale (Weeks 17-20)
> Scale from single bay to full giga-fab

- [ ] Multi-fab layout support (3-4 connected fabs)
- [ ] Inter-fab transfer rails and OHT handoff logic
- [ ] LOD (Level of Detail) rendering for zoom levels
- [ ] Spatial partitioning for large rail networks
- [ ] Performance profiling and optimization (target: 4000+ OHTs smooth playback)
- [ ] Hierarchical drill-down: fab overview → bay detail → equipment detail

## Future Considerations (Post-MVP)

- Advanced dispatching algorithms (ML-based, real-time optimization)
- Historical data import from real fab MES/MCS systems
- Multi-user collaboration (add backend)
- Server-side simulation for very large scale
- Preventive maintenance simulation (OHT breakdowns, rail closures)
- Integration with real OHT controller protocols
