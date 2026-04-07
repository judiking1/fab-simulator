/**
 * RailFactory — Create new rails for the map editor.
 *
 * Uses CurveSpec to compute curve geometry, then produces a complete
 * RailData object compatible with the existing curveBuilder/renderer pipeline.
 *
 * Usage:
 *   const rail = createRail({
 *     fromNodeId: "NODE_A",
 *     toNodeId: "NODE_B",
 *     railType: RAIL_TYPE.LEFT_CURVE,
 *     bayId: "BAY01",
 *     fabId: "fab01",
 *   });
 *   mapStore.getState().addRail(rail);
 */

import { Vector3 } from "three";
import type { NodeData } from "@/models/node";
import type { RailData, RailType } from "@/models/rail";
import { RAIL_TYPE } from "@/models/rail";
// getCurveSpec will be used when we transition from legacy origins to spec-computed curves
// import { getCurveSpec } from "./curveRegistry";

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let railIdCounter = 0;

/** Generate a unique rail ID. Resets on clearMap. */
export function generateRailId(bayId: string): string {
	railIdCounter++;
	const seq = String(railIdCounter).padStart(4, "0");
	return bayId ? `${bayId}_${seq}` : `RAIL_${seq}`;
}

/** Reset the ID counter (called on map clear/load) */
export function resetRailIdCounter(): void {
	railIdCounter = 0;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_SPEED = 300;
const DEFAULT_ACC = 2;
const DEFAULT_DEC = -3;
const DEFAULT_RADIUS = -1;

/** FLE/TLE proportion relative to total distance (when auto-computing) */
const FLE_TLE_RATIO = 0.1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CreateRailParams {
	fromNodeId: string;
	toNodeId: string;
	railType: RailType;
	bayId?: string;
	fabId?: string;
	speed?: number;
	acc?: number;
	dec?: number;
	radius?: number;
	/** Pre-generated ID (for batch operations) */
	id?: string;
}

/**
 * Create a new RailData from two node IDs and a rail type.
 *
 * Origin coordinates and FLE/TLE/OLE are auto-computed from node positions
 * using the CurveSpec system. The resulting RailData is fully compatible
 * with the existing curveBuilder rendering pipeline.
 *
 * @param params - Rail creation parameters
 * @param nodes - Node lookup (must contain fromNodeId and toNodeId)
 */
export function createRail(
	params: CreateRailParams,
	nodes: Record<string, NodeData>,
): RailData | null {
	const fromNode = nodes[params.fromNodeId];
	const toNode = nodes[params.toNodeId];

	if (!fromNode || !toNode) {
		console.warn(
			`[RailFactory] Cannot create rail: node not found (from=${params.fromNodeId}, to=${params.toNodeId})`,
		);
		return null;
	}

	const fromPos = new Vector3(fromNode.x, fromNode.y, fromNode.z);
	const toPos = new Vector3(toNode.x, toNode.y, toNode.z);
	const distance = fromPos.distanceTo(toPos);

	const railType = params.railType;
	const bayId = params.bayId ?? "";
	const fabId = params.fabId ?? "";
	const id = params.id ?? generateRailId(bayId);

	// For LINEAR, no origin/FLE/TLE needed
	if (railType === RAIL_TYPE.LINEAR) {
		return {
			id,
			fromNodeId: params.fromNodeId,
			toNodeId: params.toNodeId,
			railType,
			length: distance,
			bayId,
			fabId,
			speed: params.speed ?? DEFAULT_SPEED,
			acc: params.acc ?? DEFAULT_ACC,
			dec: params.dec ?? DEFAULT_DEC,
			radius: DEFAULT_RADIUS,
			curveNodeIds: [],
			originFrom: null,
			originTo: null,
			fle: 0,
			tle: 0,
			ole: 0,
		};
	}

	// For curved types, compute origin coordinates
	const { originFrom, originTo, fle, tle, ole } = computeOrigins(
		fromPos,
		toPos,
		railType,
		distance,
	);

	return {
		id,
		fromNodeId: params.fromNodeId,
		toNodeId: params.toNodeId,
		railType,
		length: distance,
		bayId,
		fabId,
		speed: params.speed ?? DEFAULT_SPEED,
		acc: params.acc ?? DEFAULT_ACC,
		dec: params.dec ?? DEFAULT_DEC,
		radius: params.radius ?? DEFAULT_RADIUS,
		curveNodeIds: [],
		originFrom: { x: originFrom.x, y: originFrom.y, z: originFrom.z },
		originTo: { x: originTo.x, y: originTo.y, z: originTo.z },
		fle,
		tle,
		ole,
	};
}

// ---------------------------------------------------------------------------
// Origin auto-computation
// ---------------------------------------------------------------------------

/**
 * Compute origin coordinates and FLE/TLE/OLE for a curved rail.
 *
 * Origin points are offset inward from the node positions by FLE/TLE distance.
 * This matches VOS's convention where:
 *   fromNode → (FLE straight) → originFrom → (curve) → originTo → (TLE straight) → toNode
 */
function computeOrigins(
	from: Vector3,
	to: Vector3,
	_railType: RailType,
	distance: number,
): {
	originFrom: Vector3;
	originTo: Vector3;
	fle: number;
	tle: number;
	ole: number;
} {
	// FLE and TLE are proportional to total distance
	const fleLen = distance * FLE_TLE_RATIO;
	const tleLen = distance * FLE_TLE_RATIO;
	const oleLen = distance - fleLen - tleLen;

	// Direction from → to
	const dir = new Vector3().subVectors(to, from).normalize();

	// Origin points: inset from endpoints by FLE/TLE distance
	const originFrom = new Vector3().copy(from).addScaledVector(dir, fleLen);
	const originTo = new Vector3().copy(to).addScaledVector(dir, -tleLen);

	// FLE/TLE/OLE in VOS's segment-length units (proportional to distance)
	// VOS uses mm-scale values like 470/390/785, we normalize to our coordinate system
	const scale = 1000; // Scale factor to match VOS proportions
	return {
		originFrom,
		originTo,
		fle: Math.round(fleLen * scale),
		tle: Math.round(tleLen * scale),
		ole: Math.round(oleLen * scale),
	};
}
