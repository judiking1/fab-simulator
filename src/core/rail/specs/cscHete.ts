/**
 * CscHeteSpec — CSC_CURVE_HETE: Line-Arc-Line-Arc-Line with 6 waypoints.
 *
 * Unlike other specs, CSC_CURVE_HETE bypasses FLE/TLE and uses
 * 6 waypoint coordinates directly. Waypoints are provided via
 * options.waypoints (absolute coordinates, not node references).
 *
 * VOS convention: uses NON-negated Z in atan2.
 */

import { Vector3 } from "three";
import { RAIL_TYPE } from "@/models/rail";
import type { CurveOptions, CurveSpec } from "../CurveSpec";
import { create90DegreeArc, linearPoints, resampleByArcLength } from "../curveUtils";

function buildCscHetePoints(
	waypoints: Vector3[],
	lengthCount: number,
): Vector3[] {
	if (waypoints.length !== 6) {
		return [waypoints[0]?.clone() ?? new Vector3(), waypoints[5]?.clone() ?? new Vector3()];
	}

	const calcDir = (from: Vector3, to: Vector3): { x: number; y: number } => {
		const ddx = to.x - from.x;
		const ddz = to.z - from.z;
		const len = Math.sqrt(ddx * ddx + ddz * ddz);
		return len > 1e-9 ? { x: ddx / len, y: ddz / len } : { x: 1, y: 0 };
	};

	const dir01 = calcDir(waypoints[0], waypoints[1]);
	const dir23 = calcDir(waypoints[2], waypoints[3]);
	const dir45 = calcDir(waypoints[4], waypoints[5]);

	const arcSegments = Math.max(32, Math.round(lengthCount / 3));
	const lineSegments = Math.max(8, Math.round(lengthCount / 6));

	const dense: Vector3[] = [];

	// 1. Line: [0] → [1]
	const line1 = linearPoints(waypoints[0], waypoints[1], lineSegments);
	dense.push(...line1);

	// 2. Arc: [1] → [2]
	const arc1 = create90DegreeArc(waypoints[1], waypoints[2], dir01, dir23, arcSegments);
	dense.push(...arc1.slice(1));

	// 3. Line: [2] → [3]
	const line2 = linearPoints(waypoints[2], waypoints[3], lineSegments);
	dense.push(...line2.slice(1));

	// 4. Arc: [3] → [4]
	const arc2 = create90DegreeArc(waypoints[3], waypoints[4], dir23, dir45, arcSegments);
	dense.push(...arc2.slice(1));

	// 5. Line: [4] → [5]
	const line3 = linearPoints(waypoints[4], waypoints[5], lineSegments);
	dense.push(...line3.slice(1));

	return resampleByArcLength(dense, lengthCount);
}

export const cscHeteSpec: CurveSpec = {
	type: RAIL_TYPE.CSC_CURVE_HETE,

	generateCurve(from: Vector3, to: Vector3, options?: CurveOptions): Vector3[] {
		const segments = options?.segments ?? 500;

		// CSC_CURVE_HETE requires 6 waypoints
		if (!options?.waypoints || options.waypoints.length !== 6) {
			return [from.clone(), to.clone()];
		}

		const waypoints = options.waypoints.map(
			(p) => new Vector3(p.x, p.y, p.z),
		);

		return buildCscHetePoints(waypoints, segments);
	},
};
