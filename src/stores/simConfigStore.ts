import { create } from "zustand";

// ─── Dispatching Algorithms ──────────────────────────────────────

export const DISPATCHING_ALGORITHMS = {
	FIFO: "fifo",
	NEAREST_FIRST: "nearest_first",
	PRIORITY: "priority",
} as const;

export type DispatchingAlgorithm =
	(typeof DISPATCHING_ALGORITHMS)[keyof typeof DISPATCHING_ALGORITHMS];

// ─── Simulation Config ───────────────────────────────────────────

interface SimConfigState {
	/** Number of OHT vehicles in the simulation */
	ohtCount: number;
	/** Default OHT speed in meters per second */
	ohtSpeed: number;
	/** Time to load a FOUP (seconds) */
	loadDuration: number;
	/** Time to unload a FOUP (seconds) */
	unloadDuration: number;
	/** Dispatching algorithm for OHT assignment */
	dispatchingAlgorithm: DispatchingAlgorithm;
	/** Total simulation duration in seconds */
	simulationDuration: number;
	/** Random seed for reproducible runs (0 = random) */
	seed: number;
	/** BPR congestion penalty multiplier */
	bprAlpha: number;
	/** BPR sensitivity exponent */
	bprBeta: number;
	/** Default max speed for BPR calculation (m/s) */
	vmaxDefault: number;
	/** Default OHT acceleration (m/s²) */
	acceleration: number;
	/** Default OHT deceleration (m/s²) */
	deceleration: number;
	/** Speed reduction factor for curves (0-1) */
	curveSpeedFactor: number;

	// Actions
	setOhtCount: (count: number) => void;
	setOhtSpeed: (speed: number) => void;
	setLoadDuration: (duration: number) => void;
	setUnloadDuration: (duration: number) => void;
	setDispatchingAlgorithm: (algorithm: DispatchingAlgorithm) => void;
	setSimulationDuration: (duration: number) => void;
	setSeed: (seed: number) => void;
	setBprAlpha: (alpha: number) => void;
	setBprBeta: (beta: number) => void;
	setVmaxDefault: (vmax: number) => void;
	setAcceleration: (acceleration: number) => void;
	setDeceleration: (deceleration: number) => void;
	setCurveSpeedFactor: (factor: number) => void;
	resetToDefaults: () => void;
}

const DEFAULTS = {
	ohtCount: 50,
	ohtSpeed: 5,
	loadDuration: 10,
	unloadDuration: 10,
	dispatchingAlgorithm: DISPATCHING_ALGORITHMS.FIFO as DispatchingAlgorithm,
	simulationDuration: 3600,
	seed: 0,
	bprAlpha: 8.0,
	bprBeta: 4.0,
	vmaxDefault: 5.0,
	acceleration: 1.5,
	deceleration: 1.5,
	curveSpeedFactor: 0.5,
};

export const useSimConfigStore = create<SimConfigState>((set) => ({
	...DEFAULTS,

	setOhtCount: (count) => set({ ohtCount: Math.max(1, count) }),
	setOhtSpeed: (speed) => set({ ohtSpeed: Math.max(0.1, speed) }),
	setLoadDuration: (duration) => set({ loadDuration: Math.max(0, duration) }),
	setUnloadDuration: (duration) => set({ unloadDuration: Math.max(0, duration) }),
	setDispatchingAlgorithm: (algorithm) => set({ dispatchingAlgorithm: algorithm }),
	setSimulationDuration: (duration) => set({ simulationDuration: Math.max(1, duration) }),
	setSeed: (seed) => set({ seed }),
	setBprAlpha: (alpha) => set({ bprAlpha: Math.max(0, alpha) }),
	setBprBeta: (beta) => set({ bprBeta: Math.max(0, beta) }),
	setVmaxDefault: (vmax) => set({ vmaxDefault: Math.max(0.1, vmax) }),
	setAcceleration: (acceleration) => set({ acceleration: Math.max(0.1, acceleration) }),
	setDeceleration: (deceleration) => set({ deceleration: Math.max(0.1, deceleration) }),
	setCurveSpeedFactor: (factor) => set({ curveSpeedFactor: Math.max(0, Math.min(1, factor)) }),
	resetToDefaults: () => set(DEFAULTS),
}));
