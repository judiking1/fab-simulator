/**
 * Port — A load/unload point on equipment, attached to a Rail at a ratio.
 * Position is derived from rail geometry: ratio 0.0 = fromNode, 1.0 = toNode.
 */

export const EQUIPMENT_TYPE = {
	EQ: "EQ",
	STK: "STK",
	OHB: "OHB",
} as const;

export type EquipmentType = (typeof EQUIPMENT_TYPE)[keyof typeof EQUIPMENT_TYPE];

export const PORT_TYPE = {
	LOAD: "load",
	UNLOAD: "unload",
	BIDIRECTIONAL: "bidirectional",
} as const;

export type PortType = (typeof PORT_TYPE)[keyof typeof PORT_TYPE];

export const PORT_SIDE = {
	LEFT: "left",
	RIGHT: "right",
	OVERHEAD: "overhead",
} as const;

export type PortSide = (typeof PORT_SIDE)[keyof typeof PORT_SIDE];

export interface PortData {
	id: string;
	/** Rail this port is attached to */
	railId: string;
	/** Position along the rail (0.0 ~ 1.0) */
	ratio: number;
	equipmentType: EquipmentType;
	/** ID of the parent equipment (EQ, STK, or OHB unit) */
	equipmentId: string;
	portType: PortType;
	bayId: string;
	fabId: string;
	side: PortSide;

	// Optional grouping fields — null when not assigned
	areaId: string | null;
	moduleId: string | null;
	zoneId: string | null;
}
