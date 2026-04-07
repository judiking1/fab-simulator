/**
 * curveUtils — Shared math utilities for curve generation.
 *
 * Extracted from VOS's functionsForPath.ts.
 * Pure functions, no side effects, no Three.js scene dependencies.
 */

import { MathUtils, Vector3 } from "three";

// ---------------------------------------------------------------------------
// Linear interpolation
// ---------------------------------------------------------------------------

/**
 * Generate evenly spaced points along a straight line.
 * Port of VOS createLinearLinePoints().
 */
export function linearPoints(start: Vector3, end: Vector3, divisions = 2): Vector3[] {
	return Array.from({ length: divisions + 1 }, (_, i) =>
		new Vector3().lerpVectors(start, end, i / divisions),
	);
}

// ---------------------------------------------------------------------------
// Arc-length resampling
// ---------------------------------------------------------------------------

/**
 * Resample a polyline to have evenly-spaced points by arc length.
 * Port of VOS resampleByArcLength().
 *
 * @param pts - Dense polyline points (oversampled)
 * @param count - Number of output segments (→ count+1 points)
 */
export function resampleByArcLength(pts: Vector3[], count: number): Vector3[] {
	if (pts.length === 0) return [];
	if (pts.length === 1 || count <= 0) return [pts[0].clone()];

	const dists: number[] = [0];
	for (let i = 1; i < pts.length; i++) {
		dists[i] = dists[i - 1] + pts[i - 1].distanceTo(pts[i]);
	}
	const total = dists[dists.length - 1];
	if (total <= 1e-9) return [pts[0].clone()];

	const out: Vector3[] = [];
	for (let k = 0; k <= count; k++) {
		const target = (total * k) / count;
		let i = 1;
		while (i < dists.length && dists[i] < target) i++;
		if (i >= dists.length) {
			out.push(pts[pts.length - 1].clone());
			break;
		}
		const segLen = dists[i] - dists[i - 1];
		const t = segLen > 0 ? (target - dists[i - 1]) / segLen : 0;
		out.push(new Vector3().lerpVectors(pts[i - 1], pts[i], t));
	}
	return out;
}

// ---------------------------------------------------------------------------
// FLE/TLE assembly helper
// ---------------------------------------------------------------------------

/**
 * Assemble FLE + OLE(curve) + TLE from start/end node positions and origin data.
 *
 * This is the common pattern for all non-LINEAR, non-CSC_CURVE_HETE types.
 * If origin/FLE/TLE/OLE are not provided in options, they default to
 * start=originFrom, end=originTo, fle=0, tle=0 (curve only, no straight segments).
 */
export function assembleFleOleTle(
	start: Vector3,
	end: Vector3,
	curvePoints: Vector3[],
	options?: {
		originFrom?: Vector3;
		originTo?: Vector3;
		fle?: number;
		tle?: number;
		ole?: number;
		segments?: number;
	},
): Vector3[] {
	const segments = options?.segments ?? 500;
	const fle = options?.fle ?? 0;
	const tle = options?.tle ?? 0;
	const ole = options?.ole ?? 0;
	const originFrom = options?.originFrom ?? start;
	const originTo = options?.originTo ?? end;

	// If no FLE/TLE, just return the curve points directly
	if (fle === 0 && tle === 0) {
		return curvePoints;
	}

	const tmpSum = fle + tle + ole;
	if (tmpSum <= 0) return curvePoints;

	const segmentsOle = segments / (ole / tmpSum);
	const fleSeg = Math.floor((fle / tmpSum) * segmentsOle);
	const tleSeg = Math.floor((tle / tmpSum) * segmentsOle);

	let ret: Vector3[] = [];

	if (fleSeg > 0) {
		ret = [...linearPoints(start, originFrom, fleSeg)];
	}

	ret = [...ret, ...curvePoints];

	if (tleSeg > 0) {
		const tlePoints = linearPoints(originTo, end, tleSeg);
		ret = [...ret, ...tlePoints];
	}

	return ret;
}

// ---------------------------------------------------------------------------
// 90-degree arc (shared by CSC_CURVE_HOMO and CSC_CURVE_HETE)
// ---------------------------------------------------------------------------

/**
 * Draw a 90-degree arc between two points using direction vectors.
 * Port of VOS create90DegreeArc().
 *
 * VOS convention: uses NON-negated Z in atan2.
 * Center is found via midpoint + perpendicular offset.
 */
export function create90DegreeArc(
	p1: Vector3,
	p2: Vector3,
	beforeDir: { x: number; y: number },
	afterDir: { x: number; y: number },
	segments: number,
): Vector3[] {
	const d = p1.distanceTo(p2);
	const r = d / Math.SQRT2;

	const mid = new Vector3().addVectors(p1, p2).multiplyScalar(0.5);

	const ddx = p2.x - p1.x;
	const ddz = p2.z - p1.z;
	const len = Math.sqrt(ddx * ddx + ddz * ddz);

	if (len < 1e-9) return [p1.clone(), p2.clone()];

	const cross = beforeDir.x * afterDir.y - beforeDir.y * afterDir.x;

	const perpX = -ddz / len;
	const perpZ = ddx / len;
	const centerDist = d / 2;
	const centerSign = cross > 0 ? 1 : -1;

	const C = new Vector3(
		mid.x + perpX * centerDist * centerSign,
		p1.y,
		mid.z + perpZ * centerDist * centerSign,
	);

	const startAngle = Math.atan2(p1.z - C.z, p1.x - C.x);
	const endAngle = Math.atan2(p2.z - C.z, p2.x - C.x);

	let angleDiff = endAngle - startAngle;
	while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
	while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

	const points: Vector3[] = [];
	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const angle = startAngle + angleDiff * t;
		points.push(
			new Vector3(
				C.x + r * Math.cos(angle),
				MathUtils.lerp(p1.y, p2.y, t),
				C.z + r * Math.sin(angle),
			),
		);
	}

	return points;
}

// ---------------------------------------------------------------------------
// Dense arc generation (shared by S_CURVE and CSC_CURVE_HOMO)
// ---------------------------------------------------------------------------

/**
 * Generate a dense arc polyline from startAngle to endAngle around center C.
 * VOS convention: NON-negated Z in sin().
 */
export function generateArcPoints(
	center: Vector3,
	radius: number,
	startAngle: number,
	endAngle: number,
	startY: number,
	endY: number,
	segments: number,
): Vector3[] {
	const points: Vector3[] = [];
	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const ang = MathUtils.lerp(startAngle, endAngle, t);
		points.push(
			new Vector3(
				center.x + radius * Math.cos(ang),
				MathUtils.lerp(startY, endY, t),
				center.z + radius * Math.sin(ang),
			),
		);
	}
	return points;
}
