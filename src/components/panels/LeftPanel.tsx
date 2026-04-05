/**
 * LeftPanel — Collapsible left sidebar for map statistics and bay list.
 *
 * Hidden by default. Will be used for bay/area/module editing in later milestones.
 * Shows entity counts and bay list after map import.
 */

import { useState } from "react";
import {
	selectBayCount,
	selectNodeCount,
	selectPortCount,
	selectRailCount,
	useMapStore,
} from "@/stores/mapStore";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeftPanel(): React.JSX.Element | null {
	const [isOpen, setIsOpen] = useState(false);
	const nodeCount = useMapStore(selectNodeCount);
	const railCount = useMapStore(selectRailCount);
	const portCount = useMapStore(selectPortCount);
	const bayCount = useMapStore(selectBayCount);
	const bays = useMapStore((s) => s.bays);

	const hasMap = nodeCount > 0;
	const bayEntries = Object.values(bays);

	return (
		<>
			{/* Toggle button — always visible */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="absolute top-12 left-1 z-10 rounded border border-[var(--color-border)] bg-[var(--color-bg-panel)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
			>
				{isOpen ? "◀" : "▶"}
			</button>

			{/* Panel — only shown when open */}
			{isOpen && (
				<aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-panel)]">
					<div className="border-b border-[var(--color-border)] px-3 py-2">
						<h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
							Map Browser
						</h2>
					</div>

					<div className="flex-1 overflow-y-auto p-3">
						{!hasMap ? (
							<p className="text-xs text-[var(--color-text-secondary)]">
								No map loaded.
							</p>
						) : (
							<>
								<div className="mb-4 text-xs">
									<div className="flex justify-between py-0.5">
										<span className="text-[var(--color-text-secondary)]">Nodes</span>
										<span className="font-mono">{nodeCount}</span>
									</div>
									<div className="flex justify-between py-0.5">
										<span className="text-[var(--color-text-secondary)]">Rails</span>
										<span className="font-mono">{railCount}</span>
									</div>
									<div className="flex justify-between py-0.5">
										<span className="text-[var(--color-text-secondary)]">Ports</span>
										<span className="font-mono">{portCount}</span>
									</div>
									<div className="flex justify-between py-0.5">
										<span className="text-[var(--color-text-secondary)]">Bays</span>
										<span className="font-mono">{bayCount}</span>
									</div>
								</div>

								<div className="text-xs">
									<h3 className="mb-1 font-semibold text-[var(--color-text-primary)]">
										Bays ({bayCount})
									</h3>
									<ul className="space-y-0.5">
										{bayEntries.map((bay) => (
											<li
												key={bay.id}
												className="flex items-center justify-between rounded px-2 py-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
											>
												<span className="font-mono">{bay.id}</span>
												<span className="text-[10px]">{bay.railIds.length}r</span>
											</li>
										))}
									</ul>
								</div>
							</>
						)}
					</div>
				</aside>
			)}
		</>
	);
}
