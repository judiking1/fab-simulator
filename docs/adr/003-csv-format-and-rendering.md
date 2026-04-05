# ADR-003: Custom CSV Format and 3-Layer Rendering Architecture

**Status**: Accepted
**Date**: 2026-04-05

## Context
1. VOS CSV files contain many columns irrelevant to simulation
2. VOS terminology (edge, station) should not leak into our codebase
3. CRUD operations on map data (e.g., moving a node) could trigger expensive re-renders of thousands of elements

## Decisions

### 1. Custom CSV Format (no VOS terms)

Define our own CSV format with simulation-relevant columns only.
VOS CSV import is a separate adapter that maps VOS columns → our format.

**nodes.csv**
```csv
id,x,y,z
N0001,-192.539,3.8,135.481
```
- Coordinates already in Y-up Three.js convention (no axis swap needed)
- No barcode, no editor_* prefix

**rails.csv**
```csv
id,fromNodeId,toNodeId,railType,length,bayId,fabId,speed,acc,dec,radius,curveNodes
R0001,N0001,N0002,LINEAR,4920.0,BAY01,fab01,300.0,2.0,-3.0,-1,
```
- Removed: fle, tle, ole, vcu_rail_type, vcu_direction, rail_status, waiting_point, check_length, origin_from/to, rotation, rail_id
- `curveNodes` is JSON array string for complex curves only

**ports.csv**
```csv
id,railId,ratio,equipmentType,equipmentId,portType,bayId,fabId,side,areaId,moduleId,zoneId
P0001,R0400,0.548,OHB,OHBC01,bidirectional,BAY12,fab01,overhead,,,
```
- Designed for queryability: any column can be used for filtering
- Optional grouping columns (areaId, moduleId, zoneId) nullable

### 2. VOS CSV Import Adapter

Separate module that:
1. Reads VOS node.map, edge.map, station.map
2. Applies coordinate axis swap (editor_x→X, editor_z→Y, editor_y→Z)
3. Converts barcode_x → rail+ratio via binary search
4. Maps VOS column names to our column names
5. Drops unused columns
6. Outputs our internal model objects

This adapter is the ONLY place VOS terms exist.

### 3. 3-Layer Rendering Architecture

Prevents CRUD operations from causing full re-renders of 3000+ elements.

```
Layer 1: Zustand Store (Source of Truth)
├── nodeMap: Map<string, NodeData>       // CRUD target
├── railMap: Map<string, RailData>       // CRUD target
├── portMap: Map<string, PortData>       // CRUD target
└── adjacencyMap: Map<nodeId, railId[]>  // Auto-maintained index

Layer 2: Geometry Cache (React-external, ref-based)
├── railCurveCache: Map<railId, CachedCurve>
├── railSoA: Float32Array buffers
├── portPositionCache: Map<portId, Vector3>
└── dirtyRailIds: Set<string>

Layer 3: InstancedMesh (imperative update in useFrame)
└─��� Only updates matrices for dirty indices
```

**Key rules:**
- React components subscribe to Zustand via narrow selectors (entity count, specific ID)
- InstancedMesh count changes → React re-render (rare: add/delete rail)
- InstancedMesh matrix changes → imperative setMatrixAt (frequent: move node)
- Geometry cache lives in refs, bypasses React render cycle
- Dirty flag propagation: Node change → mark connected Rails dirty → useFrame recalculates

**Dirty flag chain:**
```
Node moved → adjacencyMap lookup → dirtyRailIds.add(...)
  → useFrame: recalc dirty curves → update SoA slice → setMatrixAt
  → recalc port positions on dirty rails → update port instances
```
