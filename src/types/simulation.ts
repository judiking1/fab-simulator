import type { TransferStatus } from "@/models/transfer";
import type { EntityId } from "@/types/common";

// --- Simulation Event Types ---
export const SIM_EVENT_TYPES = {
	OHT_DEPART: "oht_depart",
	OHT_ARRIVE_POINT: "oht_arrive_point",
	OHT_ARRIVE_PORT: "oht_arrive_port",
	OHT_SPEED_CHANGE: "oht_speed_change",
	TRANSFER_CREATED: "transfer_created",
	TRANSFER_ASSIGNED: "transfer_assigned",
	TRANSFER_LOAD_START: "transfer_load_start",
	TRANSFER_LOAD_DONE: "transfer_load_done",
	TRANSFER_UNLOAD_START: "transfer_unload_start",
	TRANSFER_UNLOAD_DONE: "transfer_unload_done",
	INTERSECTION_RESERVE: "intersection_reserve",
	INTERSECTION_RELEASE: "intersection_release",
	INTERSECTION_WAIT: "intersection_wait",
} as const;

export type SimEventType = (typeof SIM_EVENT_TYPES)[keyof typeof SIM_EVENT_TYPES];

export interface SimEvent {
	/** Simulation time in seconds */
	time: number;
	type: SimEventType;
	/** OHT or Transfer ID */
	entityId: EntityId;
	data: Record<string, unknown>;
}

// --- OHT Position Snapshot ---
export interface OhtSnapshot {
	edgeId: EntityId;
	/** 0-1 position along edge */
	ratio: number;
	/** Current speed m/s */
	speed: number;
	/** OHT state */
	state: string;
	foupId: EntityId | null;
}

// --- Simulation Snapshot (for playback) ---
export interface SimSnapshot {
	time: number;
	ohtPositions: Record<EntityId, OhtSnapshot>;
	transferStates: Record<EntityId, TransferStatus>;
}

// --- KPI Summary ---
export interface KpiSummary {
	leadTime: { avg: number; min: number; max: number; p95: number };
	queueTime: { avg: number; min: number; max: number; p95: number };
	waitTime: { avg: number; min: number; max: number; p95: number };
	deliveryTime: { avg: number; min: number; max: number; p95: number };
	/** OHT utilization ratio (0-1) */
	utilization: number;
	/** Transfers completed per hour */
	throughput: number;
	totalTransfers: number;
	completedTransfers: number;
}

// --- Simulation Result ---
export interface SimResult {
	events: SimEvent[];
	snapshots: SimSnapshot[];
	/** Total simulation time in seconds */
	duration: number;
	kpiSummary: KpiSummary;
}

// --- Worker Message Protocol ---
export const WORKER_MSG_TYPES = {
	INIT: "init",
	START: "start",
	PAUSE: "pause",
	RESUME: "resume",
	CANCEL: "cancel",
	PROGRESS: "progress",
	COMPLETE: "complete",
	ERROR: "error",
} as const;

export type WorkerMsgType = (typeof WORKER_MSG_TYPES)[keyof typeof WORKER_MSG_TYPES];

export interface WorkerInitMsg {
	type: typeof WORKER_MSG_TYPES.INIT;
	// layout and config data will be passed here
}

export interface WorkerStartMsg {
	type: typeof WORKER_MSG_TYPES.START;
}

export interface WorkerProgressMsg {
	type: typeof WORKER_MSG_TYPES.PROGRESS;
	/** Progress percentage 0-100 */
	progress: number;
	eventsProcessed: number;
	simTime: number;
}

export interface WorkerCompleteMsg {
	type: typeof WORKER_MSG_TYPES.COMPLETE;
	result: SimResult;
}

export interface WorkerErrorMsg {
	type: typeof WORKER_MSG_TYPES.ERROR;
	message: string;
}

export type WorkerOutboundMsg = WorkerProgressMsg | WorkerCompleteMsg | WorkerErrorMsg;
export type WorkerInboundMsg =
	| WorkerInitMsg
	| WorkerStartMsg
	| { type: typeof WORKER_MSG_TYPES.PAUSE }
	| { type: typeof WORKER_MSG_TYPES.RESUME }
	| { type: typeof WORKER_MSG_TYPES.CANCEL };
