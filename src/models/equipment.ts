/**
 * Equipment — Physical equipment units (EQ, STK, OHB) that own Ports.
 * Two layers: EquipmentSpec (catalog template) and EquipmentData (placed instance).
 */

import type { EquipmentType, PortSide, PortType } from "./port";

// ---------------------------------------------------------------------------
// Port slot definition within an equipment spec (relative coordinates)
// ---------------------------------------------------------------------------

export interface PortSlotDef {
	localOffset: { x: number; y: number; z: number };
	portType: PortType;
	side: PortSide;
}

// ---------------------------------------------------------------------------
// Equipment Spec — catalog/template entry
// ---------------------------------------------------------------------------

/** A catalog/template entry defining what an equipment type looks like */
export interface EquipmentSpec {
	id: string;
	category: EquipmentType;
	name: string;
	dimensions: { width: number; height: number; depth: number };
	portSlots: PortSlotDef[];
}

// ---------------------------------------------------------------------------
// Equipment Instance — placed on the map
// ---------------------------------------------------------------------------

/** A placed equipment instance, attached to a rail at a specific ratio */
export interface EquipmentData {
	id: string;
	/** References EquipmentSpec.id */
	specId: string;
	category: EquipmentType;
	/** Rail this equipment is attached to */
	railId: string;
	/** Position along the rail (0.0 ~ 1.0) */
	ratio: number;
	/** Which side of the rail the equipment sits on */
	side: PortSide;
	/** Y-axis rotation in degrees */
	rotation: number;
	/** Owned Port IDs */
	portIds: string[];
	bayId: string;
	fabId: string;
}
