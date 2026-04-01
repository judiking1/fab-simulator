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
	/** Equipment loading/unloading station */
	STATION: "station",
} as const;

export type RailNodeType = (typeof RAIL_NODE_TYPES)[keyof typeof RAIL_NODE_TYPES];

export interface RailNode {
	id: EntityId;
	fabId: EntityId;
	type: RailNodeType;
	position: Vector3;
	/** Equipment ID if this is a station node (null otherwise) */
	equipmentId: EntityId | null;
}

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
}
