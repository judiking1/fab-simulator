# Roadmap

## Approach: Bottom-Up Incremental
Each milestone delivers a working, testable result. Later milestones build on earlier ones.

---

## Milestone 1: Map Import & 3D Rendering
**Goal**: Import VOS CSV -> see rail network in 3D

### Tasks
- [ ] CSV parser for node.map, edge.map, station.map formats
- [ ] Internal data model (RailNode, RailEdge, Location types)
- [ ] Zustand map store with normalized data
- [ ] R3F canvas setup with CameraControls
- [ ] Rail edge rendering (linear + curves) with InstancedMesh
- [ ] Node rendering
- [ ] Equipment rendering (EQ/STK/OHB) at station positions
- [ ] Basic camera controls (pan, zoom, rotate)
- [ ] Dark theme UI shell (header, viewport, placeholder panels)

**Exit criteria**: Load VOS CSV files -> see the full fab rail network and equipment in 3D.

---

## Milestone 2: OHT Movement
**Goal**: OHTs move along rails autonomously

### Tasks
- [ ] OHT vehicle model (edge+ratio position, state machine)
- [ ] Dijkstra pathfinding on rail graph
- [ ] Edge+ratio -> 3D position interpolation (linear + curve)
- [ ] OHT InstancedMesh rendering with state-based colors
- [ ] Basic simulation loop in Web Worker (tick-based)
- [ ] Vehicle spawning on specified edges
- [ ] Speed calculation (acceleration, deceleration, curve limits)
- [ ] Simple collision avoidance (sensor zones)
- [ ] Simulation controls (start, pause, reset)
- [ ] Speed control slider (1x ~ 32x)

**Exit criteria**: Spawn OHTs on map -> they move along edges, avoid collisions, respond to speed changes.

---

## Milestone 3: Transfer System
**Goal**: FOUPs move between equipment via OHT transfers

### Tasks
- [ ] FOUP model (location tracking)
- [ ] Transfer command model (lifecycle states)
- [ ] Auto transfer generator (random or pattern-based)
- [ ] Dispatcher: assign idle OHT to pending transfer
- [ ] Transfer execution: pick -> move -> drop flow
- [ ] Pickup/dropdown animation (arm movement)
- [ ] Location port occupancy tracking
- [ ] Transfer status visualization

**Exit criteria**: Transfers auto-generated -> OHTs pick up FOUPs -> deliver to destinations -> cycle repeats.

---

## Milestone 4: Information Panels
**Goal**: View details about selected entities

### Tasks
- [ ] Entity selection (click OHT/edge/equipment in 3D)
- [ ] Right panel: Vehicle info (ID, state, edge, ratio, speed, FOUP)
- [ ] Right panel: Edge info (type, length, speed limit, bay)
- [ ] Right panel: Equipment info (type, ports, FOUPs)
- [ ] Left panel: Map tree browser (fab -> bay -> edges/locations)
- [ ] Vehicle search and filter
- [ ] Bottom bar: Simulation status, vehicle count, transfer count

**Exit criteria**: Click any entity -> see full details in side panel. Browse map hierarchy.

---

## Milestone 5: Map Editor
**Goal**: Create and edit rail networks visually

### Tasks
- [ ] Editor mode toggle (view mode vs edit mode)
- [ ] Create node (click to place)
- [ ] Create edge (click two nodes to connect)
- [ ] Edge type selection (linear, curve with radius)
- [ ] Create location/port (attach to edge)
- [ ] Move node (drag to reposition, connected edges update)
- [ ] Delete node/edge/location
- [ ] Property editor (select -> edit attributes in panel)
- [ ] Undo/redo
- [ ] CSV export (save map to VOS-compatible format)
- [ ] Bay preset templates (pre-built loop patterns)

**Exit criteria**: Create a small rail network from scratch -> add equipment -> run simulation on it.

---

## Milestone 6: Statistics Dashboard
**Goal**: Analyze simulation performance with charts and tables

### Tasks
- [ ] KPI calculation engine (throughput, utilization, wait time, cycle time)
- [ ] KPI summary cards (real-time updating)
- [ ] Throughput trend chart (ECharts line chart)
- [ ] Transfer log table (AG Grid with filter/sort/export)
- [ ] Bay-to-bay transfer heatmap
- [ ] OHT utilization chart
- [ ] Edge traffic density overlay on 3D view
- [ ] Bottleneck detection and highlighting

**Exit criteria**: Run simulation -> see real-time KPI dashboard -> export transfer data.

---

## Milestone 7: Polish & Advanced Features
**Goal**: Production-quality UX and advanced capabilities

### Tasks
- [ ] Camera modes (follow OHT, overview, equipment focus)
- [ ] Confluence lock visualization
- [ ] Advanced dispatching algorithms (nearest-first, zone-based)
- [ ] Map save/load to browser (localStorage or IndexedDB)
- [ ] Fab-level presets (full fab template maps)
- [ ] Hierarchy grouping UI (bay -> area -> module)
- [ ] Performance optimization pass (profiling, LOD)
- [ ] Dark/light theme toggle
- [ ] Keyboard shortcuts
