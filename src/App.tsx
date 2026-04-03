import { CameraControls, Grid } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type CameraControlsImpl from "camera-controls";
import { useCallback, useMemo, useRef } from "react";
import { PlaybackControls } from "@/components/controls/PlaybackControls";
import { KpiSummaryPanel } from "@/components/dashboard/KpiSummaryPanel";
import { TransferTable } from "@/components/dashboard/TransferTable";
import { FabTreePanel } from "@/components/panels/FabTreePanel";
import { PropertyPanel } from "@/components/panels/PropertyPanel";
import { SimConfigPanel } from "@/components/panels/SimConfigPanel";
import { EquipmentMeshes } from "@/components/viewport/EquipmentMeshes";
import { FoupMesh } from "@/components/viewport/FoupMesh";
import { OhtMeshes } from "@/components/viewport/OhtMeshes";
import { RailLines } from "@/components/viewport/RailLines";
import { RailNodes3D } from "@/components/viewport/RailNodes3D";
import { buildSelectedEntityInfo, ViewportOverlay } from "@/components/viewport/ViewportOverlay";
import { useDemoLayout } from "@/hooks/useDemoLayout";
import { useLayoutFile } from "@/hooks/useLayoutFile";
import { usePlayback } from "@/hooks/usePlayback";
import type { Oht } from "@/models/oht";
import { useSimResultStore } from "@/stores/simResultStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { useThemeStore } from "@/stores/themeStore";
import type { EntityId } from "@/types/common";
import type { OhtSnapshot } from "@/types/simulation";

// OHTs are managed by simulation, not the layout store.
const EMPTY_OHTS: Record<EntityId, Oht> = {};

interface ViewportProps {
	ohtPositions?: Record<EntityId, OhtSnapshot>;
}

function Viewport({ ohtPositions }: ViewportProps): React.ReactElement {
	const cameraRef = useRef<CameraControlsImpl>(null);
	const railEdges = useLayoutStore((s) => s.railEdges);
	const railNodes = useLayoutStore((s) => s.railNodes);
	const foups = useLayoutStore((s) => s.foups);
	const equipment = useLayoutStore((s) => s.equipment);

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
			<OhtMeshes
				ohts={EMPTY_OHTS}
				railEdges={railEdges}
				railNodes={railNodes}
				ohtPositions={ohtPositions}
			/>
			<FoupMesh
				foups={foups}
				ohts={EMPTY_OHTS}
				equipment={equipment}
				railEdges={railEdges}
				railNodes={railNodes}
			/>
		</Canvas>
	);
}

function App(): React.ReactElement {
	const { isDark, toggle } = useThemeStore();
	const { exportLayout, importLayout, isImporting } = useLayoutFile();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const simKpiSummary = useSimResultStore((s) => s.result?.kpiSummary ?? null);
	useDemoLayout();

	// Playback state
	const playback = usePlayback();
	const ohtPositions = playback.currentSnapshot?.ohtPositions;

	// Overlay data
	const selectedEntityId = useLayoutStore((s) => s.selectedEntityId);
	const selectedEntityType = useLayoutStore((s) => s.selectedEntityType);
	const equipment = useLayoutStore((s) => s.equipment);
	const railNodes = useLayoutStore((s) => s.railNodes);
	const railEdges = useLayoutStore((s) => s.railEdges);

	const selectedEntity = useMemo(
		() =>
			buildSelectedEntityInfo({
				selectedEntityId,
				selectedEntityType,
				equipment,
				ohts: {},
				railNodes,
				railEdges,
			}),
		[selectedEntityId, selectedEntityType, equipment, railNodes, railEdges],
	);

	const handleImportClick = useCallback((): void => {
		fileInputRef.current?.click();
	}, []);

	const handleFileChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
			const file = e.target.files?.[0];
			if (!file) return;
			const result = await importLayout(file);
			if (!result.success) {
				// Use alert for now; can replace with toast later
				window.alert(`Import failed: ${result.error ?? "Unknown error"}`);
			}
			// Reset input so the same file can be re-imported
			e.target.value = "";
		},
		[importLayout],
	);

	return (
		<div className={isDark ? "dark" : ""}>
			<div className="flex h-screen flex-col bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100">
				{/* Top Nav */}
				<header className="flex h-10 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
					<span className="text-sm font-semibold">Fab Simulator</span>
					<div className="flex items-center gap-2">
						<input
							ref={fileInputRef}
							type="file"
							accept=".json"
							className="hidden"
							onChange={handleFileChange}
						/>
						<button
							type="button"
							onClick={handleImportClick}
							disabled={isImporting}
							className="rounded px-2 py-1 text-xs hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
						>
							{isImporting ? "Importing..." : "Import"}
						</button>
						<button
							type="button"
							onClick={exportLayout}
							className="rounded px-2 py-1 text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
						>
							Export
						</button>
						<button
							type="button"
							onClick={toggle}
							className="rounded px-2 py-1 text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
						>
							{isDark ? "Light" : "Dark"}
						</button>
					</div>
				</header>

				{/* Main Area */}
				<div className="flex flex-1 overflow-hidden">
					{/* Left Panel: Tree + Properties */}
					<aside className="flex w-64 flex-col overflow-hidden border-r border-gray-200 bg-surface-light-alt dark:border-gray-700 dark:bg-surface-dark-alt">
						<div className="flex-1 overflow-y-auto p-3">
							<FabTreePanel />
						</div>
						<div className="border-t border-gray-200 dark:border-gray-700">
							<div className="max-h-64 overflow-y-auto p-3">
								<PropertyPanel />
							</div>
						</div>
					</aside>

					{/* 3D Viewport with overlay */}
					<main className="relative flex-1">
						<Viewport ohtPositions={ohtPositions} />
						<ViewportOverlay
							simTime={null}
							ohtCount={0}
							activeTransferCount={0}
							selectedEntity={selectedEntity}
						/>
					</main>

					{/* Right Panel: SimConfig + KPI + Transfer Table */}
					<aside className="flex w-72 flex-col overflow-hidden border-l border-gray-200 bg-surface-light-alt dark:border-gray-700 dark:bg-surface-dark-alt">
						<div className="flex-1 overflow-y-auto p-3">
							<SimConfigPanel />
						</div>
						<div className="border-t border-gray-200 p-3 dark:border-gray-700">
							<KpiSummaryPanel kpiSummary={simKpiSummary} />
						</div>
						<div className="border-t border-gray-200 p-3 dark:border-gray-700">
							<TransferTable transfers={[]} />
						</div>
					</aside>
				</div>

				{/* Bottom Bar — Playback Controls */}
				<footer className="flex h-10 items-center border-t border-gray-200 dark:border-gray-700">
					<PlaybackControls
						currentTime={playback.currentTime}
						duration={playback.duration}
						isPlaying={playback.isPlaying}
						playbackSpeed={playback.playbackSpeed}
						onTogglePlay={playback.togglePlay}
						onSeek={playback.seek}
						onSetSpeed={playback.setSpeed}
					/>
				</footer>
			</div>
		</div>
	);
}

export default App;
