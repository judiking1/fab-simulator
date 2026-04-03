import { useSimulation } from "@/hooks/useSimulation";

// ─── SimRunButton ───────────────────────────────────────────────
// Shows "Run Simulation" when idle, progress bar + "Cancel" when running.

export function SimRunButton(): React.ReactElement {
	const { startSimulation, cancelSimulation, isRunning, progress, error } = useSimulation();

	if (isRunning) {
		return (
			<div className="flex flex-col gap-2">
				{/* Progress bar */}
				<div className="flex items-center gap-2">
					<div className="flex-1 h-2 rounded bg-gray-600 overflow-hidden">
						<div
							className="h-full rounded bg-cyan-500 transition-[width] duration-200"
							style={{ width: `${Math.min(100, progress)}%` }}
						/>
					</div>
					<span className="text-[10px] font-mono text-gray-400 min-w-[36px] text-right">
						{Math.round(progress)}%
					</span>
				</div>
				{/* Cancel button */}
				<button
					type="button"
					onClick={cancelSimulation}
					className="w-full rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
				>
					Cancel
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<button
				type="button"
				onClick={startSimulation}
				className="w-full rounded bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700"
			>
				Run Simulation
			</button>
			{error && (
				<p className="text-[10px] text-red-400 truncate" title={error}>
					{error}
				</p>
			)}
		</div>
	);
}
