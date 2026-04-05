# ADR-001: Technical Decisions

**Status**: Accepted
**Date**: 2026-04-05

## Context
Building a standalone OHT logistics simulator that merges VOS (3D viz) + VCU (control logic) functionality into a single web SPA.

## Decisions

### 1. Real-time Simulation over Batch DES

**Decision**: Run simulation in real-time (with speed control) instead of batch Discrete Event Simulation.

**Why**:
- VOS already demonstrates real-time OHT movement with edge+ratio model
- Users need to observe OHT behavior as it happens, not replay recorded results
- Speed control (1x-32x) gives the batch analysis benefit without losing interactivity
- Batch DES was the previous approach and led to architectural misalignment

**Trade-off**: More complex state synchronization between sim worker and renderer, but matches VOS's proven architecture.

### 2. Edge+Ratio Position Model (from VOS/VCU)

**Decision**: Use `(edgeId, ratio: 0.0~1.0)` as the canonical position model.

**Why**:
- Proven at scale in VOS (1000+ OHTs)
- Natural for rail-constrained movement
- Efficient: no continuous XYZ tracking, just ratio advancement
- 3D position derived via edge curve interpolation at render time

### 3. CSV Import as Foundation

**Decision**: Start with VOS CSV format (node.map, edge.map, station.map) as the import format, build internal model from it.

**Why**:
- Immediate compatibility with existing VOS map data (3249 nodes, 3929 edges)
- Proven data model — no need to reinvent the schema
- Map editor will work on internal model, export back to CSV

### 4. shadcn/ui over Ant Design

**Decision**: Use shadcn/ui instead of Ant Design (used by VOS).

**Why**:
- Tailwind-native, no CSS-in-JS overhead
- Fully customizable — own the component code
- Modern dark theme out of the box
- Smaller bundle size
- Better fit for modern dashboard aesthetic

### 5. ECharts for Data Visualization

**Decision**: Use ECharts for charts and data visualization.

**Why**:
- Canvas-based rendering handles large datasets (15000+ transfers/hour)
- Rich chart types: line, bar, heatmap, scatter, treemap
- Proven in VOS for the same domain
- Better performance than SVG-based alternatives at scale

### 6. AG Grid for Data Tables

**Decision**: Use AG Grid for tabular data (transfer logs, edge lists, etc.).

**Why**:
- Industry standard for large datasets
- Virtual scrolling, filtering, sorting out of the box
- Already proven in VOS
- Export capabilities (CSV, Excel)

### 7. Internal Simulation Engine (no MQTT)

**Decision**: Implement routing, dispatching, and collision logic directly in TypeScript, running in a Web Worker.

**Why**:
- Eliminates MQTT latency and deadlock issues at scale
- Enables true speed control (impossible with external VCU)
- Single deployment — no server dependencies
- VCU's Dijkstra routing and sensor-based collision can be ported to TypeScript

### 8. Approach: Bottom-Up Incremental

**Decision**: Build from CSV import -> 3D rendering -> OHT movement -> editor -> statistics.

**Why**:
- Each milestone produces a working, demonstrable result
- Validates VOS+VCU merger concept early
- Avoids scope explosion from parallel feature development
- Maintains motivation through frequent completion milestones
