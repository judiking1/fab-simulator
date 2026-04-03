import { create } from "zustand";
import type { SimResult } from "@/types/simulation";

// ─── Simulation Result Store ────────────────────────────────────

interface SimResultState {
	result: SimResult | null;
	isRunning: boolean;
	progress: number;
	error: string | null;
	setResult: (result: SimResult) => void;
	setProgress: (progress: number) => void;
	setIsRunning: (running: boolean) => void;
	setError: (error: string | null) => void;
	clear: () => void;
}

export const useSimResultStore = create<SimResultState>((set) => ({
	result: null,
	isRunning: false,
	progress: 0,
	error: null,

	setResult: (result) => set({ result, isRunning: false, progress: 100, error: null }),
	setProgress: (progress) => set({ progress }),
	setIsRunning: (running) => set({ isRunning: running }),
	setError: (error) => set({ error, isRunning: false }),
	clear: () => set({ result: null, isRunning: false, progress: 0, error: null }),
}));
