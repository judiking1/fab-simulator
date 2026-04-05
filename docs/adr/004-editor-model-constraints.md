# ADR-004: Editor-Driven Model Constraints

**Status**: Accepted
**Date**: 2026-04-05

## Context
The map editor is a major differentiator of this project. While full editor UI is Milestone 5,
the data model (Milestone 1A) must support editor operations from the start.
Three editor features impose constraints on the data model:
1. Bay presets (batch creation from templates)
2. Bay-level transform and connectivity validation
3. Rail type-specific creation rules

## Decisions

### 1. Bay Preset Support

Presets are stored as relative-coordinate templates that get instantiated at a user-specified position.

**Preset format:**
```typescript
interface BayPreset {
  name: string;
  description: string;
  thumbnail?: string;
  // All coordinates relative to (0,0,0) origin
  nodes: { relX: number; relY: number; relZ: number }[];
  rails: {
    fromNodeIndex: number;     // index into nodes[]
    toNodeIndex: number;
    railType: RailType;
    radius: number;
    length: number;
  }[];
  ports: {
    railIndex: number;         // index into rails[]
    ratio: number;
    equipmentType: EquipmentType;
    portType: PortType;
    side: PortSide;
  }[];
}
```

**Model requirement:** Store must support atomic batch creation:
```typescript
batchCreate(params: {
  nodes: NodeData[];
  rails: RailData[];
  ports: PortData[];
  bayId: string;
}): void
```
All-or-nothing: if any entity fails validation, none are created.

### 2. Bay-Level Transform & Connectivity

**Bay transform:**
- Moving/rotating a Bay transforms all its Nodes
- Connected Rails automatically recalculate curves (via dirty flags)
- Ports on those Rails automatically recalculate positions

**Connectivity validation:**
```typescript
interface MapValidation {
  isValid: boolean;
  disconnectedBays: string[];     // Bays unreachable from others
  openLoopBays: string[];         // Bays whose rail sequence doesn't form closed loop
  unreachablePorts: string[];     // Ports on rails not in any Bay
  warnings: string[];             // Non-critical issues
}
```

**Model requirement:**
- Bay stores ordered `railIds` that form a closed loop
- `adjacencyMap: Map<nodeId, railId[]>` for efficient graph traversal
- `validateMap(): MapValidation` function for pre-simulation check
- Inter-bay rails (connecting two bays) are distinguishable from intra-bay rails

### 3. Rail Type-Specific Creation

Each rail type requires different parameters for curve construction:

| RailType | Required | Optional |
|----------|----------|----------|
| LINEAR | fromNodeId, toNodeId | — |
| CURVE | fromNodeId, toNodeId, radius | — |
| LEFT_CURVE | fromNodeId, toNodeId, radius | — |
| RIGHT_CURVE | fromNodeId, toNodeId, radius | — |
| S_CURVE | fromNodeId, toNodeId, radius | — |
| CSC_CURVE_HOMO | fromNodeId, toNodeId | — |
| CSC_CURVE_HETE | fromNodeId, toNodeId, curveNodeIds (6) | — |

**Model requirement:**
- `RailData` stores all curve parameters needed for reconstruction
- Curve geometry can be rebuilt from stored parameters alone (no external data needed)
- Type-specific validation at creation time

### 4. Editor UX Features (Milestone 5, not modeled now)

These features require NO model changes — purely rendering/interaction:
- Ghost preview (transparent rail preview before placement)
- Snap-to-node (highlight connectable nodes)
- Undo/redo (command pattern on store operations)
- Drag-to-move bay (transform all bay nodes)
- Loop closure highlighting
