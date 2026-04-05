# Project Brief: fab-simulator

## Problem Statement

Semiconductor giga-fabs use OHT (Overhead Hoist Transport) systems with 1000+ vehicles to move FOUPs between process equipment. Currently:

- **VOS** (Vehicle Operation Supervision) handles 3D visualization via React Three Fiber
- **VCU** (Vehicle Control Unit) handles routing/dispatching via C++ + MQTT

These are separate apps communicating over MQTT, making it impossible to:
1. Run high-speed simulation (MQTT latency + deadlocks at scale)
2. Edit rail maps visually (manual CSV editing required)
3. Perform what-if analysis (no batch/speedup capability)

## Solution

A standalone web SPA that merges VOS visualization + VCU control logic into one app, adding:
- **Map Editor**: Visual rail network editing (like RollerCoaster Tycoon track builder)
- **Auto Simulation**: Built-in routing, dispatching, collision — no external dependencies
- **Speed Control**: 1x to 32x simulation speed
- **Statistics Dashboard**: Real-time KPI tracking and analysis

## Target Persona

**Fab Automation Engineer**
- Domain: Semiconductor fabrication facility logistics
- Technical level: Engineering degree, familiar with OHT systems
- Goal: Optimize OHT count, rail layout, throughput, minimize wait times
- Context: Uses this tool for planning new fab layouts or optimizing existing ones
- Pain point: No way to quickly test "what if we add 50 more OHTs?" or "what if we reroute this bay?"

## Core Features (Priority Order)

### P0 — Must Have (MVP)
1. **CSV Map Import**: Parse VOS-format node/edge/station CSV files
2. **3D Rail Rendering**: Visualize rail network with linear + curved edges
3. **3D Equipment Rendering**: EQ, STK, OHB at correct positions
4. **OHT Movement**: Vehicles move along rails using edge+ratio model
5. **Auto Routing**: Dijkstra pathfinding on rail graph
6. **Auto Dispatching**: Generate transfers, assign OHTs
7. **Collision Avoidance**: Sensor-based stop/decelerate

### P1 — Important
8. **Speed Control**: Variable simulation speed (1x~32x)
9. **Map Editor**: Create/edit nodes, edges, locations visually
10. **Map Export**: Save edited maps as CSV
11. **Info Panel**: Selected vehicle/edge/location details
12. **Basic Statistics**: Throughput, transfer count, utilization

### P2 — Nice to Have
13. **Map Presets**: Pre-built bay/fab templates
14. **Advanced Dashboard**: ECharts-based KPI charts, heatmaps
15. **Hierarchy Grouping**: Organize edges/locations into bay/area/module
16. **Transfer Table**: AG Grid with transfer log, filtering, export
17. **Camera Modes**: Follow OHT, overview, equipment focus

## Competitive Analysis

| Feature | VOS+VCU | FlexSim | fab-simulator |
|---------|---------|---------|---------------|
| OHT domain-specific | Yes | No | Yes |
| Visual map editor | No | Yes | Yes (planned) |
| Speed control | Limited | Yes | Yes |
| Cost | Internal | $$$$ | Free |
| VOS map compatibility | Native | No | Import/Export |
| Web-based | Electron | Desktop | Web SPA |

## Premise Challenge Results

1. **Real problem?** Yes — no existing tool combines VOS-compatible 3D viz with autonomous simulation and map editing
2. **Status quo sufficient?** No — MQTT communication prevents high-speed simulation, CSV manual editing is error-prone
3. **Existing solutions?** Commercial simulators exist but lack semiconductor OHT domain specificity and VOS compatibility
4. **Narrowest wedge**: Import VOS CSV -> render 3D -> OHTs move autonomously. This alone proves the VOS+VCU merger concept.
