import { useCallback, useRef } from "react";
import { useLayoutStore } from "@/stores/layoutStore";
import { useSimConfigStore } from "@/stores/simConfigStore";
import { useSimResultStore } from "@/stores/simResultStore";
import type { WorkerOutboundMsg } from "@/types/simulation";
import { WORKER_MSG_TYPES } from "@/types/simulation";

// ─── useSimulation Hook ─────────────────────────────────────────
// Manages the Web Worker lifecycle for running the DES engine.

interface UseSimulationReturn {
	startSimulation: () => void;
	cancelSimulation: () => void;
	isRunning: boolean;
	progress: number;
	error: string | null;
}

export function useSimulation(): UseSimulationReturn {
	const workerRef = useRef<Worker | null>(null);

	const isRunning = useSimResultStore((s) => s.isRunning);
	const progress = useSimResultStore((s) => s.progress);
	const error = useSimResultStore((s) => s.error);

	const startSimulation = useCallback((): void => {
		// Terminate any existing worker
		if (workerRef.current) {
			workerRef.current.terminate();
			workerRef.current = null;
		}

		const { setIsRunning, setProgress, setResult, setError, clear } = useSimResultStore.getState();

		// Clear previous results
		clear();
		setIsRunning(true);

		// Gather layout data from store
		const layoutState = useLayoutStore.getState();
		const layoutEntities = {
			equipment: layoutState.equipment,
			railNodes: layoutState.railNodes,
			railEdges: layoutState.railEdges,
			foups: layoutState.foups,
		};

		// Gather sim config from store
		const configState = useSimConfigStore.getState();
		const simConfig = {
			ohtCount: configState.ohtCount,
			ohtSpeed: configState.ohtSpeed,
			loadDuration: configState.loadDuration,
			unloadDuration: configState.unloadDuration,
			dispatchingAlgorithm: configState.dispatchingAlgorithm,
			simulationDuration: configState.simulationDuration,
			seed: configState.seed,
			acceleration: configState.acceleration,
			deceleration: configState.deceleration,
		};

		// Create worker using Vite worker syntax
		const worker = new Worker(new URL("../workers/simWorker.ts", import.meta.url), {
			type: "module",
		});
		workerRef.current = worker;

		// Listen for messages from the worker
		worker.onmessage = (e: MessageEvent<WorkerOutboundMsg>): void => {
			const msg = e.data;

			switch (msg.type) {
				case WORKER_MSG_TYPES.PROGRESS: {
					setProgress(msg.progress);
					break;
				}
				case WORKER_MSG_TYPES.COMPLETE: {
					setResult(msg.result);
					worker.terminate();
					workerRef.current = null;
					break;
				}
				case WORKER_MSG_TYPES.ERROR: {
					setError(msg.message);
					worker.terminate();
					workerRef.current = null;
					break;
				}
			}
		};

		worker.onerror = (event: ErrorEvent): void => {
			setError(event.message || "Worker error");
			worker.terminate();
			workerRef.current = null;
		};

		// Send INIT with layout and config data
		worker.postMessage({
			type: WORKER_MSG_TYPES.INIT,
			layoutEntities,
			simConfig,
		});

		// Send START
		worker.postMessage({
			type: WORKER_MSG_TYPES.START,
		});
	}, []);

	const cancelSimulation = useCallback((): void => {
		if (workerRef.current) {
			workerRef.current.postMessage({ type: WORKER_MSG_TYPES.CANCEL });
			workerRef.current.terminate();
			workerRef.current = null;
		}

		const { setIsRunning, setError } = useSimResultStore.getState();
		setIsRunning(false);
		setError("Simulation cancelled");
	}, []);

	return {
		startSimulation,
		cancelSimulation,
		isRunning,
		progress,
		error,
	};
}
