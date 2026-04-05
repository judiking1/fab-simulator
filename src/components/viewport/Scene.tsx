/**
 * Scene — Main R3F canvas component for the 3D viewport.
 *
 * Sets up the Three.js scene with:
 *   - Camera (perspective, positioned for fab overview)
 *   - Lighting (ambient + directional, no shadows for performance)
 *   - CameraControls (drei) for WASD/drag navigation
 *   - Grid floor (subtle reference grid)
 *   - RailRenderer and PortRenderer (InstancedMesh-based)
 */

import { CameraControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { PortRenderer } from "./PortRenderer";
import { RailRenderer } from "./RailRenderer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_COLOR = "#1a1a2e";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Scene(): React.JSX.Element {
	return (
		<Canvas
			camera={{ position: [0, 50, 50], fov: 60, near: 0.1, far: 10000 }}
			gl={{ antialias: true }}
			style={{ width: "100%", height: "100%" }}
		>
			{/* Minimal lighting — ambient + single directional, no shadows */}
			<ambientLight intensity={0.6} />
			<directionalLight position={[50, 80, 20]} intensity={0.8} />

			{/* Camera controls — drei CameraControls for programmatic control */}
			<CameraControls makeDefault />

			{/* Subtle reference grid on the ground plane */}
			<gridHelper args={[1000, 100, GRID_COLOR, GRID_COLOR]} />

			{/* Layer 3 renderers */}
			<RailRenderer />
			<PortRenderer />
		</Canvas>
	);
}
