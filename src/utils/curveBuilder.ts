/**
 * curveBuilder.ts — Build Three.js curves from rail data.
 *
 * VOS edge geometry is composed of THREE segments:
 *   1. FLE (Front Linear Element): straight line from fromNode → originFrom
 *   2. Curve (OLE): the actual curve from originFrom → originTo
 *   3. TLE (Tail Linear Element): straight line from originTo → toNode
 *
 * For LINEAR rails, the entire path is a straight line (no FLE/TLE/OLE).
 *
 * Coordinate system: Y-up. All input positions must be in Y-up world space.
 */

import { CatmullRomCurve3, QuadraticBezierCurve3, Vector3 } from "three";
import type { RailData } from "@/models/rail";
import { RAIL_TYPE } from "@/models/rail";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface BuildRailCurveParams {
	/** Rail data with type, origin coordinates, fle/tle/ole */
	rail: RailData;
	/** Position of the start node (fromNode) */
	fromPos: Vector3;
	/** Position of the end node (toNode) */
	toPos: Vector3;
}

/**
 * Build a CatmullRomCurve3 for a rail.
 *
 * For curved rails, constructs: FLE straight → curve → TLE straight.
 * For linear rails, just fromPos → toPos.
 */
export function buildRailCurve(params: BuildRailCurveParams): CatmullRomCurve3 {
	const { rail, fromPos, toPos } = params;

	if (rail.railType === RAIL_TYPE.LINEAR || !rail.originFrom || !rail.originTo) {
		return new CatmullRomCurve3([fromPos.clone(), toPos.clone()], false, "catmullrom", 0.5);
	}

	const originFrom = new Vector3(rail.originFrom.x, rail.originFrom.y, rail.originFrom.z);
	const originTo = new Vector3(rail.originTo.x, rail.originTo.y, rail.originTo.z);

	// Build the three-segment path: FLE + Curve + TLE
	const allPoints: Vector3[] = [];

	// Segment 1: FLE — straight from fromNode to originFrom
	const fleSegments = 2;
	for (let i = 0; i <= fleSegments; i++) {
		const t = i / fleSegments;
		allPoints.push(new Vector3().lerpVectors(fromPos, originFrom, t));
	}

	// Segment 2: Curve — from originFrom to originTo
	let curvePoints: Vector3[];

	switch (rail.railType) {
		case RAIL_TYPE.CURVE:
			curvePoints = buildSemicirclePoints(originFrom, originTo);
			break;
		case RAIL_TYPE.LEFT_CURVE:
			curvePoints = buildLeftCurvePoints(originFrom, originTo);
			break;
		case RAIL_TYPE.RIGHT_CURVE:
			curvePoints = buildRightCurvePoints(originFrom, originTo);
			break;
		default:
			// S_CURVE, CSC_CURVE fallback to linear for now
			curvePoints = [originFrom.clone(), originTo.clone()];
			break;
	}

	// Skip first point of curve (it's the same as last FLE point)
	for (let i = 1; i < curvePoints.length; i++) {
		allPoints.push(curvePoints[i]);
	}

	// Segment 3: TLE — straight from originTo to toNode
	const tleSegments = 2;
	for (let i = 1; i <= tleSegments; i++) {
		const t = i / tleSegments;
		allPoints.push(new Vector3().lerpVectors(originTo, toPos, t));
	}

	return new CatmullRomCurve3(allPoints, false, "catmullrom", 0.5);
}

// ---------------------------------------------------------------------------
// Curve geometry builders (operate on origin coordinates, not node positions)
// ---------------------------------------------------------------------------

/**
 * CURVE (Semicircle): Arc from originFrom to originTo.
 * Matches VOS createCurvedLinePoints.
 *
 * VOS uses atan2 with NEGATED Z for its angle calculation.
 * We replicate this exactly for matching geometry.
 */
function buildSemicirclePoints(from: Vector3, to: Vector3, segments = 100): Vector3[] {
	const center = new Vector3().addVectors(from, to).multiplyScalar(0.5);
	const radius = from.distanceTo(center);

	if (radius < 1e-9) {
		return [from.clone(), to.clone()];
	}

	// VOS: atan2(-(start.z - center.z), start.x - center.x) — Z negated
	const startAngle = Math.atan2(-(from.z - center.z), from.x - center.x);
	let endAngle = Math.atan2(-(to.z - center.z), to.x - center.x);

	// Counter-clockwise sweep
	if (endAngle <= startAngle) {
		endAngle += 2 * Math.PI;
	}

	const points: Vector3[] = new Array(segments + 1);
	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const angle = startAngle + t * (endAngle - startAngle);
		points[i] = new Vector3(
			center.x + radius * Math.cos(angle),
			from.y + t * (to.y - from.y),
			center.z - radius * Math.sin(angle), // VOS: Z = center.z - r*sin
		);
	}

	return points;
}

/**
 * LEFT_CURVE: QuadraticBezierCurve3 with control point offset counter-clockwise.
 * Matches VOS createLeftCurveLinePoints.
 */
function buildLeftCurvePoints(
	from: Vector3,
	to: Vector3,
	curvature = 0.7,
	segments = 100,
): Vector3[] {
	const center = new Vector3().addVectors(from, to).multiplyScalar(0.5);
	const halfDist = from.distanceTo(center);

	if (halfDist < 1e-9) {
		return [from.clone(), to.clone()];
	}

	// VOS: Z negated in atan2
	const startAngle = Math.atan2(-(from.z - center.z), from.x - center.x);
	let endAngle = Math.atan2(-(to.z - center.z), to.x - center.x);

	// Counter-clockwise sweep
	if (endAngle <= startAngle) {
		endAngle += 2 * Math.PI;
	}

	const midAngle = (startAngle + endAngle) / 2;

	const controlPoint = new Vector3(
		center.x + halfDist * Math.cos(midAngle) * curvature,
		(from.y + to.y) / 2,
		center.z - halfDist * Math.sin(midAngle) * curvature, // VOS: Z negated
	);

	const bezier = new QuadraticBezierCurve3(from.clone(), controlPoint, to.clone());
	return bezier.getPoints(segments);
}

/**
 * RIGHT_CURVE: QuadraticBezierCurve3 with control point offset clockwise.
 * Matches VOS createRightCurveLinePoints.
 */
function buildRightCurvePoints(
	from: Vector3,
	to: Vector3,
	curvature = 0.7,
	segments = 100,
): Vector3[] {
	const center = new Vector3().addVectors(from, to).multiplyScalar(0.5);
	const halfDist = from.distanceTo(center);

	if (halfDist < 1e-9) {
		return [from.clone(), to.clone()];
	}

	// VOS: Z negated in atan2
	const startAngle = Math.atan2(-(from.z - center.z), from.x - center.x);
	let endAngle = Math.atan2(-(to.z - center.z), to.x - center.x);

	// Clockwise sweep (opposite of LEFT)
	if (endAngle >= startAngle) {
		endAngle -= 2 * Math.PI;
	}

	const midAngle = (startAngle + endAngle) / 2;

	const controlPoint = new Vector3(
		center.x + halfDist * Math.cos(midAngle) * curvature,
		(from.y + to.y) / 2,
		center.z - halfDist * Math.sin(midAngle) * curvature, // VOS: Z negated
	);

	const bezier = new QuadraticBezierCurve3(from.clone(), controlPoint, to.clone());
	return bezier.getPoints(segments);
}
