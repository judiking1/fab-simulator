import type { EntityId, Vector3 } from "@/types/common";

// ─── Rail Network ────────────────────────────────────────────────
// The rail network is a directed graph. OHTs travel along edges in one direction.
// Nodes are junctions/waypoints. Edges connect nodes with a defined direction.

export const RAIL_NODE_TYPES = {
	/** Normal waypoint along a rail */
	WAYPOINT: "waypoint",
	/** Junction where rails split */
	JUNCTION: "junction",
	/** Merge point where rails join */
	MERGE: "merge",
	/** Equipment loading/unloading port */
	PORT: "port",
} as const;

export type RailNodeType = (typeof RAIL_NODE_TYPES)[keyof typeof RAIL_NODE_TYPES];

export interface RailNode {
	id: EntityId;
	fabId: EntityId;
	type: RailNodeType;
	position: Vector3;
	/** Equipment ID if this is a port node (null otherwise) */
	equipmentId: EntityId | null;
}

// ─── Rail Line Type ─────────────────────────────────────────────

export const RAIL_LINE_TYPES = {
	STRAIGHT: "straight",
	CURVE: "curve",
	S_CURVE: "s_curve",
	U_TURN: "u_turn",
} as const;

export type RailLineType = (typeof RAIL_LINE_TYPES)[keyof typeof RAIL_LINE_TYPES];

// ─── Rail Edge ──────────────────────────────────────────────────

export interface RailEdge {
	id: EntityId;
	fabId: EntityId;
	/** Source node (directed edge: from → to) */
	fromNodeId: EntityId;
	/** Target node */
	toNodeId: EntityId;
	/** Edge length in meters (computed from node positions or set manually) */
	distance: number;
	/** Max OHT speed on this segment (m/s) */
	maxSpeed: number;
	/** Segment shape type */
	lineType: RailLineType;
	/** Whether this is a confluence (merge) point at the end */
	isConfluence: boolean;
	/** Whether this is a branch (split) point at the start */
	isBranch: boolean;
	/** Bay this segment belongs to (for KPI grouping) */
	bayId: EntityId | null;
	/** Current traffic density 0-100 (updated during simulation) */
	density: number;
	/** Dynamic routing weight (default 1.0) */
	weight: number;
	/** Whether this segment is enabled for traffic */
	enabled: boolean;
	/** Curve radius in meters (null for straight segments) */
	curveRadius: number | null;
}
