# Session Plan: Fab Simulator

## Recommended Session Strategy

**Large project (3+ months)** → Multi-session orchestration with `/team-lead` for parallel work.

## Session Breakdown

### Session 1: Architect
**Role**: System design, data models, interfaces
- Layout hierarchy type definitions
- Rail network graph interface
- DES engine architecture
- Web Worker message protocol design
- Zustand store structure

### Session 2: Simulation Engine Developer
**Role**: Core DES engine + algorithms
- Event queue, simulation clock
- OHT entity behavior
- Pathfinding (A* on rail graph)
- Dispatching algorithms
- All simulation logic (runs in Web Worker, zero UI dependency)

### Session 3: 3D Viewport Developer
**Role**: R3F 3D scene + layout editor
- Fab 3D scene setup (camera, lighting, grid)
- Equipment mesh rendering (InstancedMesh)
- Rail visualization
- Layout editing interactions
- OHT playback animation
- LOD for giga-fab scale

### Session 4: UI/Dashboard Developer
**Role**: Panels, controls, charts
- Left panel: fab tree + parameter controls
- Right panel: KPI dashboard + charts
- Bottom bar: timeline + playback controls
- Dark/Light theme implementation
- Scenario comparison views

### Session 5: QA & Integration
**Role**: Testing, performance, polish
- Integration testing (sim engine ↔ visualization)
- Performance profiling (1000+ OHTs)
- Edge case handling
- File import/export validation
- Cross-browser testing

## Workflow Per Feature

```
/plan-review → /team-lead (parallel dev) → /review → /qa → /ship
```
