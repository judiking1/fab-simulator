import { CameraControls, Grid } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type CameraControlsImpl from "camera-controls";
import { useRef } from "react";
import { FabTreePanel } from "@/components/panels/FabTreePanel";
import { EquipmentMeshes } from "@/components/viewport/EquipmentMeshes";
import { RailLines } from "@/components/viewport/RailLines";
import { RailNodes3D } from "@/components/viewport/RailNodes3D";
import { useDemoLayout } from "@/hooks/useDemoLayout";
import { useThemeStore } from "@/stores/themeStore";

function Viewport() {
	const cameraRef = useRef<CameraControlsImpl>(null);

	return (
		<Canvas camera={{ position: [30, 40, 30], fov: 50 }}>
			<ambientLight intensity={0.5} />
			<directionalLight position={[10, 20, 10]} intensity={1} />
			<CameraControls ref={cameraRef} makeDefault dollyToCursor minDistance={2} maxDistance={200} />
			<Grid
				args={[100, 100]}
				cellSize={1}
				cellColor="#444"
				sectionSize={10}
				sectionColor="#888"
				fadeDistance={80}
				infiniteGrid
			/>
			<EquipmentMeshes />
			<RailLines />
			<RailNodes3D />
		</Canvas>
	);
}

function App() {
	const { isDark, toggle } = useThemeStore();
	useDemoLayout();

	return (
		<div className={isDark ? "dark" : ""}>
			<div className="flex h-screen flex-col bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100">
				{/* Top Nav */}
				<header className="flex h-10 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
					<span className="text-sm font-semibold">Fab Simulator</span>
					<button
						type="button"
						onClick={toggle}
						className="rounded px-2 py-1 text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
					>
						{isDark ? "Light" : "Dark"}
					</button>
				</header>

				{/* Main Area */}
				<div className="flex flex-1 overflow-hidden">
					{/* Left Panel */}
					<aside className="w-64 overflow-y-auto border-r border-gray-200 bg-surface-light-alt p-3 dark:border-gray-700 dark:bg-surface-dark-alt">
						<FabTreePanel />
					</aside>

					{/* 3D Viewport */}
					<main className="flex-1">
						<Viewport />
					</main>

					{/* Right Panel */}
					<aside className="w-72 border-l border-gray-200 bg-surface-light-alt p-3 dark:border-gray-700 dark:bg-surface-dark-alt">
						<p className="text-xs text-gray-500">KPI Dashboard</p>
					</aside>
				</div>

				{/* Bottom Bar */}
				<footer className="flex h-10 items-center border-t border-gray-200 px-4 dark:border-gray-700">
					<p className="text-xs text-gray-500">Timeline / Playback Controls</p>
				</footer>
			</div>
		</div>
	);
}

export default App;
