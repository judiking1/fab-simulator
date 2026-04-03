import type { EntityId } from "@/types/common";

// ─── OHT (Overhead Hoist Transport) ──────────────────────────────
// A vehicle that moves along the rail network carrying FOUPs between equipment.

export const OHT_STATES = {
	/** Idle, waiting for a transfer assignment */
	IDLE: "idle",
	/** Assigned to a transfer, moving to load point */
	MOVING_TO_LOAD: "moving_to_load",
	/** Loading a FOUP at equipment port */
	LOADING: "loading",
	/** Carrying a FOUP, moving to unload point */
	MOVING_TO_UNLOAD: "moving_to_unload",
	/** Unloading a FOUP at equipment port */
	UNLOADING: "unloading",
} as const;

export type OhtState = (typeof OHT_STATES)[keyof typeof OHT_STATES];

export interface Oht {
	id: EntityId;
	name: string;
	state: OhtState;
	/** Speed in meters per second */
	speed: number;
	/** Maximum speed in m/s */
	maxSpeed: number;
	/** Acceleration in m/s² */
	acceleration: number;
	/** Deceleration in m/s² (positive value) */
	deceleration: number;
	/** Speed factor for curves (0-1, multiplied with maxSpeed) */
	curveSpeedFactor: number;
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
	/** Ordered list of edge IDs forming current path */
	pathEdgeIds: EntityId[];
	/** Index into pathEdgeIds for current segment */
	pathIndex: number;
}
