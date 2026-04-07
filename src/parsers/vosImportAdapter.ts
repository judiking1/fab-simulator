/**
 * vosImportAdapter — Converts VOS .map CSV files to our internal model.
 *
 * This is the ONLY module that references VOS terminology (edge, station,
 * barcode, vos_rail_type, etc.). All outputs use our domain terms:
 *   VOS edge    -> Rail
 *   VOS station -> Port
 *   VOS node    -> Node
 *
 * Coordinate mapping (VOS editor space -> Three.js Y-up):
 *   editor_x -> x  (lateral)
 *   editor_z -> y  (height / up)
 *   editor_y -> z  (depth)
 *
 * Pure functions. No React, no Zustand, no DOM.
 */

import type { BayData } from "@/models/bay";
import type { FabMapFile } from "@/models/map";
import type { NodeData } from "@/models/node";
import type { EquipmentType, PortData, PortSide, PortType } from "@/models/port";
import { EQUIPMENT_TYPE, PORT_SIDE, PORT_TYPE } from "@/models/port";
import type { RailData, RailType } from "@/models/rail";
import { RAIL_TYPE } from "@/models/rail";
import {
	type ParseWarnings,
	parseBracketList,
	parseCsvText,
	requireField,
	safeParseFloat,
} from "./csvUtils";

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

export interface VosNodeResult {
	nodes: Record<string, NodeData>;
	/** Sorted array of (nodeId, barcode) for binary search in station positioning. */
	barcodeMap: BarcodeEntry[];
	/** nodeId -> barcode value lookup. */
	barcodeLookup: Record<string, number>;
	warnings: ParseWarnings;
}

export interface VosEdgeResult {
	rails: Record<string, RailData>;
	bays: Record<string, BayData>;
	warnings: ParseWarnings;
}

export interface VosStationResult {
	ports: Record<string, PortData>;
	warnings: ParseWarnings;
}

export interface VosImportResult {
	map: FabMapFile;
	warnings: {
		nodes: ParseWarnings;
		edges: ParseWarnings;
		stations: ParseWarnings;
	};
}

/** A single barcode entry for binary search. */
export interface BarcodeEntry {
	nodeId: string;
	barcode: number;
}

// ---------------------------------------------------------------------------
// VOS rail type mapping
// ---------------------------------------------------------------------------

const VOS_RAIL_TYPE_MAP: Record<string, RailType> = {
	LINEAR: RAIL_TYPE.LINEAR,
	CURVE: RAIL_TYPE.CURVE,
	LEFT_CURVE: RAIL_TYPE.LEFT_CURVE,
	RIGHT_CURVE: RAIL_TYPE.RIGHT_CURVE,
	CCW_CURVE: RAIL_TYPE.LEFT_CURVE, // VOS: same as LEFT_CURVE
	CW_CURVE: RAIL_TYPE.RIGHT_CURVE, // VOS: same as RIGHT_CURVE
	S_CURVE: RAIL_TYPE.S_CURVE,
	S_CURVE_50: RAIL_TYPE.S_CURVE,
	CSC_CURVE_HOMO: RAIL_TYPE.CSC_CURVE_HOMO,
	CSC_CURVE_HETE: RAIL_TYPE.CSC_CURVE_HETE,
};

function mapRailType(vosType: string): RailType {
	return VOS_RAIL_TYPE_MAP[vosType.trim().toUpperCase()] ?? RAIL_TYPE.LINEAR;
}

// ---------------------------------------------------------------------------
// VOS equipment type mapping
// ---------------------------------------------------------------------------

const VOS_EQUIPMENT_TYPE_MAP: Record<string, EquipmentType> = {
	OHB: EQUIPMENT_TYPE.OHB,
	STK: EQUIPMENT_TYPE.STK,
	EQ: EQUIPMENT_TYPE.EQ,
};

function mapEquipmentType(vosType: string): EquipmentType {
	return VOS_EQUIPMENT_TYPE_MAP[vosType.trim().toUpperCase()] ?? EQUIPMENT_TYPE.EQ;
}

// ---------------------------------------------------------------------------
// VOS port_type_code mapping
// ---------------------------------------------------------------------------

/**
 * VOS port_type_code numeric values:
 *   2 -> unload
 *   3 -> bidirectional (OHB overhead)
 *   4 -> load
 */
function mapPortType(code: string): PortType {
	switch (code.trim()) {
		case "2":
			return PORT_TYPE.UNLOAD;
		case "3":
			return PORT_TYPE.BIDIRECTIONAL;
		case "4":
			return PORT_TYPE.LOAD;
		default:
			return PORT_TYPE.BIDIRECTIONAL;
	}
}

// ---------------------------------------------------------------------------
// VOS direction_code -> PortSide mapping
// ---------------------------------------------------------------------------

/**
 * VOS direction_code determines which side of the rail the port is on.
 * Combined with station_name first digit:
 *   1 -> left (inside the bay loop)
 *   2 -> right (outside the bay loop)
 *   3 -> overhead (directly on rail, e.g. OHB)
 */
function mapPortSide(directionCode: string, stationName: string): PortSide {
	const code = directionCode.trim();
	if (code === "3") return PORT_SIDE.OVERHEAD;

	// Use station_name first character: 1=left, 2=right
	const firstChar = stationName.charAt(0);
	if (firstChar === "1") return PORT_SIDE.LEFT;
	if (firstChar === "2") return PORT_SIDE.RIGHT;

	// Fallback: direction_code 1=left, 2=right
	if (code === "1") return PORT_SIDE.LEFT;
	if (code === "2") return PORT_SIDE.RIGHT;

	return PORT_SIDE.OVERHEAD;
}

// =========================================================================
// 1. parseVosNodeMap
// =========================================================================

/**
 * Parse VOS `node.map` CSV text into internal `NodeData` records.
 *
 * Column mapping:
 * - `node_name` -> `id`
 * - `editor_x`  -> `x` (lateral, same axis)
 * - `editor_z`  -> `y` (VOS Z-up becomes Three.js Y-up)
 * - `editor_y`  -> `z` (VOS Y-depth becomes Three.js Z-depth)
 *
 * Also produces a sorted barcode map for station position resolution.
 *
 * @param csvText - Raw text content of the VOS node.map file
 * @returns Parsed nodes, barcode maps, and any warnings
 */
export function parseVosNodeMap(csvText: string): VosNodeResult {
	const { rows, warnings } = parseCsvText(csvText);
	const nodes: Record<string, NodeData> = {};
	const barcodeEntries: BarcodeEntry[] = [];
	const barcodeLookup: Record<string, number> = {};

	for (const row of rows) {
		const id = requireField(row, "node_name");
		if (!id) {
			warnings.skippedRows.push({ line: -1, reason: "Missing node_name" });
			continue;
		}

		const editorX = safeParseFloat(row["editor_x"], 0);
		const editorY = safeParseFloat(row["editor_y"], 0);
		const editorZ = safeParseFloat(row["editor_z"], 0);
		const barcode = safeParseFloat(row["barcode"], 0);

		// Coordinate swap: VOS editor_x->X, editor_z->Y(up), editor_y->Z(depth)
		nodes[id] = {
			id,
			x: editorX,
			y: editorZ,
			z: editorY,
		};

		barcodeEntries.push({ nodeId: id, barcode });
		barcodeLookup[id] = barcode;
	}

	// Sort by barcode value for binary search
	barcodeEntries.sort((a, b) => a.barcode - b.barcode);

	return { nodes, barcodeMap: barcodeEntries, barcodeLookup, warnings };
}

// =========================================================================
// 2. parseVosEdgeMap
// =========================================================================

/**
 * Parse VOS `edge.map` CSV text into internal `RailData` and `BayData` records.
 *
 * Column mapping:
 * - `rail_name`     -> `id`
 * - `from_node`     -> `fromNodeId`
 * - `to_node`       -> `toNodeId`
 * - `vos_rail_type` -> `railType` (via mapping table)
 * - `distance`      -> `length`
 * - `bay_name`      -> `bayId`
 * - `fab_id`        -> `fabId`
 * - `speed`         -> `speed`
 * - `acc`           -> `acc`
 * - `dec`           -> `dec`
 * - `radius`        -> `radius` (-1 for LINEAR)
 * - `nodes`         -> `curveNodeIds` (for CSC_CURVE_HETE: intermediate nodes)
 *
 * Bays are built by collecting rails per `bay_name` in encounter order.
 *
 * @param csvText - Raw text content of the VOS edge.map file
 * @param nodes   - Previously parsed nodes (for validation only)
 * @returns Parsed rails, bays, and any warnings
 */
export function parseVosEdgeMap(csvText: string, nodes: Record<string, NodeData>): VosEdgeResult {
	const { rows, warnings } = parseCsvText(csvText);
	const rails: Record<string, RailData> = {};

	// Collect rails per bay in encounter order
	const bayRailIds: Map<string, string[]> = new Map();
	const bayFabIds: Map<string, string> = new Map();

	for (const row of rows) {
		const id = requireField(row, "rail_name");
		const fromNodeId = requireField(row, "from_node");
		const toNodeId = requireField(row, "to_node");

		if (!id || !fromNodeId || !toNodeId) {
			warnings.skippedRows.push({
				line: -1,
				reason: `Missing required field(s) in edge row: rail_name=${id}, from_node=${fromNodeId}, to_node=${toNodeId}`,
			});
			continue;
		}

		// Validate node references
		if (!nodes[fromNodeId]) {
			warnings.skippedRows.push({
				line: -1,
				reason: `Rail ${id}: fromNode '${fromNodeId}' not found in node map`,
			});
		}
		if (!nodes[toNodeId]) {
			warnings.skippedRows.push({
				line: -1,
				reason: `Rail ${id}: toNode '${toNodeId}' not found in node map`,
			});
		}

		const vosRailType = row["vos_rail_type"] ?? "LINEAR";
		const railType = mapRailType(vosRailType);
		const radius = safeParseFloat(row["radius"], -1);
		const bayId = row["bay_name"] ?? "";
		const fabId = row["fab_id"] ?? "";

		// Parse intermediate curve nodes from "[NODE1 NODE2 ...]" format
		const nodesField = row["nodes"] ?? "";
		const allNodesInField = parseBracketList(nodesField);

		// For CSC_CURVE_HETE/HOMO, intermediate nodes are between first and last
		// The nodes field contains: [fromNode, ...intermediates, toNode]
		// We extract only the intermediates (indices 1..n-2)
		let curveNodeIds: string[] = [];
		if (railType === RAIL_TYPE.CSC_CURVE_HETE || railType === RAIL_TYPE.CSC_CURVE_HOMO) {
			if (allNodesInField.length > 2) {
				curveNodeIds = allNodesInField.slice(1, -1);
			}
		}

		// Parse origin coordinates (VOS axis swap: origin_from_z → Y, origin_from_y → Z)
		const hasOrigin = row["origin_from_x"] !== undefined && row["origin_from_x"] !== "";
		const originFrom = hasOrigin
			? {
					x: safeParseFloat(row["origin_from_x"], 0),
					y: safeParseFloat(row["origin_from_z"], 0), // Z→Y swap
					z: safeParseFloat(row["origin_from_y"], 0), // Y→Z swap
				}
			: null;
		const originTo = hasOrigin
			? {
					x: safeParseFloat(row["origin_to_x"], 0),
					y: safeParseFloat(row["origin_to_z"], 0), // Z→Y swap
					z: safeParseFloat(row["origin_to_y"], 0), // Y→Z swap
				}
			: null;

		const fle = safeParseFloat(row["fle"], 0);
		const tle = safeParseFloat(row["tle"], 0);
		const ole = safeParseFloat(row["ole"], 0);

		const rail: RailData = {
			id,
			fromNodeId,
			toNodeId,
			railType,
			length: safeParseFloat(row["distance"], 0),
			bayId,
			fabId,
			speed: safeParseFloat(row["speed"], 300),
			acc: safeParseFloat(row["acc"], 2),
			dec: safeParseFloat(row["dec"], -3),
			radius,
			curveNodeIds,
			originFrom,
			originTo,
			fle,
			tle,
			ole,
		};

		rails[id] = rail;

		// Accumulate rails per bay
		if (bayId) {
			let list = bayRailIds.get(bayId);
			if (!list) {
				list = [];
				bayRailIds.set(bayId, list);
			}
			list.push(id);

			if (!bayFabIds.has(bayId)) {
				bayFabIds.set(bayId, fabId);
			}
		}
	}

	// Build BayData records
	const bays: Record<string, BayData> = {};
	for (const [bayId, railIds] of bayRailIds) {
		bays[bayId] = {
			id: bayId,
			fabId: bayFabIds.get(bayId) ?? "",
			railIds,
			loopDirection: "ccw", // VOS default: counter-clockwise
		};
	}

	return { rails, bays, warnings };
}

// =========================================================================
// 3. parseVosStationMap — barcode resolution helpers
// =========================================================================

/**
 * Binary search in sorted barcode entries to find two bracketing nodes.
 *
 * Returns the indices of the two entries that bracket `targetBarcode`,
 * or `null` if out of range.
 */
function findBracketingNodes(
	targetBarcode: number,
	sortedBarcodes: BarcodeEntry[],
): { startIdx: number; endIdx: number } | null {
	if (sortedBarcodes.length === 0) return null;

	let left = 0;
	let right = sortedBarcodes.length - 1;

	const firstEntry = sortedBarcodes[0];
	const lastEntry = sortedBarcodes[right];
	if (!firstEntry || !lastEntry) return null;

	// Out of range
	if (targetBarcode < firstEntry.barcode || targetBarcode > lastEntry.barcode) {
		return null;
	}

	// Binary search for the insertion point
	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const midEntry = sortedBarcodes[mid];
		if (!midEntry) return null;

		if (targetBarcode === midEntry.barcode) {
			// Exact match — same node on both sides
			return { startIdx: mid, endIdx: mid };
		}

		if (targetBarcode < midEntry.barcode) {
			right = mid - 1;
		} else {
			left = mid + 1;
		}
	}

	// After binary search: right < left, target is between sortedBarcodes[right] and sortedBarcodes[left]
	if (right < 0 || left >= sortedBarcodes.length) return null;

	return { startIdx: right, endIdx: left };
}

/**
 * Build a lookup from "fromNodeId-toNodeId" to railId for barcode resolution.
 * Both directions are stored since barcode order may not match rail direction.
 */
function buildNodePairToRailMap(rails: Record<string, RailData>): Map<string, string> {
	const map = new Map<string, string>();
	for (const rail of Object.values(rails)) {
		map.set(`${rail.fromNodeId}-${rail.toNodeId}`, rail.id);
		// Also store reverse for lookup (barcode order may differ from rail direction)
		map.set(`${rail.toNodeId}-${rail.fromNodeId}`, rail.id);
	}
	return map;
}

/**
 * Resolve a VOS barcode_x value to a railId and ratio.
 *
 * The VOS station.map uses barcode_x as a 1D coordinate along the rail network.
 * Resolution:
 *  1. Binary search in sorted barcodes to find two bracketing nodes
 *  2. Find the rail connecting those nodes
 *  3. Calculate ratio = (barcode - startBarcode) / (endBarcode - startBarcode)
 */
function resolveBarcodeToRailPosition(
	barcodeX: number,
	sortedBarcodes: BarcodeEntry[],
	barcodeLookup: Record<string, number>,
	nodePairToRail: Map<string, string>,
): { railId: string; ratio: number } | null {
	const bracket = findBracketingNodes(barcodeX, sortedBarcodes);
	if (!bracket) return null;

	const startEntry = sortedBarcodes[bracket.startIdx];
	const endEntry = sortedBarcodes[bracket.endIdx];
	if (!startEntry || !endEntry) return null;

	const startNodeId = startEntry.nodeId;
	const endNodeId = endEntry.nodeId;

	// Exact match on a single node — try to find a rail that has this node
	if (startNodeId === endNodeId) {
		// Find any rail that connects from or to this node and use ratio 0.0 or 1.0
		const railId = findRailWithNode(startNodeId, nodePairToRail);
		if (!railId) return null;
		return { railId, ratio: 0.0 };
	}

	// Find the rail connecting these two nodes
	const railId =
		nodePairToRail.get(`${startNodeId}-${endNodeId}`) ??
		nodePairToRail.get(`${endNodeId}-${startNodeId}`);

	if (!railId) return null;

	const startBarcode = barcodeLookup[startNodeId];
	const endBarcode = barcodeLookup[endNodeId];

	if (startBarcode === undefined || endBarcode === undefined) return null;

	const denom = endBarcode - startBarcode;
	if (Math.abs(denom) < 1e-12) return null;

	const ratio = (barcodeX - startBarcode) / denom;

	// Clamp ratio to [0, 1] to handle minor floating point issues
	const clampedRatio = Math.max(0, Math.min(1, ratio));

	// If the rail direction is reversed relative to barcode order,
	// we need to check and potentially flip the ratio
	const forwardKey = `${startNodeId}-${endNodeId}`;
	const isForward = nodePairToRail.has(forwardKey);

	return {
		railId,
		ratio: isForward ? clampedRatio : 1 - clampedRatio,
	};
}

/**
 * Find any rail that has the given node as from or to.
 */
function findRailWithNode(nodeId: string, nodePairToRail: Map<string, string>): string | null {
	for (const [key, railId] of nodePairToRail) {
		if (key.startsWith(`${nodeId}-`) || key.endsWith(`-${nodeId}`)) {
			return railId;
		}
	}
	return null;
}

// =========================================================================
// 3. parseVosStationMap
// =========================================================================

/**
 * Parse VOS `station.map` CSV text into internal `PortData` records.
 *
 * Column mapping:
 * - `station_name`   -> `id`
 * - `station_type`   -> `equipmentType` (OHB/STK/EQ)
 * - `bay_name`       -> `bayId`
 * - `port_id`        -> `equipmentId`
 * - `port_type_code` -> `portType` (2=unload, 3=bidirectional, 4=load)
 * - `rail_name`      -> `railId` (preferred; fallback to barcode resolution)
 * - `direction_code` -> `side` (1=left, 2=right, 3=overhead)
 *
 * Position resolution:
 * - If `rail_name` is present, use barcode_x to compute ratio on that rail
 * - Otherwise, fall back to full barcode binary search across all rails
 *
 * @param csvText        - Raw text content of the VOS station.map file
 * @param rails          - Previously parsed rails
 * @param sortedBarcodes - Sorted barcode entries from node parsing
 * @param barcodeLookup  - nodeId -> barcode value lookup
 * @returns Parsed ports and any warnings
 */
export function parseVosStationMap(
	csvText: string,
	rails: Record<string, RailData>,
	sortedBarcodes: BarcodeEntry[],
	barcodeLookup: Record<string, number>,
): VosStationResult {
	const { rows, warnings } = parseCsvText(csvText);
	const ports: Record<string, PortData> = {};

	const nodePairToRail = buildNodePairToRailMap(rails);

	for (const row of rows) {
		const stationName = requireField(row, "station_name");
		if (!stationName) {
			warnings.skippedRows.push({ line: -1, reason: "Missing station_name" });
			continue;
		}

		const barcodeX = safeParseFloat(row["barcode_x"], 0);
		const stationType = row["station_type"] ?? "EQ";
		const bayName = row["bay_name"] ?? "";
		const scId = row["sc_id"] ?? row["port_id"] ?? stationName;
		const portTypeCode = row["port_type_code"] ?? "3";
		const directionCode = row["direction_code"] ?? "3";
		const vosRailName = row["rail_name"] ?? "";
		const fabId = findFabIdForBay(bayName, rails);

		// Resolve position: rail + ratio
		let railId: string;
		let ratio: number;

		if (vosRailName && rails[vosRailName]) {
			// Preferred path: station.map already specifies the rail
			railId = vosRailName;

			// Calculate ratio from barcode on this specific rail
			const rail = rails[vosRailName];
			if (rail) {
				ratio = computeRatioOnRail(rail, barcodeX, barcodeLookup);
			} else {
				ratio = 0;
			}
		} else {
			// Fallback: resolve barcode across the entire network
			const resolved = resolveBarcodeToRailPosition(
				barcodeX,
				sortedBarcodes,
				barcodeLookup,
				nodePairToRail,
			);

			if (!resolved) {
				warnings.skippedRows.push({
					line: -1,
					reason: `Station ${stationName}: could not resolve barcode_x=${barcodeX} to a rail position`,
				});
				continue;
			}

			railId = resolved.railId;
			ratio = resolved.ratio;
		}

		const port: PortData = {
			id: stationName,
			railId,
			ratio,
			equipmentType: mapEquipmentType(stationType),
			equipmentId: scId,
			portType: mapPortType(portTypeCode),
			bayId: bayName,
			fabId,
			side: mapPortSide(directionCode, stationName),
			areaId: null,
			moduleId: null,
			zoneId: null,
		};

		ports[stationName] = port;
	}

	return { ports, warnings };
}

/**
 * Compute ratio of a barcode position on a specific rail.
 *
 * Uses the rail's fromNode and toNode barcodes to calculate where the
 * barcode_x falls on the rail (0.0 = fromNode, 1.0 = toNode).
 */
function computeRatioOnRail(
	rail: RailData,
	barcodeX: number,
	barcodeLookup: Record<string, number>,
): number {
	const fromBarcode = barcodeLookup[rail.fromNodeId];
	const toBarcode = barcodeLookup[rail.toNodeId];

	if (fromBarcode === undefined || toBarcode === undefined) return 0;

	const denom = toBarcode - fromBarcode;
	if (Math.abs(denom) < 1e-12) return 0;

	const ratio = (barcodeX - fromBarcode) / denom;
	return Math.max(0, Math.min(1, ratio));
}

/**
 * Find the fabId for a bay by looking at any rail belonging to it.
 */
function findFabIdForBay(bayId: string, rails: Record<string, RailData>): string {
	for (const rail of Object.values(rails)) {
		if (rail.bayId === bayId) return rail.fabId;
	}
	return "";
}

// =========================================================================
// 4. importVosMap — High-level orchestrator
// =========================================================================

/**
 * Import VOS .map CSV files and produce a complete `FabMapFile`.
 *
 * Orchestrates the three-phase parsing pipeline:
 *  1. node.map  -> NodeData + barcode maps
 *  2. edge.map  -> RailData + BayData
 *  3. station.map -> PortData (using barcode resolution)
 *
 * @param nodesCsv    - Raw text of VOS node.map
 * @param edgesCsv    - Raw text of VOS edge.map
 * @param stationsCsv - Raw text of VOS station.map
 * @returns Complete FabMapFile ready for the store, plus warnings
 */
export function importVosMap(
	nodesCsv: string,
	edgesCsv: string,
	stationsCsv: string,
): VosImportResult {
	// Phase 1: Nodes + barcode infrastructure
	const nodeResult = parseVosNodeMap(nodesCsv);

	// Phase 2: Rails + bays (needs nodes for validation)
	const edgeResult = parseVosEdgeMap(edgesCsv, nodeResult.nodes);

	// Phase 3: Ports (needs rails and barcodes for positioning)
	const stationResult = parseVosStationMap(
		stationsCsv,
		edgeResult.rails,
		nodeResult.barcodeMap,
		nodeResult.barcodeLookup,
	);

	const now = new Date().toISOString();

	const map: FabMapFile = {
		version: "1.0.0",
		metadata: {
			name: "VOS Import",
			author: "VOS Import Adapter",
			createdAt: now,
			updatedAt: now,
			description: "Imported from VOS .map CSV files",
		},
		nodes: nodeResult.nodes,
		rails: edgeResult.rails,
		ports: stationResult.ports,
		bays: edgeResult.bays,
	};

	return {
		map,
		warnings: {
			nodes: nodeResult.warnings,
			edges: edgeResult.warnings,
			stations: stationResult.warnings,
		},
	};
}
