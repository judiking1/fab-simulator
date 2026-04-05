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
	/** Node positions lookup — needed for CSC_CURVE_HETE waypoints */
	nodePositions?: Record<string, { x: number; y: number; z: number }>;
}

/**
 * Build a CatmullRomCurve3 for a rail.
 *
 * For curved rails, constructs: FLE straight → curve → TLE straight.
 * For linear rails, just fromPos → toPos.
 */
export function buildRailCurve(params: BuildRailCurveParams): CatmullRomCurve3 {
	const { rail, fromPos, toPos, nodePositions } = params;

	if (rail.railType === RAIL_TYPE.LINEAR || !rail.originFrom || !rail.originTo) {
		return new CatmullRomCurve3([fromPos.clone(), toPos.clone()], false, "catmullrom", 0.5);
	}

	// CSC_CURVE_HETE: uses 6 waypoint nodes directly — NO FLE/TLE wrapper
	if (rail.railType === RAIL_TYPE.CSC_CURVE_HETE) {
		if (rail.curveNodeIds.length === 6 && nodePositions) {
			const waypoints: Vector3[] = [];
			for (const nodeId of rail.curveNodeIds) {
				const pos = nodePositions[nodeId];
				if (pos) {
					waypoints.push(new Vector3(pos.x, pos.y, pos.z));
				}
			}
			if (waypoints.length === 6) {
				const hetePoints = buildCSCHetePoints(waypoints);
				return new CatmullRomCurve3(hetePoints, false, "catmullrom", 0.5);
			}
		}
		// Fallback: straight line if nodes not available
		return new CatmullRomCurve3([fromPos.clone(), toPos.clone()], false, "catmullrom", 0.5);
	}

	const originFrom = new Vector3(rail.originFrom.x, rail.originFrom.y, rail.originFrom.z);
	const originTo = new Vector3(rail.originTo.x, rail.originTo.y, rail.originTo.z);

	// Build the three-segment path: FLE + Curve + TLE
	// VOS distributes 500 total points proportionally based on fle/ole/tle lengths.
	// With only 2 FLE points, CatmullRomCurve3 (tension=0.5) creates unwanted curvature
	// at the FLE→curve junction. Proportional distribution yields 48+ FLE points for
	// typical values, producing smooth straight-to-curve transitions.
	const TOTAL_SEGMENTS = 500;
	let fleSegments: number;
	let oleSegments: number;
	let tleSegments: number;

	const segmentLengthSum = rail.fle + rail.tle + rail.ole;
	if (segmentLengthSum > 0) {
		fleSegments = Math.max(2, Math.round((rail.fle / segmentLengthSum) * TOTAL_SEGMENTS));
		oleSegments = Math.max(10, Math.round((rail.ole / segmentLengthSum) * TOTAL_SEGMENTS));
		tleSegments = Math.max(2, TOTAL_SEGMENTS - fleSegments - oleSegments);
	} else {
		// Fallback for missing fle/tle/ole
		fleSegments = 2;
		oleSegments = 100;
		tleSegments = 2;
	}

	const allPoints: Vector3[] = [];

	// Segment 1: FLE — straight from fromNode to originFrom
	for (let i = 0; i <= fleSegments; i++) {
		const t = i / fleSegments;
		allPoints.push(new Vector3().lerpVectors(fromPos, originFrom, t));
	}

	// Segment 2: Curve — from originFrom to originTo
	let curvePoints: Vector3[];

	switch (rail.railType) {
		case RAIL_TYPE.CURVE:
			curvePoints = buildSemicirclePoints(originFrom, originTo, oleSegments);
			break;
		case RAIL_TYPE.LEFT_CURVE:
			curvePoints = buildLeftCurvePoints(originFrom, originTo, 0.7, oleSegments);
			break;
		case RAIL_TYPE.RIGHT_CURVE:
			curvePoints = buildRightCurvePoints(originFrom, originTo, 0.7, oleSegments);
			break;
		case RAIL_TYPE.S_CURVE:
			curvePoints = buildSCurvePoints(originFrom, originTo, 0.5, 43, oleSegments);
			break;
		case RAIL_TYPE.CSC_CURVE_HOMO:
			curvePoints = buildCSCHomoPoints(originFrom, originTo, 0.5, oleSegments);
			break;
		default:
			curvePoints = [originFrom.clone(), originTo.clone()];
			break;
	}

	// Skip first point of curve (it's the same as last FLE point)
	for (let i = 1; i < curvePoints.length; i++) {
		allPoints.push(curvePoints[i]);
	}

	// Segment 3: TLE — straight from originTo to toNode
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

// ---------------------------------------------------------------------------
// S_CURVE (Arc-Line-Arc)
// ---------------------------------------------------------------------------

/**
 * S_CURVE: Two arcs connected by a straight line segment.
 * Matches VOS createSCurveLinePoints.
 *
 * Structure: Arc1 (from originFrom) → straight line → Arc2 (to originTo)
 * - Default radius = 0.5, default angle = 43 degrees
 * - Arc centers are offset perpendicular to the travel direction
 * - Auto-selects offset axis: if |dx| > |dz| → offset on Z, else on X
 * - VOS negates Z in atan2 — replicated exactly
 */
function buildSCurvePoints(
	from: Vector3,
	to: Vector3,
	radius = 0.5,
	angleDeg = 43,
	segments = 200,
): Vector3[] {
	const dx = to.x - from.x;
	const dz = to.z - from.z;
	const angleRad = (angleDeg * Math.PI) / 180;

	if (radius < 1e-9) {
		return [from.clone(), to.clone()];
	}

	// Auto-select perpendicular offset axis (VOS pattern)
	const useZOffset = Math.abs(dx) > Math.abs(dz);

	// Determine arc rotation sign based on perpendicular offset direction
	const crossSign = useZOffset ? (dz >= 0 ? 1 : -1) : dx >= 0 ? -1 : 1;

	// Arc center 1: offset perpendicular from start point
	const center1 = from.clone();
	if (useZOffset) {
		center1.z += crossSign * radius;
	} else {
		center1.x += crossSign * radius;
	}

	// Arc center 2: offset perpendicular from end point (opposite direction)
	const center2 = to.clone();
	if (useZOffset) {
		center2.z -= crossSign * radius;
	} else {
		center2.x -= crossSign * radius;
	}

	// Arc 1: from start point, sweeping by angleRad
	const startAngle1 = Math.atan2(-(from.z - center1.z), from.x - center1.x);
	const arc1End = startAngle1 - crossSign * angleRad;

	const segPerArc = Math.floor(segments * 0.4);
	const segLine = segments - 2 * segPerArc;

	const points: Vector3[] = [];

	// Arc 1
	for (let i = 0; i <= segPerArc; i++) {
		const t = i / segPerArc;
		const angle = startAngle1 + t * (arc1End - startAngle1);
		points.push(
			new Vector3(
				center1.x + radius * Math.cos(angle),
				from.y + t * 0.4 * (to.y - from.y),
				center1.z - radius * Math.sin(angle), // VOS: Z negated
			),
		);
	}

	// End of arc 1 / start of line
	const arc1EndPt = points[points.length - 1];

	// Arc 2: compute start point
	const startAngle2 = Math.atan2(-(to.z - center2.z), to.x - center2.x);
	const arc2Start = startAngle2 + crossSign * angleRad;

	const arc2StartPt = new Vector3(
		center2.x + radius * Math.cos(arc2Start),
		from.y + 0.6 * (to.y - from.y),
		center2.z - radius * Math.sin(arc2Start), // VOS: Z negated
	);

	// Straight line between arc endpoints
	for (let i = 1; i <= segLine; i++) {
		const t = i / segLine;
		points.push(new Vector3().lerpVectors(arc1EndPt, arc2StartPt, t));
	}

	// Arc 2
	for (let i = 1; i <= segPerArc; i++) {
		const t = i / segPerArc;
		const angle = arc2Start + t * (startAngle2 - arc2Start);
		points.push(
			new Vector3(
				center2.x + radius * Math.cos(angle),
				from.y + (0.6 + t * 0.4) * (to.y - from.y),
				center2.z - radius * Math.sin(angle), // VOS: Z negated
			),
		);
	}

	return points;
}

// ---------------------------------------------------------------------------
// CSC_CURVE_HOMO (Arc(90 degrees)-Line-Arc(90 degrees))
// ---------------------------------------------------------------------------

/**
 * CSC_CURVE_HOMO: Two 90-degree arcs connected by a straight line.
 * Matches VOS createCSCHomoLinePoints.
 *
 * Same structure as S_CURVE but with fixed 90-degree arcs.
 * Hardcoded right turn (turnSign = -1).
 */
function buildCSCHomoPoints(from: Vector3, to: Vector3, radius = 0.5, segments = 200): Vector3[] {
	const dx = to.x - from.x;
	const dz = to.z - from.z;
	const halfPi = Math.PI / 2;

	if (radius < 1e-9) {
		return [from.clone(), to.clone()];
	}

	// Hardcoded right turn
	const turnSign = -1;

	// Auto-select perpendicular offset axis (same as S_CURVE)
	const useZOffset = Math.abs(dx) > Math.abs(dz);

	// Perpendicular offset direction
	const crossSign = useZOffset ? (dz >= 0 ? 1 : -1) : dx >= 0 ? -1 : 1;

	// Apply right turn modifier
	const offsetSign = crossSign * turnSign;

	// Arc center 1: offset perpendicular from start point
	const center1 = from.clone();
	if (useZOffset) {
		center1.z += offsetSign * radius;
	} else {
		center1.x += offsetSign * radius;
	}

	// Arc center 2: offset perpendicular from end point (opposite direction)
	const center2 = to.clone();
	if (useZOffset) {
		center2.z -= offsetSign * radius;
	} else {
		center2.x -= offsetSign * radius;
	}

	// Arc 1: 90 degrees from start point
	const startAngle1 = Math.atan2(-(from.z - center1.z), from.x - center1.x);
	const arc1End = startAngle1 - offsetSign * halfPi;

	const segPerArc = Math.floor(segments * 0.4);
	const segLine = segments - 2 * segPerArc;

	const points: Vector3[] = [];

	// Arc 1 (90 degrees)
	for (let i = 0; i <= segPerArc; i++) {
		const t = i / segPerArc;
		const angle = startAngle1 + t * (arc1End - startAngle1);
		points.push(
			new Vector3(
				center1.x + radius * Math.cos(angle),
				from.y + t * 0.4 * (to.y - from.y),
				center1.z - radius * Math.sin(angle), // VOS: Z negated
			),
		);
	}

	const arc1EndPt = points[points.length - 1];

	// Arc 2: 90 degrees to end point
	const startAngle2 = Math.atan2(-(to.z - center2.z), to.x - center2.x);
	const arc2Start = startAngle2 + offsetSign * halfPi;

	const arc2StartPt = new Vector3(
		center2.x + radius * Math.cos(arc2Start),
		from.y + 0.6 * (to.y - from.y),
		center2.z - radius * Math.sin(arc2Start), // VOS: Z negated
	);

	// Straight line between arcs
	for (let i = 1; i <= segLine; i++) {
		const t = i / segLine;
		points.push(new Vector3().lerpVectors(arc1EndPt, arc2StartPt, t));
	}

	// Arc 2 (90 degrees)
	for (let i = 1; i <= segPerArc; i++) {
		const t = i / segPerArc;
		const angle = arc2Start + t * (startAngle2 - arc2Start);
		points.push(
			new Vector3(
				center2.x + radius * Math.cos(angle),
				from.y + (0.6 + t * 0.4) * (to.y - from.y),
				center2.z - radius * Math.sin(angle), // VOS: Z negated
			),
		);
	}

	return points;
}

// ---------------------------------------------------------------------------
// CSC_CURVE_HETE (Line-Arc-Line-Arc-Line using 6 waypoint nodes)
// ---------------------------------------------------------------------------

/**
 * CSC_CURVE_HETE: Five-segment path using 6 intermediate waypoint nodes.
 * Matches VOS createCSCHeteLinePoints.
 *
 * Pattern: Line(p0→p1) → Arc(p1→p2) → Line(p2→p3) → Arc(p3→p4) → Line(p4→p5)
 *
 * Each 90-degree arc center is found via cross product of incoming/outgoing
 * directions. Radius = distance(p1,p2) / sqrt(2) for 90-degree arcs.
 *
 * Does NOT use FLE/TLE — the 6 nodes define the complete path.
 */
function buildCSCHetePoints(nodePositions: Vector3[], segments = 200): Vector3[] {
	if (nodePositions.length !== 6) {
		return nodePositions.length >= 2
			? [nodePositions[0].clone(), nodePositions[nodePositions.length - 1].clone()]
			: [];
	}

	const [p0, p1, p2, p3, p4, p5] = nodePositions;

	const segPerLine = Math.floor(segments * 0.12);
	const segPerArc = Math.floor(segments * 0.32);

	const points: Vector3[] = [];

	// Segment 1: Line p0 → p1
	for (let i = 0; i <= segPerLine; i++) {
		const t = i / segPerLine;
		points.push(new Vector3().lerpVectors(p0, p1, t));
	}

	// Segment 2: Arc p1 → p2 (90 degrees)
	const arc1Points = buildHeteArc(p0, p1, p2, p3, segPerArc);
	for (let i = 1; i < arc1Points.length; i++) {
		points.push(arc1Points[i]);
	}

	// Segment 3: Line p2 → p3
	for (let i = 1; i <= segPerLine; i++) {
		const t = i / segPerLine;
		points.push(new Vector3().lerpVectors(p2, p3, t));
	}

	// Segment 4: Arc p3 → p4 (90 degrees)
	const arc2Points = buildHeteArc(p2, p3, p4, p5, segPerArc);
	for (let i = 1; i < arc2Points.length; i++) {
		points.push(arc2Points[i]);
	}

	// Segment 5: Line p4 → p5
	for (let i = 1; i <= segPerLine; i++) {
		const t = i / segPerLine;
		points.push(new Vector3().lerpVectors(p4, p5, t));
	}

	return points;
}

/**
 * Build a 90-degree arc between two waypoints (arcStart → arcEnd).
 * Uses incoming direction (prev → arcStart) and outgoing direction (arcEnd → next)
 * to determine the arc center via cross product.
 *
 * Arc center = midpoint + perpendicular * (dist/2) * crossSign
 * Radius = distance(arcStart, arcEnd) / sqrt(2)
 */
function buildHeteArc(
	prev: Vector3,
	arcStart: Vector3,
	arcEnd: Vector3,
	next: Vector3,
	segments: number,
): Vector3[] {
	const dist = arcStart.distanceTo(arcEnd);
	if (dist < 1e-9) {
		return [arcStart.clone(), arcEnd.clone()];
	}

	const radius = dist / Math.SQRT2;

	// Incoming direction (XZ plane)
	const inDir = new Vector3().subVectors(arcStart, prev).normalize();
	// Outgoing direction (XZ plane)
	const outDir = new Vector3().subVectors(next, arcEnd).normalize();

	// Cross product (Y component) to determine turn direction (left/right)
	const cross = inDir.x * outDir.z - inDir.z * outDir.x;
	const crossSign = cross >= 0 ? 1 : -1;

	// Perpendicular to incoming direction in XZ plane
	const perpX = -inDir.z * crossSign;
	const perpZ = inDir.x * crossSign;

	// Arc center: offset from arcStart perpendicular to incoming direction
	const center = new Vector3(
		arcStart.x + perpX * radius,
		(arcStart.y + arcEnd.y) / 2,
		arcStart.z + perpZ * radius,
	);

	// Angles using VOS convention (negated Z)
	const startAngle = Math.atan2(-(arcStart.z - center.z), arcStart.x - center.x);
	let endAngle = Math.atan2(-(arcEnd.z - center.z), arcEnd.x - center.x);

	// Ensure the sweep direction matches the turn direction
	if (crossSign > 0) {
		// Counter-clockwise sweep
		if (endAngle <= startAngle) {
			endAngle += 2 * Math.PI;
		}
	} else {
		// Clockwise sweep
		if (endAngle >= startAngle) {
			endAngle -= 2 * Math.PI;
		}
	}

	const points: Vector3[] = new Array(segments + 1);
	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const angle = startAngle + t * (endAngle - startAngle);
		points[i] = new Vector3(
			center.x + radius * Math.cos(angle),
			arcStart.y + t * (arcEnd.y - arcStart.y),
			center.z - radius * Math.sin(angle), // VOS: Z negated
		);
	}

	return points;
}
