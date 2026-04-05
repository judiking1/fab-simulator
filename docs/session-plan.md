# Session Plan

## Project Scale: Large (3+ months)

## Recommended Session Strategy

This project is best tackled as **focused milestone sessions** — each session targets a specific milestone or sub-milestone, with clear entry/exit criteria.

### Session Breakdown by Milestone

#### Milestone 1: Map Import & 3D Rendering (3-4 sessions)
1. **Session 1.1**: CSV parser + data model + Zustand store
2. **Session 1.2**: R3F canvas + rail edge rendering (linear + curves)
3. **Session 1.3**: Equipment rendering + camera controls + UI shell

#### Milestone 2: OHT Movement (3-4 sessions)
4. **Session 2.1**: Vehicle model + Dijkstra router + rail graph
5. **Session 2.2**: Simulation loop (Web Worker) + speed control
6. **Session 2.3**: Collision avoidance + movement physics
7. **Session 2.4**: Integration testing + edge cases

#### Milestone 3: Transfer System (2-3 sessions)
8. **Session 3.1**: FOUP + transfer model + dispatcher
9. **Session 3.2**: Transfer execution flow + pickup/drop animation
10. **Session 3.3**: Auto transfer generation + stress testing

#### Milestone 4: Information Panels (2 sessions)
11. **Session 4.1**: Entity selection + vehicle/edge/equipment info panels
12. **Session 4.2**: Map tree browser + vehicle search + bottom bar

#### Milestone 5: Map Editor (3-4 sessions)
13. **Session 5.1**: Editor mode + node/edge creation
14. **Session 5.2**: Location editor + property panel + edge types
15. **Session 5.3**: Undo/redo + CSV export + presets

#### Milestone 6: Statistics Dashboard (2-3 sessions)
16. **Session 6.1**: KPI engine + summary cards + throughput chart
17. **Session 6.2**: Transfer table (AG Grid) + heatmap
18. **Session 6.3**: Traffic overlay + bottleneck detection

#### Milestone 7: Polish (2-3 sessions)
19. **Session 7.1**: Camera modes + advanced dispatching
20. **Session 7.2**: Map persistence + presets + hierarchy
21. **Session 7.3**: Performance optimization + final polish

### Total: ~20 sessions

## Per-Session Protocol
1. Review previous session's output
2. Set 2-3 concrete goals for the session
3. Implement with frequent check-ins
4. Test and verify before ending
5. Commit working state
6. Note any carry-over items
