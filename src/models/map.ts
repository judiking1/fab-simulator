/**
 * Map — The top-level file format and validation types.
 * Native format is .fab.json which preserves all metadata and grouping.
 */

import type { BayData } from "./bay";
import type { EquipmentData, EquipmentSpec } from "./equipment";
import type { NodeData } from "./node";
import type { PortData } from "./port";
import type { RailData } from "./rail";

// ---------------------------------------------------------------------------
// Grouping entities (optional user-defined hierarchy)
// ---------------------------------------------------------------------------

export interface AreaData {
	id: string;
	name: string;
	bayIds: string[];
}

export interface ModuleData {
	id: string;
	name: string;
	portIds: string[];
	equipmentType: string;
}

// ---------------------------------------------------------------------------
// Vehicle initial placement
// ---------------------------------------------------------------------------

export interface VehiclePresetData {
	id: string;
	/** Rail the vehicle starts on */
	railId: string;
	/** Position along the rail (0.0 ~ 1.0) */
	ratio: number;
}

// ---------------------------------------------------------------------------
// Native file format (.fab.json)
// ---------------------------------------------------------------------------

export interface FabMapMetadata {
	name: string;
	author?: string;
	createdAt: string;
	updatedAt: string;
	description?: string;
}

export interface FabMapFile {
	/** Schema version for forward-compatible migration */
	version: string;
	metadata: FabMapMetadata;

	// Core simulation data (Record for O(1) lookup by ID)
	nodes: Record<string, NodeData>;
	rails: Record<string, RailData>;
	ports: Record<string, PortData>;

	// Topology
	bays: Record<string, BayData>;

	// Equipment (optional for backward compat — derived from ports if absent)
	equipment?: Record<string, EquipmentData>;
	equipmentSpecs?: Record<string, EquipmentSpec>;

	// User-defined grouping (extensible, optional)
	areas?: Record<string, AreaData>;
	modules?: Record<string, ModuleData>;

	// Simulation presets
	vehiclePresets?: VehiclePresetData[];
}

// ---------------------------------------------------------------------------
// Map validation result (pre-simulation check)
// ---------------------------------------------------------------------------

export interface MapValidation {
	isValid: boolean;
	/** Bays unreachable from other bays */
	disconnectedBays: string[];
	/** Bays whose rail sequence doesn't form a closed loop */
	openLoopBays: string[];
	/** Ports on rails not belonging to any bay */
	unreachablePorts: string[];
	/** Non-critical issues */
	warnings: string[];
}
