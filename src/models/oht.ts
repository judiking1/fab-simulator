import type { EntityId } from "@/types/common";

// ─── OHT (Overhead Hoist Transport) ──────────────────────────────
// A vehicle that moves along the rail network carrying FOUPs between equipment.

export const OHT_STATES = {
	/** Idle, waiting for a transfer assignment */
	IDLE: "idle",
	/** Assigned to a transfer, moving to pick-up point */
	MOVING_TO_PICK: "moving_to_pick",
	/** Picking up a FOUP at equipment port */
	PICKING: "picking",
	/** Carrying a FOUP, moving to deposit point */
	MOVING_TO_DEPOSIT: "moving_to_deposit",
	/** Depositing a FOUP at equipment port */
	DEPOSITING: "depositing",
} as const;

export type OhtState = (typeof OHT_STATES)[keyof typeof OHT_STATES];

export interface Oht {
	id: EntityId;
	name: string;
	state: OhtState;
	/** Speed in meters per second */
	speed: number;
	/** Current rail edge the OHT is on (null if at a node) */
	currentEdgeId: EntityId | null;
	/** Current rail node the OHT is at (null if between nodes) */
	currentNodeId: EntityId | null;
	/** Progress along the current edge (0.0 to 1.0) */
	edgeProgress: number;
	/** FOUP being carried (null if empty) */
	foupId: EntityId | null;
	/** Currently assigned transfer command (null if idle) */
	transferId: EntityId | null;
}
