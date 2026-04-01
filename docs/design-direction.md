# Design Direction: Fab Simulator

## Design Tone

**Industrial Dashboard** with Dark/Light mode toggle.

- Dark mode (default): High-contrast data visualization, reduced eye strain for extended use
- Light mode: Clean workspace for layout editing and documentation
- Data-dense but organized — similar to Grafana, control system UIs

## Layout Pattern

**3D Viewport-Centered + Side Panels**

```
┌──────────────────────────────────────────────┐
│ [Nav]   Fab Simulator              [▶ Run]   │
├────────┬────────────────────┬────────────────┤
│ Fab    │                    │ KPI Panel      │
│ Tree   │   3D Viewport      │ - Throughput   │
│        │   (main view)      │ - Wait Time    │
│ Param  │                    │ - Utilization  │
│ Panel  │                    │ Charts         │
├────────┴────────────────────┴────────────────┤
│ Timeline / Simulation Playback Controls      │
└──────────────────────────────────────────────┘
```

### Panel Breakdown

- **Left Panel**: Fab hierarchy tree (collapsible) + parameter adjustment controls
- **Center**: 3D viewport (R3F) — rail network, equipment, OHT vehicles
- **Right Panel**: KPI dashboard — real-time metrics during playback, charts
- **Bottom Bar**: Simulation timeline, playback speed, play/pause/step controls

## Responsive Strategy

**Desktop Only** — No mobile/tablet consideration. Designed for large monitors (1920x1080+). Panels are resizable but not collapsible to mobile layout.

## Color System

### Dark Mode (Primary)
- Background: Deep gray (`#0f1117` / `#1a1d27`)
- Surface: Medium gray (`#252830`)
- Accent: Cyan/Blue for active elements and OHT paths
- Success: Green for optimal metrics
- Warning: Amber for degraded performance
- Danger: Red for bottlenecks and critical wait times

### Light Mode
- Background: Off-white (`#f8f9fa`)
- Surface: White (`#ffffff`)
- Same semantic accent colors, adjusted for light contrast

### Data Visualization Colors
- OHT vehicles: Bright cyan
- Rail network: Neutral gray with direction indicators
- Equipment (idle): Muted blue
- Equipment (processing): Green
- Equipment (waiting for wafer): Amber/pulsing
- Bottleneck zones: Red overlay/heatmap

## 3D Viewport Design

- **Camera**: Orbit controls (rotate, zoom, pan). Top-down default, free orbit available
- **Equipment**: Simple geometric shapes (boxes) with status-based color coding
- **Rail**: Lines/tubes along 3D paths with direction arrows
- **OHT**: Small colored cubes/capsules moving along rails during playback
- **Selection**: Click to select equipment/OHT, show detail popup
- **Level of Detail (LOD)**: Simplify distant geometry when zoomed out for performance
- **Heatmap overlay**: Optional overlay showing traffic density on rail segments

## Typography

- Monospace for numerical data, metrics, IDs
- Sans-serif (system font stack) for labels and UI text
- Clear hierarchy: large KPI numbers, medium labels, small detail text
