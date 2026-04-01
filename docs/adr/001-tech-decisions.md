# ADR-001: Core Technology Decisions

## Status
accepted

## Date
2026-04-02

## Context
Building a giga-fab scale OHT transfer efficiency simulator. Key constraints:
- 1000+ OHT vehicles, thousands of equipment nodes
- 3D visualization of fab layout and OHT movements
- Batch simulation (not real-time) with result playback
- Desktop-only web application, no backend required
- Target users: Fab engineers familiar with OHT systems

## Decisions

### 1. Frontend-Only SPA (no backend)
All simulation runs in the browser. Layout data saved/loaded as JSON/CSV files.
- **Why**: Eliminates server infrastructure, simplifies deployment, enables offline use
- **Trade-off**: Large-scale simulations limited by client hardware. Acceptable because batch mode doesn't need real-time constraints.

### 2. React Three Fiber for 3D
R3F (React Three Fiber) + drei helper library over raw Three.js or Babylon.js.
- **Why**: Declarative React integration, strong ecosystem, easier state management bridge with Zustand
- **Trade-off**: Slight overhead vs raw Three.js. Mitigated by InstancedMesh for bulk rendering.

### 3. Web Worker for Simulation Engine
DES (Discrete Event Simulation) engine runs entirely in a Web Worker.
- **Why**: Keeps UI responsive during compute-heavy simulation. Clean architectural boundary — sim engine has zero React/DOM dependencies.
- **Trade-off**: Worker communication overhead via postMessage. Acceptable for batch mode (send config → receive full result log).

### 4. Zustand for State Management
Three primary stores: LayoutStore, SimConfigStore, SimResultStore.
- **Why**: Lightweight, works well with R3F (avoids React context re-render issues), slice pattern for large stores.
- **Trade-off**: No time-travel debugging like Redux. Acceptable for this use case.

### 5. Dark/Light Theme Support
Dual theme from the start using Tailwind CSS v4 dark mode.
- **Why**: Fab engineers often work in dimly lit clean rooms (dark mode) and bright offices (light mode).

### 6. File-Based Data (no database)
JSON for layout configs, CSV for simulation results export.
- **Why**: No server, no multi-user. Engineers can share configs via file transfer.
- **Trade-off**: No query capability, no versioning. Acceptable at this stage.

## Consequences

### Easier
- Deployment (static hosting on Vercel)
- Development (no backend to maintain)
- Offline use
- Sharing (export/import JSON configs)

### Harder
- Scaling beyond client hardware limits (future: optional server-side worker)
- Multi-user collaboration (future: add backend if needed)
- Data persistence across sessions (relies on file save/load)

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Python backend (FastAPI + SimPy) | Adds server complexity; simulation scale is manageable in browser with Web Workers |
| Babylon.js | Heavier, less React integration, higher learning curve for team |
| Electron desktop app | Limits distribution; web-based is more accessible |
| ECS pattern for sim engine | Over-engineering for current scale; DES is simpler and well-proven for logistics simulation |
| PostgreSQL | No multi-user need; file-based is simpler |
