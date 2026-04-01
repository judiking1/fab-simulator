import type { EntityId } from "@/types/common";

// ─── FOUP (Front Opening Unified Pod) ────────────────────────────
// The physical carrier that OHTs transport. Contains wafers belonging to a lot.
// A FOUP is always at exactly one location: equipment port/slot, on an OHT, or in transit.

export const FOUP_LOCATIONS = {
	/** At an equipment port (pick/drop point) */
	EQUIPMENT_PORT: "equipment_port",
	/** Inside a stocker/OHB storage slot */
	STORAGE_SLOT: "storage_slot",
	/** Being carried by an OHT */
	ON_OHT: "on_oht",
} as const;

export type FoupLocationType = (typeof FOUP_LOCATIONS)[keyof typeof FOUP_LOCATIONS];

export interface FoupLocation {
	type: FoupLocationType;
	/** Equipment ID (for port/slot) or OHT ID (for on_oht) */
	hostId: EntityId;
	/** Port ID or slot ID (null when on OHT) */
	slotId: EntityId | null;
}

export interface Foup {
	id: EntityId;
	/** Lot identifier for tracking */
	lotId: string;
	/** Number of wafers in this FOUP */
	waferCount: number;
	/** Current physical location */
	location: FoupLocation;
}
