/**
 * csvParser — Parse our custom CSV format (nodes.csv, rails.csv, ports.csv).
 *
 * Unlike vosImportAdapter, these parsers do NO coordinate transformation.
 * Our CSV format already uses Y-up coordinates and our own column names.
 *
 * Pure functions. No React, no Zustand, no DOM.
 */

import type { NodeData } from "@/models/node";
import type { EquipmentType, PortData, PortSide, PortType } from "@/models/port";
import { EQUIPMENT_TYPE, PORT_SIDE, PORT_TYPE } from "@/models/port";
import type { RailData, RailType } from "@/models/rail";
import { RAIL_TYPE } from "@/models/rail";
import { parseBracketList, parseCsvText, requireField, safeParseFloat } from "./csvUtils";

// ---------------------------------------------------------------------------
// Rail type validation
// ---------------------------------------------------------------------------

const VALID_RAIL_TYPES = new Set<string>(Object.values(RAIL_TYPE));

function toRailType(raw: string): RailType {
	const upper = raw.trim().toUpperCase();
	if (VALID_RAIL_TYPES.has(upper)) return upper as RailType;
	return RAIL_TYPE.LINEAR;
}

// ---------------------------------------------------------------------------
// Equipment type validation
// ---------------------------------------------------------------------------

const VALID_EQUIPMENT_TYPES = new Set<string>(Object.values(EQUIPMENT_TYPE));

function toEquipmentType(raw: string): EquipmentType {
	const upper = raw.trim().toUpperCase();
	if (VALID_EQUIPMENT_TYPES.has(upper)) return upper as EquipmentType;
	return EQUIPMENT_TYPE.EQ;
}

// ---------------------------------------------------------------------------
// Port type validation
// ---------------------------------------------------------------------------

const PORT_TYPE_MAP: Record<string, PortType> = {
	load: PORT_TYPE.LOAD,
	unload: PORT_TYPE.UNLOAD,
	bidirectional: PORT_TYPE.BIDIRECTIONAL,
};

function toPortType(raw: string): PortType {
	return PORT_TYPE_MAP[raw.trim().toLowerCase()] ?? PORT_TYPE.BIDIRECTIONAL;
}

// ---------------------------------------------------------------------------
// Port side validation
// ---------------------------------------------------------------------------

const PORT_SIDE_MAP: Record<string, PortSide> = {
	left: PORT_SIDE.LEFT,
	right: PORT_SIDE.RIGHT,
	overhead: PORT_SIDE.OVERHEAD,
};

function toPortSide(raw: string): PortSide {
	return PORT_SIDE_MAP[raw.trim().toLowerCase()] ?? PORT_SIDE.OVERHEAD;
}

// ---------------------------------------------------------------------------
// 1. parseNodesCSV
// ---------------------------------------------------------------------------

/**
 * Parse our `nodes.csv` format into internal `NodeData` records.
 *
 * Expected columns: id, x, y, z
 * Coordinates are already in Y-up Three.js convention.
 */
export function parseNodesCSV(csvText: string): Record<string, NodeData> {
	const { rows } = parseCsvText(csvText);
	const nodes: Record<string, NodeData> = {};

	for (const row of rows) {
		const id = requireField(row, "id");
		if (!id) continue;

		nodes[id] = {
			id,
			x: safeParseFloat(row["x"], 0),
			y: safeParseFloat(row["y"], 0),
			z: safeParseFloat(row["z"], 0),
		};
	}

	return nodes;
}

// ---------------------------------------------------------------------------
// 2. parseRailsCSV
// ---------------------------------------------------------------------------

/**
 * Parse our `rails.csv` format into internal `RailData` records.
 *
 * Expected columns:
 *   id, fromNodeId, toNodeId, railType, bayId, fabId,
 *   speed, acc, dec, radius,
 *   originFromX, originFromY, originFromZ, originToX, originToY, originToZ,
 *   fle, tle, ole, curveNodes
 *
 * Optional column: length (computed from geometry if absent)
 */
export function parseRailsCSV(csvText: string): Record<string, RailData> {
	const { rows } = parseCsvText(csvText);
	const rails: Record<string, RailData> = {};

	for (const row of rows) {
		const id = requireField(row, "id");
		const fromNodeId = requireField(row, "fromNodeId");
		const toNodeId = requireField(row, "toNodeId");
		if (!id || !fromNodeId || !toNodeId) continue;

		const railType = toRailType(row["railType"] ?? "LINEAR");
		const radius = safeParseFloat(row["radius"], -1);

		// Parse origin coordinates (already Y-up in our CSV)
		const hasOriginFrom = row["originFromX"] !== undefined && row["originFromX"] !== "";
		const originFrom = hasOriginFrom
			? {
					x: safeParseFloat(row["originFromX"], 0),
					y: safeParseFloat(row["originFromY"], 0),
					z: safeParseFloat(row["originFromZ"], 0),
				}
			: null;
		const originTo = hasOriginFrom
			? {
					x: safeParseFloat(row["originToX"], 0),
					y: safeParseFloat(row["originToY"], 0),
					z: safeParseFloat(row["originToZ"], 0),
				}
			: null;

		// Parse curve nodes from "[NODE1 NODE2 ...]" format
		const curveNodeIds = parseBracketList(row["curveNodes"] ?? "");

		rails[id] = {
			id,
			fromNodeId,
			toNodeId,
			railType,
			length: safeParseFloat(row["length"], 0),
			bayId: row["bayId"] ?? "",
			fabId: row["fabId"] ?? "",
			speed: safeParseFloat(row["speed"], 300),
			acc: safeParseFloat(row["acc"], 2),
			dec: safeParseFloat(row["dec"], -3),
			radius,
			curveNodeIds,
			originFrom,
			originTo,
			fle: safeParseFloat(row["fle"], 0),
			tle: safeParseFloat(row["tle"], 0),
			ole: safeParseFloat(row["ole"], 0),
		};
	}

	return rails;
}

// ---------------------------------------------------------------------------
// 3. parsePortsCSV
// ---------------------------------------------------------------------------

/**
 * Parse our `ports.csv` format into internal `PortData` records.
 *
 * Expected columns:
 *   id, railId, ratio, equipmentType, equipmentId, portType,
 *   bayId, fabId, side, zoneId, moduleId
 *
 * Optional: areaId
 */
export function parsePortsCSV(csvText: string): Record<string, PortData> {
	const { rows } = parseCsvText(csvText);
	const ports: Record<string, PortData> = {};

	for (const row of rows) {
		const id = requireField(row, "id");
		const railId = requireField(row, "railId");
		if (!id || !railId) continue;

		ports[id] = {
			id,
			railId,
			ratio: safeParseFloat(row["ratio"], 0),
			equipmentType: toEquipmentType(row["equipmentType"] ?? "EQ"),
			equipmentId: row["equipmentId"] ?? id,
			portType: toPortType(row["portType"] ?? "bidirectional"),
			bayId: row["bayId"] ?? "",
			fabId: row["fabId"] ?? "",
			side: toPortSide(row["side"] ?? "overhead"),
			areaId: row["areaId"] || null,
			moduleId: row["moduleId"] || null,
			zoneId: row["zoneId"] || null,
		};
	}

	return ports;
}
