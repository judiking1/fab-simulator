// ─── Simulation Web Worker ──────────────────────────────────────
// Runs the DES engine off the main thread.
// ZERO React imports — this file runs in a Web Worker context.

import type { LayoutData, SimConfig } from "@/core/engine/desEngine";
import { DesEngine } from "@/core/engine/desEngine";
import type { Equipment } from "@/models/equipment";
import type { Foup } from "@/models/foup";
import type { RailEdge, RailNode } from "@/models/rail";
import type { EntityId } from "@/types/common";
import type { SimResult } from "@/types/simulation";
import { WORKER_MSG_TYPES } from "@/types/simulation";

// ─── Inbound Message Types ──────────────────────────────────────

interface WorkerInitData {
	type: typeof WORKER_MSG_TYPES.INIT;
	layoutEntities: {
		equipment: Record<EntityId, Equipment>;
		railNodes: Record<EntityId, RailNode>;
		railEdges: Record<EntityId, RailEdge>;
		foups: Record<EntityId, Foup>;
	};
	simConfig: {
		ohtCount: number;
		ohtSpeed: number;
		loadDuration: number;
		unloadDuration: number;
		dispatchingAlgorithm: string;
		simulationDuration: number;
		seed: number;
		acceleration: number;
		deceleration: number;
	};
}

interface WorkerStartData {
	type: typeof WORKER_MSG_TYPES.START;
}

interface WorkerCancelData {
	type: typeof WORKER_MSG_TYPES.CANCEL;
}

type WorkerMessage = WorkerInitData | WorkerStartData | WorkerCancelData;

// ─── State ──────────────────────────────────────────────────────

let engine: DesEngine | null = null;
let layoutData: LayoutData | null = null;
let simConfig: SimConfig | null = null;

// ─── Post helpers ───────────────────────────────────────────────

function postProgress(progress: number, eventsProcessed: number, simTime: number): void {
	self.postMessage({
		type: WORKER_MSG_TYPES.PROGRESS,
		progress,
		eventsProcessed,
		simTime,
	});
}

function postComplete(result: SimResult): void {
	self.postMessage({
		type: WORKER_MSG_TYPES.COMPLETE,
		result,
	});
}

function postError(message: string): void {
	self.postMessage({
		type: WORKER_MSG_TYPES.ERROR,
		message,
	});
}

// ─── Message Handler ────────────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerMessage>): void => {
	const msg = e.data;

	switch (msg.type) {
		case WORKER_MSG_TYPES.INIT: {
			try {
				layoutData = {
					equipment: msg.layoutEntities.equipment,
					railNodes: msg.layoutEntities.railNodes,
					railEdges: msg.layoutEntities.railEdges,
					foups: msg.layoutEntities.foups,
				};

				simConfig = {
					ohtCount: msg.simConfig.ohtCount,
					ohtSpeed: msg.simConfig.ohtSpeed,
					loadDuration: msg.simConfig.loadDuration,
					unloadDuration: msg.simConfig.unloadDuration,
					dispatchingAlgorithm: msg.simConfig.dispatchingAlgorithm,
					simulationDuration: msg.simConfig.simulationDuration,
					seed: msg.simConfig.seed,
					acceleration: msg.simConfig.acceleration,
					deceleration: msg.simConfig.deceleration,
				};

				engine = new DesEngine({
					progressCallback: postProgress,
					progressInterval: 500,
				});

				engine.initialize(layoutData, simConfig);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : "Failed to initialize engine";
				postError(message);
			}
			break;
		}

		case WORKER_MSG_TYPES.START: {
			if (!engine) {
				postError("Engine not initialized. Send INIT before START.");
				return;
			}

			try {
				const result = engine.run();
				postComplete(result);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : "Simulation failed";
				postError(message);
			}
			break;
		}

		case WORKER_MSG_TYPES.CANCEL: {
			// Worker will be terminated from the main thread.
			// Clean up references.
			engine = null;
			layoutData = null;
			simConfig = null;
			break;
		}
	}
};
