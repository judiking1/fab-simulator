/**
 * Editor — Types for the map editor UI state.
 * Defines entity references, editor modes, and clipboard payload.
 */

import type { EquipmentData } from "./equipment";
import type { NodeData } from "./node";
import type { PortData } from "./port";
import type { RailData } from "./rail";

// ---------------------------------------------------------------------------
// Entity kinds (for selection, clipboard, etc.)
// ---------------------------------------------------------------------------

export const ENTITY_KIND = {
	NODE: "node",
	RAIL: "rail",
	PORT: "port",
	EQUIPMENT: "equipment",
	BAY: "bay",
} as const;

export type EntityKind = (typeof ENTITY_KIND)[keyof typeof ENTITY_KIND];

/** A reference to a specific entity by kind and ID */
export interface EntityRef {
	kind: EntityKind;
	id: string;
}

// ---------------------------------------------------------------------------
// Editor modes
// ---------------------------------------------------------------------------

export const EDITOR_MODE = {
	VIEW: "view",
	SELECT: "select",
	PAN: "pan",
	ADD_NODE: "add_node",
	ADD_RAIL: "add_rail",
	ADD_EQUIPMENT: "add_equipment",
} as const;

export type EditorMode = (typeof EDITOR_MODE)[keyof typeof EDITOR_MODE];

// ---------------------------------------------------------------------------
// Clipboard payload for copy/paste operations
// ---------------------------------------------------------------------------

/** Snapshot of selected entities for copy/paste */
export interface ClipboardPayload {
	nodes: NodeData[];
	rails: RailData[];
	ports: PortData[];
	equipment: EquipmentData[];
	/** Original center point for paste offset calculation */
	center: { x: number; z: number };
}
