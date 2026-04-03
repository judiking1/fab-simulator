import type { EntityId } from "@/types/common";

// ─── Transfer Command ────────────────────────────────────────────
// The core simulation entity. A transfer command triggers OHT movement
// to transport a FOUP from one equipment to another.

export const TRANSFER_STATUSES = {
	/** Transfer created, waiting for OHT assignment */
	CREATED: "created",
	/** OHT assigned to this transfer */
	ASSIGNED: "assigned",
	/** OHT moving to load (source) equipment */
	MOVE_TO_LOAD: "move_to_load",
	/** OHT arrived at source port */
	ARRIVE_AT_SOURCE: "arrive_at_source",
	/** OHT loading FOUP */
	LOADING: "loading",
	/** Loading complete, about to move to unload */
	LOAD_DONE: "load_done",
	/** OHT moving to unload (destination) equipment */
	MOVE_TO_UNLOAD: "move_to_unload",
	/** OHT arrived at destination port */
	ARRIVE_AT_DEST: "arrive_at_dest",
	/** OHT unloading FOUP */
	UNLOADING: "unloading",
	/** Transfer complete */
	UNLOAD_DONE: "unload_done",
} as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[keyof typeof TRANSFER_STATUSES];

/** Ordered list of transfer statuses for lifecycle progression */
export const TRANSFER_LIFECYCLE: readonly TransferStatus[] = [
	TRANSFER_STATUSES.CREATED,
	TRANSFER_STATUSES.ASSIGNED,
	TRANSFER_STATUSES.MOVE_TO_LOAD,
	TRANSFER_STATUSES.ARRIVE_AT_SOURCE,
	TRANSFER_STATUSES.LOADING,
	TRANSFER_STATUSES.LOAD_DONE,
	TRANSFER_STATUSES.MOVE_TO_UNLOAD,
	TRANSFER_STATUSES.ARRIVE_AT_DEST,
	TRANSFER_STATUSES.UNLOADING,
	TRANSFER_STATUSES.UNLOAD_DONE,
] as const;

/** Timestamps recorded at each state transition (null = not yet reached) */
export type TransferTimestamps = Record<TransferStatus, number | null>;

function createEmptyTimestamps(): TransferTimestamps {
	const timestamps = {} as TransferTimestamps;
	for (const status of TRANSFER_LIFECYCLE) {
		timestamps[status] = null;
	}
	return timestamps;
}

export interface TransferCommand {
	id: EntityId;
	status: TransferStatus;

	/** FOUP being transferred */
	foupId: EntityId;
	/** Assigned OHT (null until ASSIGNED) */
	ohtId: EntityId | null;

	/** Source equipment where FOUP is loaded */
	sourceEquipmentId: EntityId;
	sourcePortId: EntityId;

	/** Destination equipment where FOUP is unloaded */
	destEquipmentId: EntityId;
	destPortId: EntityId;

	/** Timestamp of each state transition (for KPI analysis) */
	timestamps: TransferTimestamps;

	/** Rail node IDs forming the load (source) route */
	loadRoute: EntityId[];
	/** Rail node IDs forming the unload (destination) route */
	unloadRoute: EntityId[];
}

/** Creates a new transfer command in CREATED state */
export function createTransferCommand(
	id: EntityId,
	foupId: EntityId,
	sourceEquipmentId: EntityId,
	sourcePortId: EntityId,
	destEquipmentId: EntityId,
	destPortId: EntityId,
	createdAt: number,
): TransferCommand {
	const timestamps = createEmptyTimestamps();
	timestamps[TRANSFER_STATUSES.CREATED] = createdAt;

	return {
		id,
		status: TRANSFER_STATUSES.CREATED,
		foupId,
		ohtId: null,
		sourceEquipmentId,
		sourcePortId,
		destEquipmentId,
		destPortId,
		timestamps,
		loadRoute: [],
		unloadRoute: [],
	};
}

// ─── KPI Extraction Helpers ──────────────────────────────────────

/** Lead time: total time from creation to completion (created → unload_done) */
export function getLeadTime(cmd: TransferCommand): number | null {
	const start = cmd.timestamps[TRANSFER_STATUSES.CREATED];
	const end = cmd.timestamps[TRANSFER_STATUSES.UNLOAD_DONE];
	if (start == null || end == null) return null;
	return end - start;
}

/** Queue time: time waiting for OHT assignment (created → assigned) */
export function getQueueTime(cmd: TransferCommand): number | null {
	const start = cmd.timestamps[TRANSFER_STATUSES.CREATED];
	const end = cmd.timestamps[TRANSFER_STATUSES.ASSIGNED];
	if (start == null || end == null) return null;
	return end - start;
}

/** Wait time from EQ perspective: time until FOUP is loaded (created → load_done) */
export function getWaitTime(cmd: TransferCommand): number | null {
	const start = cmd.timestamps[TRANSFER_STATUSES.CREATED];
	const end = cmd.timestamps[TRANSFER_STATUSES.LOAD_DONE];
	if (start == null || end == null) return null;
	return end - start;
}

/** Delivery time: time from move to unload until completion (move_to_unload → unload_done) */
export function getDeliveryTime(cmd: TransferCommand): number | null {
	const start = cmd.timestamps[TRANSFER_STATUSES.MOVE_TO_UNLOAD];
	const end = cmd.timestamps[TRANSFER_STATUSES.UNLOAD_DONE];
	if (start == null || end == null) return null;
	return end - start;
}

/** Travel time to load point (move_to_load → arrive_at_source) */
export function getLoadTravelTime(cmd: TransferCommand): number | null {
	const start = cmd.timestamps[TRANSFER_STATUSES.MOVE_TO_LOAD];
	const end = cmd.timestamps[TRANSFER_STATUSES.ARRIVE_AT_SOURCE];
	if (start == null || end == null) return null;
	return end - start;
}

/** Travel time to unload point (move_to_unload → arrive_at_dest) */
export function getUnloadTravelTime(cmd: TransferCommand): number | null {
	const start = cmd.timestamps[TRANSFER_STATUSES.MOVE_TO_UNLOAD];
	const end = cmd.timestamps[TRANSFER_STATUSES.ARRIVE_AT_DEST];
	if (start == null || end == null) return null;
	return end - start;
}
