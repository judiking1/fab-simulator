import { z } from "zod";
import { EQUIPMENT_TYPES, PORT_TYPES } from "@/models/equipment";
import { FOUP_LOCATIONS } from "@/models/foup";
import { RAIL_LINE_TYPES, RAIL_NODE_TYPES } from "@/models/rail";

// ─── Shared Schemas ──────────────────────────────────────────────

const vector3Schema = z.object({
	x: z.number(),
	y: z.number(),
	z: z.number(),
});

const rotation3Schema = z.object({
	x: z.number(),
	y: z.number(),
	z: z.number(),
});

// ─── Layout Hierarchy Schemas ────────────────────────────────────

const fabSchema = z.object({
	id: z.string(),
	name: z.string(),
	position: vector3Schema,
	rotation: rotation3Schema,
});

const baySchema = z.object({
	id: z.string(),
	fabId: z.string(),
	name: z.string(),
	position: vector3Schema,
	rotation: rotation3Schema,
});

const areaSchema = z.object({
	id: z.string(),
	bayId: z.string(),
	name: z.string(),
	position: vector3Schema,
});

const moduleSchema = z.object({
	id: z.string(),
	areaId: z.string(),
	name: z.string(),
	position: vector3Schema,
});

// ─── Equipment Schemas ───────────────────────────────────────────

const equipmentPortSchema = z.object({
	id: z.string(),
	railNodeId: z.string().nullable(),
	hasFoup: z.boolean(),
	foupId: z.string().nullable(),
	position: vector3Schema,
	portType: z.enum([PORT_TYPES.LOAD, PORT_TYPES.UNLOAD, PORT_TYPES.BIDIRECTIONAL]),
});

const foupSlotSchema = z.object({
	id: z.string(),
	hasFoup: z.boolean(),
	foupId: z.string().nullable(),
});

const processEquipmentSchema = z.object({
	type: z.literal(EQUIPMENT_TYPES.PROCESS),
	id: z.string(),
	moduleId: z.string(),
	name: z.string(),
	position: vector3Schema,
	ports: z.array(equipmentPortSchema),
	processTime: z.number(),
});

const stockerSchema = z.object({
	type: z.literal(EQUIPMENT_TYPES.STOCKER),
	id: z.string(),
	moduleId: z.string(),
	name: z.string(),
	position: vector3Schema,
	ports: z.array(equipmentPortSchema),
	slots: z.array(foupSlotSchema),
	capacity: z.number(),
});

const ohbSchema = z.object({
	type: z.literal(EQUIPMENT_TYPES.OHB),
	id: z.string(),
	moduleId: z.string(),
	name: z.string(),
	position: vector3Schema,
	ports: z.array(equipmentPortSchema),
	railNodeId: z.string(),
	capacity: z.number(),
	slots: z.array(foupSlotSchema),
});

const equipmentSchema = z.discriminatedUnion("type", [
	processEquipmentSchema,
	stockerSchema,
	ohbSchema,
]);

// ─── Rail Schemas ────────────────────────────────────────────────

const railNodeSchema = z.object({
	id: z.string(),
	fabId: z.string(),
	type: z.enum([
		RAIL_NODE_TYPES.WAYPOINT,
		RAIL_NODE_TYPES.JUNCTION,
		RAIL_NODE_TYPES.MERGE,
		RAIL_NODE_TYPES.PORT,
	]),
	position: vector3Schema,
	equipmentId: z.string().nullable(),
});

const railEdgeSchema = z.object({
	id: z.string(),
	fabId: z.string(),
	fromNodeId: z.string(),
	toNodeId: z.string(),
	distance: z.number(),
	maxSpeed: z.number(),
	lineType: z.enum([
		RAIL_LINE_TYPES.STRAIGHT,
		RAIL_LINE_TYPES.CURVE,
		RAIL_LINE_TYPES.S_CURVE,
		RAIL_LINE_TYPES.U_TURN,
	]),
	isConfluence: z.boolean(),
	isBranch: z.boolean(),
	bayId: z.string().nullable(),
	density: z.number(),
	weight: z.number(),
	enabled: z.boolean(),
	curveRadius: z.number().nullable(),
});

// ─── FOUP Schema ─────────────────────────────────────────────────

const foupSchema = z.object({
	id: z.string(),
	lotId: z.string(),
	waferCount: z.number(),
	location: z.object({
		type: z.enum([
			FOUP_LOCATIONS.EQUIPMENT_PORT,
			FOUP_LOCATIONS.STORAGE_SLOT,
			FOUP_LOCATIONS.ON_OHT,
		]),
		hostId: z.string(),
		slotId: z.string().nullable(),
	}),
});

// ─── Children Maps Schema ────────────────────────────────────────

const childrenSchema = z.object({
	fabBays: z.record(z.string(), z.array(z.string())),
	bayAreas: z.record(z.string(), z.array(z.string())),
	areaModules: z.record(z.string(), z.array(z.string())),
	moduleEquipment: z.record(z.string(), z.array(z.string())),
});

// ─── Entities Schema ────────────────────────────────────────────

const entitiesSchema = z.object({
	fabs: z.record(z.string(), fabSchema),
	bays: z.record(z.string(), baySchema),
	areas: z.record(z.string(), areaSchema),
	modules: z.record(z.string(), moduleSchema),
	equipment: z.record(z.string(), equipmentSchema),
	railNodes: z.record(z.string(), railNodeSchema),
	railEdges: z.record(z.string(), railEdgeSchema),
	foups: z.record(z.string(), foupSchema),
});

// ─── Layout File Metadata ───────────────────────────────────────

const metadataSchema = z.object({
	exportedAt: z.string(),
	entityCounts: z.object({
		fabs: z.number(),
		bays: z.number(),
		areas: z.number(),
		modules: z.number(),
		equipment: z.number(),
		railNodes: z.number(),
		railEdges: z.number(),
		foups: z.number(),
	}),
});

// ─── Full Layout File Schema ─────────────────────────────────────

export const layoutFileSchema = z.object({
	version: z.literal("1.0"),
	entities: entitiesSchema,
	children: childrenSchema,
	metadata: metadataSchema.optional(),
});

/** Legacy v1 schema for backwards compatibility */
export const layoutFileLegacySchema = z.object({
	version: z.literal(1),
	entities: entitiesSchema,
	children: childrenSchema,
});

export type LayoutFile = z.infer<typeof layoutFileSchema>;
export type LayoutFileLegacy = z.infer<typeof layoutFileLegacySchema>;
