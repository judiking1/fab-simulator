import { useCallback } from "react";
import { SimRunButton } from "@/components/controls/SimRunButton";
import type { DispatchingAlgorithm } from "@/stores/simConfigStore";
import { DISPATCHING_ALGORITHMS, useSimConfigStore } from "@/stores/simConfigStore";

// ─── Number Input ───────────────────────────────────────────────

interface NumberFieldProps {
	label: string;
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
}

function NumberField({
	label,
	value,
	onChange,
	min,
	max,
	step = 1,
}: NumberFieldProps): React.ReactElement {
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>): void => {
			const raw = Number.parseFloat(e.target.value);
			if (Number.isNaN(raw)) return;
			const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, raw));
			onChange(clamped);
		},
		[onChange, min, max],
	);

	return (
		<label className="flex items-center justify-between gap-2">
			<span className="text-xs text-gray-300 dark:text-gray-400">{label}</span>
			<input
				type="number"
				value={value}
				onChange={handleChange}
				min={min}
				max={max}
				step={step}
				className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white outline-none focus:border-accent dark:border-gray-600 dark:bg-gray-800"
			/>
		</label>
	);
}

// ─── Section Header ─────────────────────────────────────────────

function SectionHeader({ title }: { title: string }): React.ReactElement {
	return (
		<h4 className="mb-2 mt-4 border-b border-gray-600 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 first:mt-0 dark:border-gray-700 dark:text-gray-500">
			{title}
		</h4>
	);
}

// ─── Main Panel ─────────────────────────────────────────────────

export function SimConfigPanel(): React.ReactElement {
	const ohtCount = useSimConfigStore((s) => s.ohtCount);
	const ohtSpeed = useSimConfigStore((s) => s.ohtSpeed);
	const loadDuration = useSimConfigStore((s) => s.loadDuration);
	const unloadDuration = useSimConfigStore((s) => s.unloadDuration);
	const dispatchingAlgorithm = useSimConfigStore((s) => s.dispatchingAlgorithm);
	const simulationDuration = useSimConfigStore((s) => s.simulationDuration);
	const seed = useSimConfigStore((s) => s.seed);

	const setOhtCount = useSimConfigStore((s) => s.setOhtCount);
	const setOhtSpeed = useSimConfigStore((s) => s.setOhtSpeed);
	const setLoadDuration = useSimConfigStore((s) => s.setLoadDuration);
	const setUnloadDuration = useSimConfigStore((s) => s.setUnloadDuration);
	const setDispatchingAlgorithm = useSimConfigStore((s) => s.setDispatchingAlgorithm);
	const setSimulationDuration = useSimConfigStore((s) => s.setSimulationDuration);
	const setSeed = useSimConfigStore((s) => s.setSeed);
	const bprAlpha = useSimConfigStore((s) => s.bprAlpha);
	const setBprAlpha = useSimConfigStore((s) => s.setBprAlpha);
	const bprBeta = useSimConfigStore((s) => s.bprBeta);
	const setBprBeta = useSimConfigStore((s) => s.setBprBeta);
	const vmaxDefault = useSimConfigStore((s) => s.vmaxDefault);
	const setVmaxDefault = useSimConfigStore((s) => s.setVmaxDefault);
	const acceleration = useSimConfigStore((s) => s.acceleration);
	const setAcceleration = useSimConfigStore((s) => s.setAcceleration);
	const deceleration = useSimConfigStore((s) => s.deceleration);
	const setDeceleration = useSimConfigStore((s) => s.setDeceleration);
	const curveSpeedFactor = useSimConfigStore((s) => s.curveSpeedFactor);
	const setCurveSpeedFactor = useSimConfigStore((s) => s.setCurveSpeedFactor);
	const resetToDefaults = useSimConfigStore((s) => s.resetToDefaults);

	const handleDispatchChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>): void => {
			setDispatchingAlgorithm(e.target.value as DispatchingAlgorithm);
		},
		[setDispatchingAlgorithm],
	);

	return (
		<div className="space-y-1">
			<h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
				Configuration
			</h3>

			<SectionHeader title="OHT Settings" />
			<div className="space-y-2">
				<NumberField label="OHT Count" value={ohtCount} onChange={setOhtCount} min={1} max={5000} />
				<NumberField
					label="Speed (m/s)"
					value={ohtSpeed}
					onChange={setOhtSpeed}
					min={0.1}
					max={20}
					step={0.1}
				/>
			</div>

			<SectionHeader title="Transfer Settings" />
			<div className="space-y-2">
				<NumberField
					label="Load (s)"
					value={loadDuration}
					onChange={setLoadDuration}
					min={0}
					max={120}
				/>
				<NumberField
					label="Unload (s)"
					value={unloadDuration}
					onChange={setUnloadDuration}
					min={0}
					max={120}
				/>
				<label className="flex items-center justify-between gap-2">
					<span className="text-xs text-gray-300 dark:text-gray-400">Dispatching</span>
					<select
						value={dispatchingAlgorithm}
						onChange={handleDispatchChange}
						className="w-28 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white outline-none focus:border-accent dark:border-gray-600 dark:bg-gray-800"
					>
						<option value={DISPATCHING_ALGORITHMS.FIFO}>FIFO</option>
						<option value={DISPATCHING_ALGORITHMS.NEAREST_FIRST}>Nearest</option>
						<option value={DISPATCHING_ALGORITHMS.PRIORITY}>Priority</option>
					</select>
				</label>
			</div>

			<SectionHeader title="Physics" />
			<div className="space-y-2">
				<NumberField
					label="Accel (m/s\u00B2)"
					value={acceleration}
					onChange={setAcceleration}
					min={0.1}
					max={10}
					step={0.1}
				/>
				<NumberField
					label="Decel (m/s\u00B2)"
					value={deceleration}
					onChange={setDeceleration}
					min={0.1}
					max={10}
					step={0.1}
				/>
				<NumberField
					label="Curve Factor"
					value={curveSpeedFactor}
					onChange={setCurveSpeedFactor}
					min={0}
					max={1}
					step={0.05}
				/>
			</div>

			<SectionHeader title="BPR Congestion" />
			<div className="space-y-2">
				<NumberField
					label="Alpha"
					value={bprAlpha}
					onChange={setBprAlpha}
					min={0}
					max={20}
					step={0.5}
				/>
				<NumberField
					label="Beta"
					value={bprBeta}
					onChange={setBprBeta}
					min={0}
					max={10}
					step={0.5}
				/>
				<NumberField
					label="Vmax (m/s)"
					value={vmaxDefault}
					onChange={setVmaxDefault}
					min={0.1}
					max={20}
					step={0.1}
				/>
			</div>

			<SectionHeader title="Simulation" />
			<div className="space-y-2">
				<NumberField
					label="Duration (s)"
					value={simulationDuration}
					onChange={setSimulationDuration}
					min={1}
					max={86400}
				/>
				<NumberField label="Seed" value={seed} onChange={setSeed} min={0} />
			</div>

			{/* Action buttons */}
			<div className="mt-4 flex flex-col gap-2 pt-2">
				<SimRunButton />
				<button
					type="button"
					className="w-full rounded border border-gray-600 px-3 py-1 text-xs text-gray-300 hover:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-700"
					onClick={resetToDefaults}
				>
					Reset Defaults
				</button>
			</div>
		</div>
	);
}
