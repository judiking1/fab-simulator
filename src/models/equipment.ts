import type { EntityId, Vector3 } from "@/types/common";

// ─── Equipment Port ──────────────────────────────────────────────
// A port is a physical load/unload point where an OHT can pick up or deposit a FOUP.

export interface EquipmentPort {
	id: EntityId;
	/** Rail node this port is accessible from */
	railNodeId: EntityId | null;
	/** Whether a FOUP is currently present at this port */
	hasFoup: boolean;
	/** ID of the FOUP at this port (null if empty) */
	foupId: EntityId | null;
}

// ─── FOUP Slot ───────────────────────────────────────────────────
// Internal storage slot within Stockers. Distinct from ports (external OHT interface).

export interface FoupSlot {
	id: EntityId;
	hasFoup: boolean;
	foupId: EntityId | null;
}

// ─── Equipment Types (discriminated union on `type`) ─────────────

export const EQUIPMENT_TYPES = {
	PROCESS: "process",
	STOCKER: "stocker",
	OHB: "ohb",
} as const;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[keyof typeof EQUIPMENT_TYPES];

interface BaseEquipment {
	id: EntityId;
	moduleId: EntityId;
	name: string;
	position: Vector3;
	ports: EquipmentPort[];
}

/** Process equipment — performs wafer processing (etch, litho, deposition, etc.) */
export interface ProcessEquipment extends BaseEquipment {
	type: typeof EQUIPMENT_TYPES.PROCESS;
	/** Process time in seconds (for simulation) */
	processTime: number;
}

/** Stocker — bulk FOUP storage facility */
export interface Stocker extends BaseEquipment {
	type: typeof EQUIPMENT_TYPES.STOCKER;
	/** Internal storage slots */
	slots: FoupSlot[];
	capacity: number;
}

/** OHB (Overhead Buffer) — temporary rail-side FOUP buffer */
export interface Ohb extends BaseEquipment {
	type: typeof EQUIPMENT_TYPES.OHB;
	/** Rail node this OHB is attached to */
	railNodeId: EntityId;
	capacity: number;
	slots: FoupSlot[];
}

/** Discriminated union of all equipment types */
export type Equipment = ProcessEquipment | Stocker | Ohb;
