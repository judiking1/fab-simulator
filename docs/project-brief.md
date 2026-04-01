# Project Brief: Fab Simulator

## Problem Statement

Semiconductor giga-fabs need to optimize OHT (Overhead Hoist Transport) logistics to maximize wafer throughput. Current approach relies on expensive commercial simulation tools or inflexible in-house systems. A web-based simulator enables engineers to quickly test different OHT configurations without specialized software installation.

## Target Persona

**Fab Engineer / Operator**
- Deep domain knowledge of semiconductor manufacturing processes
- Understands OHT rail systems, bay layouts, equipment configurations
- Needs to test "what-if" scenarios: more OHTs, different rail layouts, priority changes
- Comfortable with technical interfaces but values clear data visualization
- Works on desktop workstations with large monitors

## Domain Model

### Equipment Types
- **Process Equipment**: Performs wafer processing (etch, litho, deposition, etc.). Has FOUP port slots (1-3).
- **Stocker**: Bulk FOUP storage facility. High capacity (10-100+ shelves).
- **OHB (Overhead Buffer)**: Small temporary buffer (1-2 slots) mounted directly on rail. Used for staging FOUPs near equipment.

### FOUP (Front Opening Unified Pod)
The physical carrier that OHTs transport. Contains wafers belonging to a lot. Always located at exactly one place (equipment slot, OHT, or in transit).

### Transfer Command Lifecycle
The core unit of simulation. A command triggers OHT movement:
```
created → assigned → move_to_pick → arrive_at_pick → picking → pick_done
  → move_to_deposit → arrive_at_deposit → depositing → deposit_done
```
Each state transition is timestamped for KPI extraction (transfer time, wait time, travel time, dwell time).

## Core Features (MVP)

1. **Fab Layout Editor** — Hierarchical layout (Fab → Bay → Area → Module → Equipment) with 3D rail and equipment placement. Supports Process Equipment, Stocker, and OHB types.
2. **OHT Simulation Engine** — DES with Transfer Command state machine: OHT dispatching, pathfinding on rail network, FOUP pick/drop at equipment ports
3. **Efficiency Dashboard** — KPI metrics per transfer: throughput, transfer time breakdown (wait/travel/dwell), OHT utilization, equipment utilization, bottleneck identification
4. **Scenario Comparison** — Adjust parameters (OHT count, rail layout, dispatching priority) and compare transfer efficiency across runs
5. **3D Camera System** — Free movement, OHT follow mode, equipment focus zoom, fab overview

## Scale Requirements

- Giga-fab: 3-4 connected mid-size fabs
- 1000+ OHT vehicles per fab
- Thousands of equipment nodes (process EQ, stockers, OHBs)
- Layout hierarchy: `fab_id > bay_id > area_id > module_id > eq_id`

## Premise Challenge Results

| Question | Answer |
|----------|--------|
| Right problem? | Yes — OHT logistics is a proven bottleneck in fab operations |
| Why not status quo? | Existing in-house tools lack flexibility; commercial tools require expensive licenses |
| Existing solutions? | AutoMod, FlexSim, AnyLogic exist but are costly and not web-based |
| Narrowest wedge? | Single bay with 10-50 OHTs → validate core sim engine → scale to giga-fab |

## Chosen Approach

**Ideal Architecture** — Modular architecture designed for giga-fab scale from day one. Simulation engine in Web Worker (batch compute), 3D visualization via React Three Fiber (playback mode), hierarchical Zustand stores for layout management.

## Non-Goals (for now)

- Real-time animated simulation (batch → replay instead)
- Mobile/tablet support
- Multi-user collaboration
- Server-side computation
- Database storage (file-based JSON/CSV)
