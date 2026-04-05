# ADR-005: Map Editor Architecture

**Status**: Proposed
**Date**: 2026-04-05

## Context
Milestone 5 introduces visual map editing — the ability to create and modify rail networks directly
in the 3D viewport. ADR-004 established the data model constraints that editor operations impose
(bay presets, batch creation, rail type parameters). This ADR defines the editor's interaction model,
tool system, undo/redo strategy, and implementation phases.

The editor must coexist with the existing view/simulation workflow. Users should be able to switch
between viewing/simulating and editing without data loss or mode confusion.

## Decisions

### 1. Editor Modes

Two top-level modes govern how the viewport interprets user input:

| Mode | Camera | Click Behavior | Selection |
|------|--------|---------------|-----------|
| **View** (default) | Orbit/pan/zoom freely | Select entity → show info in right panel | Read-only |
| **Edit** | Orbit/pan/zoom freely | Depends on active tool (place, connect, attach) | Read-write |

**Mode toggle:**
- Toolbar button (pencil icon) in the header bar — visual indicator of current mode
- Keyboard shortcut: `Tab` toggles between View and Edit
- Entering Edit mode disables simulation controls (cannot edit while simulating)
- Exiting Edit mode with unsaved changes shows a confirmation prompt

**Rationale:** A hard mode boundary prevents accidental edits during observation. Disabling simulation
during editing avoids race conditions between sim worker updates and editor mutations.

### 2. Editor Tool System

Within Edit mode, exactly one tool is active at a time. Tools are organized by entity type.

#### 2.1 Node Tools

| Tool | Activation | Interaction | Validation |
|------|-----------|-------------|------------|
| **Place Node** | `N` key or toolbar | Click on ground plane → create node at intersection point | Min distance from existing nodes (configurable, default 50mm) |
| **Move Node** | Click existing node → drag | Drag node on ground plane (Y locked) → connected rails recalc via dirty flags | Cannot overlap another node |
| **Delete Node** | Select node → `Delete` key | Removes node only if zero rails attached | Block if any rail references this node |

**Move Node detail:** Moving a node triggers the dirty flag chain from ADR-003:
Node moved → adjacencyMap lookup → dirtyRailIds → useFrame recalcs curves → port positions update.
This is imperative (Layer 2/3), no React re-render needed.

#### 2.2 Rail Tools

| Tool | Activation | Interaction | Validation |
|------|-----------|-------------|------------|
| **Create Rail** | `R` key or toolbar | Click fromNode → ghost preview appears → click toNode → rail created | Nodes must be distinct; duplicate rail check |
| **Change Type** | Select rail → property panel dropdown | Change railType, set radius if curve type | Type-specific validation per ADR-004 table |
| **Delete Rail** | Select rail → `Delete` key | Remove rail + cascade delete attached ports | Confirm if ports exist on rail |

**Create Rail flow:**
1. User activates Rail tool
2. Click first node → node highlights (green ring)
3. Mouse moves → ghost rail renders from first node to cursor (snapping to nearby nodes)
4. Click second node → rail type selector appears (default: LINEAR)
5. Confirm → rail created with auto-generated ID

#### 2.3 Port Tools

| Tool | Activation | Interaction | Validation |
|------|-----------|-------------|------------|
| **Attach Port** | `P` key or toolbar | Click on rail → port placed at click ratio | Minimum spacing between ports on same rail |
| **Set Type** | Select port → property panel | Choose equipmentType (EQ/STK/OHB), portType, side | Valid enum values only |
| **Delete Port** | Select port → `Delete` key | Remove port | No cascade needed |

**Attach Port flow:**
1. User activates Port tool
2. Hover over rail → rail highlights, cursor shows ratio indicator (0.0-1.0)
3. Click → port created at computed ratio
4. Property panel opens for type configuration

### 3. Bay Management

Bays are the primary organizational unit — ordered rail lists forming closed loops.

#### 3.1 Auto-Detection
```
detectClosedLoops(railIds: string[]): string[][]
```
Given a set of selected rails, find all minimal closed loops by traversing the directed graph.
Each loop becomes a Bay candidate. User confirms or discards.

#### 3.2 Manual Creation
1. User selects multiple rails (Shift+click or box select)
2. "Create Bay" button in toolbar or context menu
3. System validates: do selected rails form a closed loop?
   - Yes → Bay created with ordered rail sequence (CCW by default)
   - No → error message: "Selected rails do not form a closed loop"

#### 3.3 Bay Presets
Bay presets (defined in ADR-004) are template-based:
1. User opens preset browser (panel or modal)
2. Selects preset (e.g., "8-port standard bay", "16-port high-density bay")
3. Ghost preview appears at cursor position
4. Click to place → `batchCreate()` atomically creates all nodes, rails, ports, and bay record
5. User can rotate preset before placement (R key cycles 90-degree increments)

#### 3.4 Bay Transform
- **Move Bay**: Select bay in tree panel → drag handle appears at bay centroid → drag moves all bay nodes
- **Rotate Bay**: Select bay → rotation handle at centroid → rotate around Y axis
- Both operations update all bay node positions → dirty flag chain handles rail/port recalculation
- Implementation: transform is applied to each node individually, leveraging existing move-node pipeline

### 4. Undo/Redo System

Command pattern with grouped operations for atomic undo.

#### 4.1 Command Interface
```typescript
interface EditorCommand {
  readonly type: string;
  execute(): void;    // Apply the change
  undo(): void;       // Reverse the change
}
```

#### 4.2 Command Types
| Command | Execute | Undo |
|---------|---------|------|
| `AddNode` | Insert node into store | Remove node from store |
| `MoveNode` | Set node position to new coords | Set node position to old coords |
| `DeleteNode` | Remove node from store | Re-insert node with original data |
| `AddRail` | Insert rail into store + update adjacency | Remove rail + update adjacency |
| `DeleteRail` | Remove rail + cascade ports | Re-insert rail + re-insert ports |
| `AddPort` | Insert port into store | Remove port from store |
| `DeletePort` | Remove port from store | Re-insert port with original data |
| `ModifyProperty` | Set new property value | Set old property value |
| `BatchCreate` | Insert all entities (bay preset) | Remove all entities |

#### 4.3 Grouping
Some user actions produce multiple commands that should undo as one unit:
- Bay preset placement: AddNode x N + AddRail x M + AddPort x K + AddBay
- Delete rail with ports: DeletePort x K + DeleteRail

These are wrapped in a `CompositeCommand` that executes/undoes all children atomically.

#### 4.4 Stack Management
```typescript
interface UndoManager {
  undoStack: EditorCommand[];   // Most recent at top
  redoStack: EditorCommand[];   // Cleared on new command
  maxHistory: number;           // Default: 100 commands
  execute(cmd: EditorCommand): void;   // Run + push to undoStack + clear redoStack
  undo(): void;                        // Pop undoStack → undo → push to redoStack
  redo(): void;                        // Pop redoStack → execute → push to undoStack
}
```

**Design choice — per-action, not per-entity:** Each user gesture is one undo step regardless of how
many entities it touches. This matches user expectation: "undo" reverses the last thing they did.

### 5. Ghost Preview System

Visual feedback before committing a placement action.

#### 5.1 Rail Ghost
- Renders when Rail tool is active and first node is selected
- Semi-transparent mesh (opacity 0.3) following cursor from first node to hover position
- Snaps to nearby nodes within a configurable radius (default: 100mm) — snapped node shows green highlight
- Direction arrow rendered along ghost rail (small cone at midpoint)
- Color: same as rail type color but at reduced opacity

#### 5.2 Bay Preset Ghost
- Full bay outline rendered at cursor position
- Semi-transparent (opacity 0.2) with wireframe overlay
- Rotatable before placement (visual rotation indicator)
- Snaps to grid if grid-snap is enabled

#### 5.3 Port Ghost
- When Port tool hovers over a rail, show a small marker at the computed ratio
- Ratio value displayed as floating label (e.g., "0.45")
- Marker color indicates equipment type (set from current selection)

#### 5.4 Implementation
Ghost previews are rendered in a separate R3F group that:
- Is excluded from raycasting (no self-intersection)
- Updates every frame based on pointer position (useFrame, not React state)
- Uses the same geometry builders as real entities (curve cache for rail ghosts)

### 6. Validation and Feedback

#### 6.1 Real-Time Validation (during editing)
Continuous visual indicators while in Edit mode:
- **Disconnected nodes**: Nodes with zero rails → yellow warning ring
- **Open-loop bays**: Bays whose rail sequence does not close → orange highlight on gap
- **Orphan ports**: Ports on rails not belonging to any bay → yellow dot indicator
- **Duplicate rails**: Two rails with same fromNode+toNode → red highlight on both

#### 6.2 Pre-Simulation Validation
Called when user attempts to start simulation on an edited map:
```typescript
validateMap(): MapValidation   // Defined in ADR-004
```
Blocking errors prevent simulation start. Warnings allow start with acknowledgment.

| Severity | Example | Behavior |
|----------|---------|----------|
| Error | No bays defined | Block sim start |
| Error | Bay rail sequence not closed | Block sim start |
| Warning | Disconnected bay clusters | Allow with warning |
| Warning | Port unreachable from any bay | Allow with warning |
| Info | Node with single rail (dead end) | Display only |

#### 6.3 Visual Feedback
- **Success**: Green flash on created entity, fades over 300ms
- **Error**: Red shake animation on invalid target, toast message with reason
- **Snap**: Subtle pulse on snap target node when cursor enters snap radius
- **Selection**: Blue outline on selected entity, brighter for multi-select

### 7. Save/Load System

#### 7.1 Native Format (.fab.json)
Primary save format (schema defined in ADR-002):
- Preserves all metadata, grouping, bay definitions, presets
- Versioned schema for future migration
- Save: `Ctrl+S` opens save dialog (or overwrites current file)
- Load: `Ctrl+O` opens file picker filtered to `.fab.json`

#### 7.2 Auto-Save
- Saves to `localStorage` every 60 seconds while in Edit mode
- Key: `fab-simulator:autosave:{mapName}`
- On app load: check for autosave, offer to restore if found
- Auto-save is per-map, keeps only the latest snapshot
- Maximum autosave size: 10MB (warn if approaching)

#### 7.3 Custom CSV Export
Export to our CSV format (ADR-003): `nodes.csv`, `rails.csv`, `ports.csv`
- Coordinates already in Y-up convention (no transform needed)
- Strips metadata/grouping not representable in CSV
- User chooses export directory via file picker

#### 7.4 VOS CSV Export
Compatibility export to VOS format: `node.map`, `edge.map`, `station.map`
- Applies inverse coordinate transform (Y-up → VOS editor coords)
- Maps our terms back to VOS column names
- Fills VOS-only columns with sensible defaults
- This is a lossy export — VOS format cannot represent all our metadata

### 8. Keyboard Shortcuts

All shortcuts active only in Edit mode unless noted otherwise.

| Shortcut | Action | Mode |
|----------|--------|------|
| `Tab` | Toggle View/Edit mode | Global |
| `N` | Activate Node tool | Edit |
| `R` | Activate Rail tool | Edit |
| `P` | Activate Port tool | Edit |
| `B` | Activate Bay tool | Edit |
| `Escape` | Cancel current operation / deselect | Edit |
| `Delete` | Delete selected entity | Edit |
| `Ctrl+Z` | Undo | Edit |
| `Ctrl+Shift+Z` | Redo | Edit |
| `Ctrl+S` | Save | Global |
| `Ctrl+O` | Open/Load | Global |
| `G` | Toggle grid snap | Edit |
| `Shift+Click` | Add to selection (multi-select) | Edit |

### 9. Implementation Phases

Split into phases to maintain bisectable, shippable increments.

#### Phase 1: Basic Node and Rail CRUD
**Scope**: Minimal editing — create, move, delete nodes and rails.
- Editor mode toggle (View/Edit) with toolbar indicator
- Node tool: place on ground plane, move via drag, delete
- Rail tool: connect two nodes (LINEAR type only), delete
- Selection system: click to select, `Delete` to remove
- Dirty flag integration with existing 3-layer rendering
- **Exit criteria**: Create a simple rail path from scratch, see it render in 3D.

#### Phase 2: Port Editing and Property Panel
**Scope**: Complete entity editing with property inspection.
- Port tool: attach to rail at ratio, delete
- Property panel: edit attributes of selected node/rail/port
- Rail type selection (all types from ADR-004 table)
- Equipment type selection for ports
- **Exit criteria**: Create rail network with ports, configure all properties via panel.

#### Phase 3: Bay Management and Presets
**Scope**: Organizational grouping and template-based creation.
- Manual bay creation from selected rails
- Auto-detect closed loops
- Bay preset browser and placement
- `batchCreate()` for atomic bay insertion
- Bay display in left panel tree
- **Exit criteria**: Place a bay from preset, create custom bay from rails, see bay hierarchy.

#### Phase 4: Ghost Preview, Snap, and Undo/Redo
**Scope**: Editor UX polish for production-quality editing.
- Ghost preview for rail and port placement
- Snap-to-node system with visual feedback
- Undo/redo with command pattern (all Phase 1-3 operations)
- CompositeCommand for grouped undo
- Direction arrows on ghost rails
- **Exit criteria**: Full undo/redo coverage, ghost preview on all placement tools, snap working.

#### Phase 5: Save/Load and Export
**Scope**: Persistence and interoperability.
- `.fab.json` save and load
- Auto-save to localStorage
- Custom CSV export (our format)
- VOS CSV export (compatibility)
- Validation feedback (real-time + pre-simulation)
- **Exit criteria**: Create map from scratch → save → reload → run simulation → export to CSV.

## Consequences

### Positive
- Hard View/Edit mode boundary prevents accidental edits and sim-edit race conditions
- Command pattern undo enables reliable multi-step reversal, including composite bay operations
- Phased implementation keeps each increment shippable and testable
- Ghost preview and snap-to-node reduce placement errors significantly
- 3-layer rendering from ADR-003 means node dragging is already cheap (imperative updates only)

### Negative
- Mode switching adds one extra step vs always-editable (acceptable for data safety)
- Command pattern adds boilerplate for each new operation type
- Ghost preview requires duplicating geometry builders for transparent rendering
- Auto-save to localStorage has size limits (~5-10MB depending on browser)

### Risks
- Bay auto-detection on large graphs could be expensive — may need to limit to selected subgraph
- Undo stack memory for large editing sessions — mitigated by maxHistory cap (100 commands)
- Complex curve types (CSC_CURVE_HETE with 6 control nodes) may need specialized placement UX beyond simple two-node click — defer detailed design to Phase 2 implementation
