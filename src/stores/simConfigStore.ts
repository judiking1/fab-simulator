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
	/** Time to pick up a FOUP (seconds) */
	pickupDuration: number;
	/** Time to deposit a FOUP (seconds) */
	depositDuration: number;
	/** Dispatching algorithm for OHT assignment */
	dispatchingAlgorithm: DispatchingAlgorithm;
	/** Total simulation duration in seconds */
	simulationDuration: number;
	/** Random seed for reproducible runs (0 = random) */
	seed: number;

	// Actions
	setOhtCount: (count: number) => void;
	setOhtSpeed: (speed: number) => void;
	setPickupDuration: (duration: number) => void;
	setDepositDuration: (duration: number) => void;
	setDispatchingAlgorithm: (algorithm: DispatchingAlgorithm) => void;
	setSimulationDuration: (duration: number) => void;
	setSeed: (seed: number) => void;
	resetToDefaults: () => void;
}

const DEFAULTS = {
	ohtCount: 50,
	ohtSpeed: 5,
	pickupDuration: 10,
	depositDuration: 10,
	dispatchingAlgorithm: DISPATCHING_ALGORITHMS.FIFO as DispatchingAlgorithm,
	simulationDuration: 3600,
	seed: 0,
};

export const useSimConfigStore = create<SimConfigState>((set) => ({
	...DEFAULTS,

	setOhtCount: (count) => set({ ohtCount: Math.max(1, count) }),
	setOhtSpeed: (speed) => set({ ohtSpeed: Math.max(0.1, speed) }),
	setPickupDuration: (duration) => set({ pickupDuration: Math.max(0, duration) }),
	setDepositDuration: (duration) => set({ depositDuration: Math.max(0, duration) }),
	setDispatchingAlgorithm: (algorithm) => set({ dispatchingAlgorithm: algorithm }),
	setSimulationDuration: (duration) => set({ simulationDuration: Math.max(1, duration) }),
	setSeed: (seed) => set({ seed }),
	resetToDefaults: () => set(DEFAULTS),
}));
