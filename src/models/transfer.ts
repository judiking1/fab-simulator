import type { EntityId } from "@/types/common";

// ─── Transfer Command ────────────────────────────────────────────
// The core simulation entity. A transfer command triggers OHT movement
// to transport a FOUP from one equipment to another.

export const TRANSFER_STATUSES = {
	/** Transfer created, waiting for OHT assignment */
	CREATED: "created",
	/** OHT assigned to this transfer */
	ASSIGNED: "assigned",
	/** OHT moving to pick-up equipment */
	MOVE_TO_PICK: "move_to_pick",
	/** OHT arrived at pick-up port */
	ARRIVE_AT_PICK: "arrive_at_pick",
	/** OHT picking up FOUP */
	PICKING: "picking",
	/** Pick-up complete, about to move to deposit */
	PICK_DONE: "pick_done",
	/** OHT moving to deposit equipment */
	MOVE_TO_DEPOSIT: "move_to_deposit",
	/** OHT arrived at deposit port */
	ARRIVE_AT_DEPOSIT: "arrive_at_deposit",
	/** OHT depositing FOUP */
	DEPOSITING: "depositing",
	/** Transfer complete */
	DEPOSIT_DONE: "deposit_done",
} as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[keyof typeof TRANSFER_STATUSES];

/** Ordered list of transfer statuses for lifecycle progression */
export const TRANSFER_LIFECYCLE: readonly TransferStatus[] = [
	TRANSFER_STATUSES.CREATED,
	TRANSFER_STATUSES.ASSIGNED,
	TRANSFER_STATUSES.MOVE_TO_PICK,
	TRANSFER_STATUSES.ARRIVE_AT_PICK,
	TRANSFER_STATUSES.PICKING,
	TRANSFER_STATUSES.PICK_DONE,
	TRANSFER_STATUSES.MOVE_TO_DEPOSIT,
	TRANSFER_STATUSES.ARRIVE_AT_DEPOSIT,
	TRANSFER_STATUSES.DEPOSITING,
	TRANSFER_STATUSES.DEPOSIT_DONE,
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

	/** Source equipment where FOUP is picked up */
	sourceEquipmentId: EntityId;
	sourcePortId: EntityId;

	/** Destination equipment where FOUP is deposited */
	destEquipmentId: EntityId;
	destPortId: EntityId;

	/** Timestamp of each state transition (for KPI analysis) */
	timestamps: TransferTimestamps;

	/** Rail node IDs forming the pick-up route */
	pickRoute: EntityId[];
	/** Rail node IDs forming the deposit route */
	depositRoute: EntityId[];
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
		pickRoute: [],
		depositRoute: [],
	};
}

// ─── KPI Extraction Helpers ──────────────────────────────────────

/** Total time from creation to completion (null if not complete) */
export function getTotalTransferTime(cmd: TransferCommand): number | null {
	const start = cmd.timestamps[TRANSFER_STATUSES.CREATED];
	const end = cmd.timestamps[TRANSFER_STATUSES.DEPOSIT_DONE];
	if (start == null || end == null) return null;
	return end - start;
}

/** Time waiting for OHT assignment (created → assigned) */
export function getWaitTime(cmd: TransferCommand): number | null {
	const start = cmd.timestamps[TRANSFER_STATUSES.CREATED];
	const end = cmd.timestamps[TRANSFER_STATUSES.ASSIGNED];
	if (start == null || end == null) return null;
	return end - start;
}

/** Travel time to pick-up point (move_to_pick → arrive_at_pick) */
export function getPickTravelTime(cmd: TransferCommand): number | null {
	const start = cmd.timestamps[TRANSFER_STATUSES.MOVE_TO_PICK];
	const end = cmd.timestamps[TRANSFER_STATUSES.ARRIVE_AT_PICK];
	if (start == null || end == null) return null;
	return end - start;
}

/** Travel time to deposit point (move_to_deposit → arrive_at_deposit) */
export function getDepositTravelTime(cmd: TransferCommand): number | null {
	const start = cmd.timestamps[TRANSFER_STATUSES.MOVE_TO_DEPOSIT];
	const end = cmd.timestamps[TRANSFER_STATUSES.ARRIVE_AT_DEPOSIT];
	if (start == null || end == null) return null;
	return end - start;
}
