/**
 * RightPanel — Right sidebar placeholder for entity info display.
 *
 * Will be populated in Milestone 4 with selected entity details,
 * statistics, and vehicle search.
 */

export function RightPanel(): React.JSX.Element {
	return (
		<aside className="flex w-72 shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-panel)]">
			{/* Section header */}
			<div className="border-b border-[var(--color-border)] px-3 py-2">
				<h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
					Info Panel
				</h2>
			</div>

			{/* Placeholder content */}
			<div className="flex flex-1 items-center justify-center p-3">
				<p className="text-xs text-[var(--color-text-secondary)]">
					Select an entity in the viewport to view details.
				</p>
			</div>
		</aside>
	);
}
