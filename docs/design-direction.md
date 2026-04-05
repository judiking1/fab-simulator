# Design Direction

## Design Tone
**Modern Dashboard** — Clean, dark-theme-first industrial tool aesthetic.
Inspiration: Linear, Figma, Grafana dark mode.

## Color Scheme
- **Primary**: Dark theme (near-black backgrounds, subtle borders)
- **Accent**: Blue/cyan for interactive elements (rail highlights, selected OHT)
- **Status colors**:
  - Idle OHT: gray
  - Moving: blue/cyan
  - Loading/Unloading: amber/yellow
  - Error/Stopped: red
  - Selected: white/bright highlight
- **Equipment**:
  - EQ: muted green
  - STK: muted purple
  - OHB: muted orange

## Layout Structure
```
+-----------------------------------------------------+
|  Header Bar (app title, mode toggle, settings)       |
+----------+---------------------------+--------------+
|          |                           |              |
|  Left    |    3D Viewport            |   Right      |
|  Panel   |    (main area)            |   Panel      |
|          |                           |              |
|  - Map   |                           |  - Info      |
|    Tree  |                           |  - Stats     |
|  - Editor|                           |  - Vehicle   |
|    Tools |                           |    Search    |
|          |                           |              |
+----------+---------------------------+--------------+
|  Bottom Bar (simulation controls, speed, timeline)   |
+-----------------------------------------------------+
```

- **3D Viewport**: Center, takes maximum available space
- **Left Panel**: Collapsible. Map tree browser, editor tools
- **Right Panel**: Collapsible. Info display, statistics, vehicle search
- **Bottom Bar**: Simulation playback controls, speed slider, status indicators
- **Panels are resizable** via drag handles

## Component Library
- **shadcn/ui** for all UI controls (buttons, inputs, selects, tabs, dialogs)
- **Tailwind CSS v4** for layout and custom styling
- **Dark theme by default**, light theme optional

## Typography
- **Monospace** for data values (IDs, coordinates, ratios)
- **Sans-serif** (system font stack) for labels and UI text
- Small font sizes for dense information panels

## 3D Visual Style
- **Rails**: Colored tubes/lines with direction arrows (animated texture like VOS)
- **Equipment**: Simple 3D boxes with type-specific colors, port markers
- **OHTs**: Small box meshes, color-coded by state, InstancedMesh for performance
- **FOUPs**: Small colored box on OHT or at port location
- **Grid floor**: Subtle reference grid
- **Minimal lighting**: Ambient + single directional, no shadows (performance)
