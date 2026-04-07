/**
 * Scene — Main R3F canvas component for the 3D viewport.
 *
 * CameraControls conflict resolution:
 *   SELECT mode → left-click disabled on CameraControls (editor handles it)
 *   PAN mode → left-click enabled for CameraControls (orbit/pan)
 *   Middle-click pan + scroll zoom always work in both modes.
 */

import { CameraControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type CameraControlsImpl from "camera-controls";
import { useViewportInteraction } from "@/hooks/useViewportInteraction";
import { EDITOR_MODE } from "@/models/editor";
import { useUiStore } from "@/stores/uiStore";
import { EquipmentRenderer } from "./EquipmentRenderer";
import { LabelRenderer } from "./LabelRenderer";
import { NodeRenderer } from "./NodeRenderer";
import { PortRenderer } from "./PortRenderer";
import { RailRenderer } from "./RailRenderer";
import { SelectionOverlay } from "./SelectionOverlay";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_COLOR = "#1a1a2e";

// ---------------------------------------------------------------------------
// Inner scene content (must be inside Canvas to access useThree)
// ---------------------------------------------------------------------------

function SceneContent(): React.JSX.Element {
	useViewportInteraction(); // Binds pointer events on Canvas DOM element
	const cameraControlsRef = useRef<CameraControlsImpl>(null);
	const editorMode = useUiStore((s) => s.editorMode);

	// Toggle CameraControls left-click based on editor mode
	useEffect(() => {
		const controls = cameraControlsRef.current;
		if (!controls) return;

		if (editorMode === EDITOR_MODE.SELECT) {
			// Disable left-click rotate/pan on CameraControls — editor handles it
			controls.mouseButtons.left = 0; // ACTION.NONE
		} else {
			// VIEW/PAN mode: left-click for camera rotation
			controls.mouseButtons.left = 1; // ACTION.ROTATE
		}
	}, [editorMode]);

	return (
		<group>
			{/* Minimal lighting — ambient + single directional, no shadows */}
			<ambientLight intensity={0.6} />
			<directionalLight position={[50, 80, 20]} intensity={0.8} />

			{/* Camera controls — left-click toggled by editor mode */}
			<CameraControls ref={cameraControlsRef} makeDefault />

			{/* Subtle reference grid on the ground plane */}
			<gridHelper args={[1000, 100, GRID_COLOR, GRID_COLOR]} />

			{/* Layer 3 renderers */}
			<NodeRenderer />
			<RailRenderer />
			<PortRenderer />
			<EquipmentRenderer />

			{/* ID labels (camera-distance LOD) */}
			<LabelRenderer />

			{/* Selection highlights */}
			<SelectionOverlay />
		</group>
	);
}

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
			<SceneContent />
		</Canvas>
	);
}
