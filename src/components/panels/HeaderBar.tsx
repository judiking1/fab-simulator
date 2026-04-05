/**
 * HeaderBar — Top application bar with title, import button, and map stats.
 */

import type { useMapImporter } from "@/hooks/useMapImporter";
import { selectNodeCount, selectPortCount, selectRailCount, useMapStore } from "@/stores/mapStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HeaderBarProps {
	importer: ReturnType<typeof useMapImporter>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HeaderBar({ importer }: HeaderBarProps): React.JSX.Element {
	const nodeCount = useMapStore(selectNodeCount);
	const railCount = useMapStore(selectRailCount);
	const portCount = useMapStore(selectPortCount);
	const hasMap = nodeCount > 0;

	return (
		<header className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
			{/* Left: Title */}
			<h1 className="text-sm font-semibold tracking-wide text-[var(--color-text-primary)]">
				FAB Simulator
			</h1>

			{/* Right: Import + stats */}
			<div className="flex items-center gap-3">
				{/* Map stats (shown after import) */}
				{hasMap && (
					<div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
						{importer.loadedMapName && (
							<span className="font-medium text-[var(--color-text-primary)]">
								{importer.loadedMapName}
							</span>
						)}
						<span>Nodes: {nodeCount}</span>
						<span>Rails: {railCount}</span>
						<span>Ports: {portCount}</span>
					</div>
				)}

				{/* Error indicator */}
				{importer.error && (
					<button
						type="button"
						onClick={importer.clearError}
						className="text-xs text-[var(--color-status-error)] hover:underline"
						title={importer.error}
					>
						Import Error
					</button>
				)}

				{/* Hidden file input */}
				<input
					ref={importer.fileInputRef}
					type="file"
					multiple
					accept=".map,.csv,.txt"
					className="hidden"
					onChange={importer.handleFiles}
				/>

				{/* Import button */}
				<button
					type="button"
					onClick={importer.openFilePicker}
					disabled={importer.isLoading}
					className="rounded border border-[var(--color-border)] bg-[var(--color-bg-panel)] px-3 py-1 text-xs text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
				>
					{importer.isLoading ? "Importing..." : "Import VOS Map"}
				</button>
			</div>
		</header>
	);
}
