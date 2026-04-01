import type { EntityId, Rotation3, Vector3 } from "@/types/common";

// ─── Layout Hierarchy ────────────────────────────────────────────
// Fab → Bay → Area → Module → Equipment
// Each entity has a globally unique ID and a reference to its parent.

export interface Fab {
	id: EntityId;
	name: string;
	position: Vector3;
	rotation: Rotation3;
}

export interface Bay {
	id: EntityId;
	fabId: EntityId;
	name: string;
	position: Vector3;
	rotation: Rotation3;
}

export interface Area {
	id: EntityId;
	bayId: EntityId;
	name: string;
	position: Vector3;
}

export interface Module {
	id: EntityId;
	areaId: EntityId;
	name: string;
	position: Vector3;
}

// ─── Entity type tag for discriminated union lookups ─────────────

export const ENTITY_TYPES = {
	FAB: "fab",
	BAY: "bay",
	AREA: "area",
	MODULE: "module",
	EQUIPMENT: "equipment",
	RAIL_NODE: "rail_node",
	RAIL_EDGE: "rail_edge",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

/** Union of all layout entity types for the normalized store */
export type LayoutEntity = Fab | Bay | Area | Module;
