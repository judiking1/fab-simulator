/**
 * Preset — Bay templates for batch creation.
 * All coordinates are relative to a (0,0,0) origin; instantiation
 * offsets them to the user-specified placement position.
 */

import type { EquipmentType, PortSide, PortType } from "./port";
import type { RailType } from "./rail";

export interface BayPreset {
	name: string;
	description: string;
	/** Optional preview image (data URI or asset path) */
	thumbnail?: string;

	/** Relative-coordinate node positions */
	nodes: { relX: number; relY: number; relZ: number }[];

	/** Rail definitions referencing nodes by index */
	rails: {
		fromNodeIndex: number;
		toNodeIndex: number;
		railType: RailType;
		radius: number;
		length: number;
	}[];

	/** Port definitions referencing rails by index */
	ports: {
		railIndex: number;
		ratio: number;
		equipmentType: EquipmentType;
		portType: PortType;
		side: PortSide;
	}[];
}
