/**
 * BottomBar — Bottom bar placeholder for simulation controls.
 *
 * Will be populated in Milestone 2 with playback controls,
 * speed slider, timeline, and status indicators.
 */

export function BottomBar(): React.JSX.Element {
	return (
		<footer className="flex h-10 shrink-0 items-center border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
			<span className="text-xs text-[var(--color-text-secondary)]">Simulation Controls</span>
		</footer>
	);
}
