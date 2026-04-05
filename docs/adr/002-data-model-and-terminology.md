# ADR-002: Data Model, Terminology, and File Format

**Status**: Accepted
**Date**: 2026-04-05

## Context
The project merges VOS+VCU functionality but must establish its own identity.
VOS uses node/edge/station terminology and CSV-only files.
We need editing, grouping, and extensibility that CSV cannot support.

## Decisions

### 1. Domain Terminology

Move away from VOS/graph-theory terms to semiconductor-domain terms:

| VOS Term | Our Term | Rationale |
|----------|----------|-----------|
| `edge` | **`Rail`** | Domain-specific, immediately understood by fab engineers |
| `station` | **`Port`** | SEMI standard terminology for equipment load/unload points |
| `node` | **`Node`** | Keep — universal graph/rail term |
| `bay_name` | **`bayId`** | Keep concept, normalize naming |
| `vos_rail_type` | **`railType`** | `LINEAR`, `CURVE`, etc. |
| `rail_name` (VOS) | **`railId`** | Internal identifier |

CSV parser is the ONLY place where VOS terms appear — it maps to internal terms.

### 2. Editable Data Model

The internal model must support CRUD from day 1, not just read-from-CSV:

- All entities have auto-generatable IDs (not CSV-dependent)
- Node coordinate changes trigger connected Rail curve recalculation
- Rail creation requires explicit fromNode/toNode (directed graph)
- Port attachment to Rail is by railId + ratio (not barcode lookup)

### 3. Native File Format (.fab.json)

```typescript
interface FabMapFile {
  version: string;               // Schema version for migration
  metadata: {
    name: string;
    author?: string;
    createdAt: string;
    updatedAt: string;
    description?: string;
  };

  // Core simulation data
  nodes: Record<string, NodeData>;
  rails: Record<string, RailData>;
  ports: Record<string, PortData>;

  // Topology
  bays: Record<string, BayData>;

  // User-defined grouping (extensible)
  areas?: Record<string, AreaData>;
  modules?: Record<string, ModuleData>;

  // Simulation presets
  vehiclePresets?: VehiclePresetData[];
}
```

File strategy:
- **Import**: `.map` (VOS CSV) → parser → internal model
- **Save/Load**: `.fab.json` (native format, preserves all metadata)
- **Export**: internal model → `.map` (VOS CSV compatible)

### 4. Closed Loop & Direction Model

- Rails are **directed**: `fromNode → toNode` defines travel direction
- Bays form **closed loops** (CCW by default)
- OHTs travel only in rail direction (no reverse)
- Bay stores ordered rail list forming the loop

### 5. Coordinate System

CSV to Three.js transformation (matches VOS):
```
editor_x  → world X  (lateral)
editor_z  → world Y  (up/height)
editor_y  → world Z  (depth)
```
This swap happens ONLY in the CSV parser. Internal model uses Three.js convention (Y-up).
