/**
 * curveBuilder.ts — Faithful port of VOS's curve construction logic.
 *
 * Source: vosui-develop_rms/src/utils/functionsForPath.ts
 *
 * VOS edge geometry is composed of THREE segments:
 *   1. FLE (Front Linear Element): straight line from fromNode → originFrom
 *   2. Curve (OLE): the actual curve from originFrom → originTo
 *   3. TLE (Tail Linear Element): straight line from originTo → toNode
 *
 * For LINEAR rails, the entire path is a straight line (no FLE/TLE/OLE).
 * CSC_CURVE_HETE bypasses FLE/TLE — uses 6 waypoint nodes directly.
 *
 * Coordinate system: Y-up. All input positions must be in Y-up world space.
 * VOS curve functions use atan2 with negated Z in CURVE/LEFT_CURVE/RIGHT_CURVE,
 * but use non-negated Z in S_CURVE/CSC_CURVE_HOMO/CSC_CURVE_HETE.
 * We replicate each function's convention exactly.
 */

import { CatmullRomCurve3, MathUtils, QuadraticBezierCurve3, Vector2, Vector3 } from "three";
import type { RailData } from "@/models/rail";
import { RAIL_TYPE } from "@/models/rail";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BuildRailCurveParams {
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
 * Port of VOS createPath() — dispatches to createDefaultLinePoints or
 * specialized builders based on rail type, then wraps in CatmullRomCurve3.
 */
export function buildRailCurve(params: BuildRailCurveParams): CatmullRomCurve3 {
	const { rail, fromPos, toPos, nodePositions } = params;

	let points: Vector3[];

	switch (rail.railType) {
		case RAIL_TYPE.LINEAR:
			// VOS: createLinearLinePoints(start, end) — 2 divisions → 3 points
			points = createLinearLinePoints(fromPos, toPos, 2);
			break;

		case RAIL_TYPE.CURVE:
		case RAIL_TYPE.LEFT_CURVE:
		case RAIL_TYPE.RIGHT_CURVE:
		case RAIL_TYPE.S_CURVE:
		case RAIL_TYPE.CSC_CURVE_HOMO:
			points = createDefaultLinePoints(fromPos, toPos, rail, rail.railType);
			break;

		case RAIL_TYPE.CSC_CURVE_HETE:
			// VOS: CSC_CURVE_HETE goes through createDefaultLinePoints which
			// immediately delegates to createCSCCurveHeteLinePoints and returns
			points = createDefaultLinePoints(fromPos, toPos, rail, rail.railType, nodePositions);
			break;

		default:
			points = createLinearLinePoints(fromPos, toPos, 2);
			break;
	}

	// VOS: new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5)
	return new CatmullRomCurve3(points, false, "catmullrom", 0.5);
}

// ---------------------------------------------------------------------------
// createDefaultLinePoints — VOS port
// ---------------------------------------------------------------------------

/**
 * Port of VOS createDefaultLinePoints().
 * Assembles FLE + Curve + TLE with proportional segment distribution.
 *
 * VOS segment distribution:
 *   tmpSum = fle + tle + ole
 *   segments_ole = segments / (ole / tmpSum)   // = segments * tmpSum / ole
 *   lengthCount[0] = (fle / tmpSum) * segments_ole
 *   lengthCount[1] = (ole / tmpSum) * segments_ole  // = segments (always 500 for OLE)
 *   lengthCount[2] = (tle / tmpSum) * segments_ole
 *
 * Note: VOS passes curvature=1.0 (default param in createDefaultLinePoints).
 */
function createDefaultLinePoints(
	start: Vector3,
	end: Vector3,
	rail: RailData,
	railType: string,
	nodePositions?: Record<string, { x: number; y: number; z: number }>,
	segments = 500,
	curvature = 1.0,
): Vector3[] {
	if (!rail.originFrom || !rail.originTo) {
		return createLinearLinePoints(start, end, 2);
	}

	const originFrom = new Vector3(rail.originFrom.x, rail.originFrom.y, rail.originFrom.z);
	const originTo = new Vector3(rail.originTo.x, rail.originTo.y, rail.originTo.z);

	const fle = rail.fle;
	const tle = rail.tle;
	const ole = rail.ole;

	// VOS: tmpSum = fle + tle + ole
	const tmpSum = fle + tle + ole;
	// VOS: segments_ole = segments / (ole / tmpSum)
	const segmentsOle = tmpSum > 0 && ole > 0 ? segments / (ole / tmpSum) : segments;

	// VOS: lengthCount = [(fle/tmpSum)*segments_ole, (ole/tmpSum)*segments_ole, (tle/tmpSum)*segments_ole]
	const lengthCount = tmpSum > 0
		? [
			(fle / tmpSum) * segmentsOle,
			(ole / tmpSum) * segmentsOle,
			(tle / tmpSum) * segmentsOle,
		]
		: [2, segments, 2];

	let ret: Vector3[] = [];
	let curve: Vector3[] = [];

	// VOS: dispatch curve builder based on lineType
	if (railType === RAIL_TYPE.RIGHT_CURVE) {
		// VOS: createRightCurveLinePoints(origin_from, origin_to, lengthCount[1], curvature)
		curve = createRightCurveLinePoints(originFrom, originTo, lengthCount[1], curvature);
	} else if (railType === RAIL_TYPE.LEFT_CURVE) {
		// VOS: createLeftCurveLinePoints(origin_from, origin_to, lengthCount[1], curvature)
		curve = createLeftCurveLinePoints(originFrom, originTo, lengthCount[1], curvature);
	} else if (railType === RAIL_TYPE.S_CURVE) {
		// VOS: createSCurveLinePoints(origin_from, origin_to, lengthCount[1], lineType)
		curve = createSCurveLinePoints(originFrom, originTo, lengthCount[1], railType);
	} else if (railType === RAIL_TYPE.CURVE) {
		// VOS: createCurvedLinePoints(origin_from, origin_to, lengthCount[1])
		curve = createCurvedLinePoints(originFrom, originTo, lengthCount[1]);
	} else if (railType === RAIL_TYPE.CSC_CURVE_HOMO) {
		// VOS: createCSCCurveHomoLinePoints(origin_from, origin_to, lengthCount[1], "r")
		curve = createCSCCurveHomoLinePoints(originFrom, originTo, lengthCount[1], "r");
	} else if (railType === RAIL_TYPE.CSC_CURVE_HETE) {
		// VOS: CSC_CURVE_HETE returns immediately — no FLE/TLE wrapper
		return createCSCCurveHeteLinePoints(
			originFrom,
			originTo,
			lengthCount[1],
			rail.curveNodeIds,
			nodePositions,
		);
	}

	// VOS: flePoints 추가
	if (lengthCount[0] > 0) {
		const flePoints = createLinearLinePoints(start, originFrom, Math.floor(lengthCount[0]));
		ret = [...flePoints];
	}

	// VOS: curve.getPoints 추가
	ret = [...ret, ...curve];

	// VOS: tlePoints 추가
	if (lengthCount[2] > 0) {
		const tlePoints = createLinearLinePoints(originTo, end, Math.floor(lengthCount[2]));
		ret = [...ret, ...tlePoints];
	}

	return ret;
}

// ---------------------------------------------------------------------------
// createLinearLinePoints — VOS port
// ---------------------------------------------------------------------------

/**
 * Port of VOS createLinearLinePoints().
 * Generates evenly spaced points along a straight line.
 */
function createLinearLinePoints(start: Vector3, end: Vector3, divisions = 2): Vector3[] {
	// VOS: Array.from({ length: divisions + 1 }, (_, i) =>
	//   new THREE.Vector3().lerpVectors(start, end, i / divisions))
	return Array.from({ length: divisions + 1 }, (_, i) =>
		new Vector3().lerpVectors(start, end, i / divisions),
	);
}

// ---------------------------------------------------------------------------
// createCurvedLinePoints — VOS port (semicircle, always CCW)
// ---------------------------------------------------------------------------

/**
 * Port of VOS createCurvedLinePoints().
 * Semicircle arc from start to end, always counter-clockwise.
 *
 * VOS convention: atan2 with NEGATED Z.
 * VOS: Y is flat (start.y for all points, NOT interpolated).
 */
function createCurvedLinePoints(start: Vector3, end: Vector3, segments = 100): Vector3[] {
	const center = new Vector3().addVectors(start, end).multiplyScalar(0.5);
	const radius = start.distanceTo(center);

	// VOS: x축은 그대로, z축의 부호를 바꿔서 각도 계산
	const startAngle = Math.atan2(-(start.z - center.z), start.x - center.x);
	let endAngle = Math.atan2(-(end.z - center.z), end.x - center.x);

	// VOS: 항상 반시계 방향으로 그리기 위해 각도 조정
	if (endAngle <= startAngle) endAngle += 2 * Math.PI;

	// VOS: Array.from with segments+1 points
	return Array.from({ length: segments + 1 }, (_, i) => {
		const t = i / segments;
		const angle = startAngle + t * (endAngle - startAngle);
		const x = center.x + radius * Math.cos(angle);
		const z = center.z - radius * Math.sin(angle); // VOS: z = center.z - r*sin
		return new Vector3(x, start.y, z); // VOS: Y is flat (start.y)
	});
}

// ---------------------------------------------------------------------------
// createLeftCurveLinePoints — VOS port (CCW QuadraticBezier)
// ---------------------------------------------------------------------------

/**
 * Port of VOS createLeftCurveLinePoints().
 * QuadraticBezierCurve3 with control point offset counter-clockwise.
 *
 * VOS convention: atan2 with NEGATED Z.
 * VOS default: segments=50, curvature=0.7
 * But createDefaultLinePoints passes curvature=1.0.
 */
function createLeftCurveLinePoints(
	start: Vector3,
	end: Vector3,
	segments = 50,
	curvature = 0.7,
): Vector3[] {
	const center = new Vector3().addVectors(start, end).multiplyScalar(0.5);
	const radius = start.distanceTo(center);

	// VOS: 각도 계산 (z 축의 부호를 반대로)
	const startAngle = Math.atan2(-(start.z - center.z), start.x - center.x);
	let endAngle = Math.atan2(-(end.z - center.z), end.x - center.x);

	// VOS: 항상 반시계 방향으로 그리기 위해 각도 조정
	if (endAngle <= startAngle) endAngle += 2 * Math.PI;

	const midAngle = (startAngle + endAngle) / 2;
	const controlPoint = new Vector3(
		center.x + radius * Math.cos(midAngle) * curvature,
		(start.y + end.y) / 2,
		center.z - radius * Math.sin(midAngle) * curvature, // VOS: curvature 적용
	);

	const bezierCurve = new QuadraticBezierCurve3(start, controlPoint, end);
	return bezierCurve.getPoints(segments);
}

// ---------------------------------------------------------------------------
// createRightCurveLinePoints — VOS port (CW QuadraticBezier)
// ---------------------------------------------------------------------------

/**
 * Port of VOS createRightCurveLinePoints().
 * QuadraticBezierCurve3 with control point offset clockwise.
 *
 * VOS convention: atan2 with NEGATED Z.
 * VOS default: segments=50, curvature=0.7
 * But createDefaultLinePoints passes curvature=1.0.
 */
function createRightCurveLinePoints(
	start: Vector3,
	end: Vector3,
	segments = 50,
	curvature = 0.7,
): Vector3[] {
	const center = new Vector3().addVectors(start, end).multiplyScalar(0.5);
	const radius = start.distanceTo(center);

	// VOS: 각도 계산 (z 축의 부호를 반대로)
	const startAngle = Math.atan2(-(start.z - center.z), start.x - center.x);
	let endAngle = Math.atan2(-(end.z - center.z), end.x - center.x);

	// VOS: 항상 시계 방향으로 그리기 위해 각도 조정
	if (endAngle >= startAngle) endAngle -= 2 * Math.PI;

	const midAngle = (startAngle + endAngle) / 2;
	const controlPoint = new Vector3(
		center.x + radius * Math.cos(midAngle) * curvature,
		(start.y + end.y) / 2,
		center.z - radius * Math.sin(midAngle) * curvature, // VOS: curvature 적용
	);

	const bezierCurve = new QuadraticBezierCurve3(start, controlPoint, end);
	return bezierCurve.getPoints(segments);
}

// ---------------------------------------------------------------------------
// createSCurveLinePoints — VOS port (Arc-Line-Arc with arc-length resample)
// ---------------------------------------------------------------------------

/**
 * Port of VOS createSCurveLinePoints().
 * S-curve: two arcs connected by a straight line, with arc-length resampling.
 *
 * VOS convention: uses NON-negated Z in atan2.
 * Uses tangent-based sign selection for arc sweep direction.
 *
 * @param start - curve start (originFrom)
 * @param end - curve end (originTo)
 * @param lengthCount - number of output segments (→ lengthCount+1 points)
 * @param lineType - S_CURVE or S_CURVE_SPECIAL (we only have S_CURVE)
 * @param radius - arc radius (VOS default 0.5)
 * @param angleDeg - arc angle in degrees (VOS default 43)
 */
function createSCurveLinePoints(
	start: Vector3,
	end: Vector3,
	lengthCount: number,
	_lineType: string,
	radius = 0.5,
	angleDeg = 43,
): Vector3[] {
	const theta = MathUtils.degToRad(angleDeg);

	// VOS: 진행 방향 (xz 평면)
	const dx = end.x - start.x;
	const dz = end.z - start.z;
	const dir2 = new Vector2(dx, dz);
	const L = dir2.length();
	if (L < 1e-9) return [start.clone(), end.clone()];
	dir2.divideScalar(L);

	// VOS: 축 선택 — S_CURVE: |dx| > |dz| → z축, else x축
	// (S_CURVE_SPECIAL forces "x", but we only have S_CURVE)
	const axis: "x" | "z" = Math.abs(dx) > Math.abs(dz) ? "z" : "x";
	// VOS: sgn
	const sgn = axis === "z" ? (dz >= 0 ? 1 : -1) : (dx >= 0 ? 1 : -1);

	// VOS: 원호 중심
	const C1 = new Vector3(
		start.x + (axis === "x" ? sgn * radius : 0),
		start.y,
		start.z + (axis === "z" ? sgn * radius : 0),
	);
	const C2 = new Vector3(
		end.x - (axis === "x" ? sgn * radius : 0),
		end.y,
		end.z - (axis === "z" ? sgn * radius : 0),
	);

	// VOS: 중심 기준 각도 (NON-negated Z — atan2(z - C.z, x - C.x))
	const a1Start = Math.atan2(start.z - C1.z, start.x - C1.x);
	const a2End = Math.atan2(end.z - C2.z, end.x - C2.x);

	// VOS: 각도에서의 접선(파라미터 증가 방향)
	const tangentAt = (alpha: number, sign: 1 | -1): Vector2 => {
		const t = new Vector2(-Math.sin(alpha), Math.cos(alpha));
		return t.multiplyScalar(sign).normalize();
	};

	// VOS: 시작 호 — "끝점 방향으로" 회전하도록 부호 선택
	const chooseSignForStart = (a: number): 1 | -1 => {
		const dotPlus = tangentAt(a + theta, +1).dot(dir2);
		const dotMinus = tangentAt(a - theta, -1).dot(dir2);
		return dotPlus >= dotMinus ? +1 : -1;
	};
	const sgn1: 1 | -1 = chooseSignForStart(a1Start);
	const a1End = a1Start + sgn1 * theta;

	// VOS: 끝 호 — 도착 접선이 진행방향과 맞도록
	const chooseSignForEnd = (aEnd: number): 1 | -1 => {
		const dpPlus = tangentAt(aEnd, +1).dot(dir2);
		const dpMinus = tangentAt(aEnd, -1).dot(dir2);
		return dpPlus >= dpMinus ? +1 : -1;
	};
	const sgn2: 1 | -1 = chooseSignForEnd(a2End);
	const a2Start = a2End - sgn2 * theta;

	// VOS: 호→직선 접점
	const yMid = MathUtils.lerp(start.y, end.y, 0.5);
	const P1 = new Vector3(
		C1.x + radius * Math.cos(a1End),
		yMid,
		C1.z + radius * Math.sin(a1End), // VOS: NON-negated Z
	);
	const P2 = new Vector3(
		C2.x + radius * Math.cos(a2Start),
		yMid,
		C2.z + radius * Math.sin(a2Start), // VOS: NON-negated Z
	);

	// VOS: 고해상도(오버샘플) polyline 생성
	const baseArcN = Math.max(32, Math.round(lengthCount * 2));
	const baseLineN = Math.max(16, Math.round(lengthCount * 2));
	const dense: Vector3[] = [];

	// VOS: 시작 호 S→P1
	for (let i = 0; i <= baseArcN; i++) {
		const t = i / baseArcN;
		const ang = MathUtils.lerp(a1Start, a1End, t);
		dense.push(
			new Vector3(
				C1.x + radius * Math.cos(ang),
				MathUtils.lerp(start.y, yMid, t),
				C1.z + radius * Math.sin(ang), // VOS: NON-negated Z
			),
		);
	}

	// VOS: 직선 P1→P2
	for (let i = 1; i <= baseLineN; i++) {
		const t = i / baseLineN;
		dense.push(new Vector3().lerpVectors(P1, P2, t));
	}

	// VOS: 끝 호 P2→E
	for (let i = 1; i <= baseArcN; i++) {
		const t = i / baseArcN;
		const ang = MathUtils.lerp(a2Start, a2End, t);
		dense.push(
			new Vector3(
				C2.x + radius * Math.cos(ang),
				MathUtils.lerp(yMid, end.y, t),
				C2.z + radius * Math.sin(ang), // VOS: NON-negated Z
			),
		);
	}

	// VOS: 마지막을 정확히 end로 스냅
	dense[dense.length - 1].copy(end);

	// VOS: 아크 길이 균등 재샘플
	return resampleByArcLength(dense, lengthCount);
}

// ---------------------------------------------------------------------------
// createCSCCurveHomoLinePoints — VOS port (90deg Arc-Line-90deg Arc)
// ---------------------------------------------------------------------------

/**
 * Port of VOS createCSCCurveHomoLinePoints().
 * Two 90-degree arcs connected by a straight line, with arc-length resampling.
 *
 * VOS convention: uses NON-negated Z in atan2.
 *
 * @param start - curve start (originFrom)
 * @param end - curve end (originTo)
 * @param lengthCount - number of output segments
 * @param dir - "l" or "r" (VOS always passes "r" from createDefaultLinePoints)
 * @param radius - arc radius (VOS default 0.5)
 */
function createCSCCurveHomoLinePoints(
	start: Vector3,
	end: Vector3,
	lengthCount: number,
	dir: string,
	radius = 0.5,
): Vector3[] {
	const theta = MathUtils.degToRad(90); // VOS: 90도 고정

	// VOS: 진행 방향 (xz 평면)
	const dx = end.x - start.x;
	const dz = end.z - start.z;
	const dir2 = new Vector2(dx, dz);
	const dirLen = dir2.length();
	if (dirLen < 1e-9) return [start.clone(), end.clone()];
	dir2.divideScalar(dirLen);

	// VOS: 방향에 따라 부호 결정 (좌회전/우회전)
	const turnSign = dir === "l" ? 1 : -1;

	// VOS: 축 선택 — |dx| < |dz| → "z", else "x"
	// (Note: this is OPPOSITE of S_CURVE's axis selection)
	const axis: "x" | "z" = Math.abs(dx) < Math.abs(dz) ? "z" : "x";
	const sgn = axis === "z" ? (dz >= 0 ? 1 : -1) : (dx >= 0 ? 1 : -1);

	// VOS: 첫 번째 원호 중심 (시작점 기준) — MINUS offset
	const C1 = new Vector3(
		start.x - (axis === "x" ? sgn * radius * turnSign : 0),
		start.y,
		start.z - (axis === "z" ? sgn * radius * turnSign : 0),
	);

	// VOS: 두 번째 원호 중심 (끝점 기준) — PLUS offset
	const C2 = new Vector3(
		end.x + (axis === "x" ? sgn * radius * turnSign : 0),
		end.y,
		end.z + (axis === "z" ? sgn * radius * turnSign : 0),
	);

	// VOS: 시작점에서의 각도 (NON-negated Z)
	const a1Start = Math.atan2(start.z - C1.z, start.x - C1.x);
	const a1End = a1Start + turnSign * theta;

	// VOS: 끝점에서의 각도 (NON-negated Z)
	const a2End = Math.atan2(end.z - C2.z, end.x - C2.x);
	const a2Start = a2End - turnSign * theta;

	// VOS: 호→직선 접점
	const yMid = MathUtils.lerp(start.y, end.y, 0.5);
	const P1 = new Vector3(
		C1.x + radius * Math.cos(a1End),
		yMid,
		C1.z + radius * Math.sin(a1End), // VOS: NON-negated Z
	);
	const P2 = new Vector3(
		C2.x + radius * Math.cos(a2Start),
		yMid,
		C2.z + radius * Math.sin(a2Start), // VOS: NON-negated Z
	);

	// VOS: 고해상도 polyline 생성
	const baseArcN = Math.max(32, Math.round(lengthCount * 2));
	const baseLineN = Math.max(16, Math.round(lengthCount * 2));
	const dense: Vector3[] = [];

	// VOS: 첫 번째 90도 호 S→P1
	for (let i = 0; i <= baseArcN; i++) {
		const t = i / baseArcN;
		const ang = MathUtils.lerp(a1Start, a1End, t);
		dense.push(
			new Vector3(
				C1.x + radius * Math.cos(ang),
				MathUtils.lerp(start.y, yMid, t),
				C1.z + radius * Math.sin(ang), // VOS: NON-negated Z
			),
		);
	}

	// VOS: 중간 직선 P1→P2
	for (let i = 1; i <= baseLineN; i++) {
		const t = i / baseLineN;
		dense.push(new Vector3().lerpVectors(P1, P2, t));
	}

	// VOS: 두 번째 90도 호 P2→E
	for (let i = 1; i <= baseArcN; i++) {
		const t = i / baseArcN;
		const ang = MathUtils.lerp(a2Start, a2End, t);
		dense.push(
			new Vector3(
				C2.x + radius * Math.cos(ang),
				MathUtils.lerp(yMid, end.y, t),
				C2.z + radius * Math.sin(ang), // VOS: NON-negated Z
			),
		);
	}

	// VOS: 마지막을 정확히 end로 스냅
	dense[dense.length - 1].copy(end);

	// VOS: 아크 길이 균등 재샘플
	return resampleByArcLength(dense, lengthCount);
}

// ---------------------------------------------------------------------------
// createCSCCurveHeteLinePoints — VOS port (Line-Arc-Line-Arc-Line with 6 nodes)
// ---------------------------------------------------------------------------

/**
 * Port of VOS createCSCCurveHeteLinePoints().
 * 5-segment path: line-arc-line-arc-line using 6 waypoint nodes.
 *
 * VOS uses create90DegreeArc with NON-negated Z atan2 and midpoint-based
 * center calculation.
 */
function createCSCCurveHeteLinePoints(
	_start: Vector3,
	_end: Vector3,
	lengthCount: number,
	curveNodeIds: string[],
	nodePositions?: Record<string, { x: number; y: number; z: number }>,
): Vector3[] {
	// VOS: nodes 검증
	if (!curveNodeIds || curveNodeIds.length !== 6) {
		return [_start.clone(), _end.clone()];
	}

	if (!nodePositions) {
		return [_start.clone(), _end.clone()];
	}

	// VOS: nodeStore에서 좌표 가져오기
	const nodePosArr: Vector3[] = [];
	for (let i = 0; i < 6; i++) {
		const nodeId = curveNodeIds[i];
		if (!nodeId) return [_start.clone(), _end.clone()];
		const pos = nodePositions[nodeId];
		if (!pos) {
			return [_start.clone(), _end.clone()];
		}
		nodePosArr.push(new Vector3(pos.x, pos.y, pos.z));
	}

	// VOS: 직선 방향 벡터 계산 (xz 평면)
	const calcDir = (from: Vector3, to: Vector3): Vector2 => {
		const ddx = to.x - from.x;
		const ddz = to.z - from.z;
		const len = Math.sqrt(ddx * ddx + ddz * ddz);
		return len > 1e-9 ? new Vector2(ddx / len, ddz / len) : new Vector2(1, 0);
	};

	// VOS: 직선 방향들
	const dir01 = calcDir(nodePosArr[0], nodePosArr[1]); // [0]→[1]
	const dir23 = calcDir(nodePosArr[2], nodePosArr[3]); // [2]→[3]
	const dir45 = calcDir(nodePosArr[4], nodePosArr[5]); // [4]→[5]

	// VOS: 세그먼트 수 계산
	const arcSegments = Math.max(32, Math.round(lengthCount / 3));
	const lineSegments = Math.max(8, Math.round(lengthCount / 6));

	const dense: Vector3[] = [];

	// VOS: 1. 직선: nodes[0] → nodes[1]
	const line1 = createLinearLinePoints(nodePosArr[0], nodePosArr[1], lineSegments);
	dense.push(...line1);

	// VOS: 2. 90도 곡선: nodes[1] → nodes[2] (이전: dir01, 이후: dir23)
	const arc1 = create90DegreeArc(nodePosArr[1], nodePosArr[2], dir01, dir23, arcSegments);
	dense.push(...arc1.slice(1)); // 첫 점은 line1의 마지막과 중복

	// VOS: 3. 직선: nodes[2] → nodes[3]
	const line2 = createLinearLinePoints(nodePosArr[2], nodePosArr[3], lineSegments);
	dense.push(...line2.slice(1)); // 첫 점은 arc1의 마지막과 중복

	// VOS: 4. 90도 곡선: nodes[3] → nodes[4] (이전: dir23, 이후: dir45)
	const arc2 = create90DegreeArc(nodePosArr[3], nodePosArr[4], dir23, dir45, arcSegments);
	dense.push(...arc2.slice(1)); // 첫 점은 line2의 마지막과 중복

	// VOS: 5. 직선: nodes[4] → nodes[5]
	const line3 = createLinearLinePoints(nodePosArr[4], nodePosArr[5], lineSegments);
	dense.push(...line3.slice(1)); // 첫 점은 arc2의 마지막과 중복

	// VOS: 아크 길이 균등 재샘플
	return resampleByArcLength(dense, lengthCount);
}

// ---------------------------------------------------------------------------
// create90DegreeArc — VOS port (helper for CSC_CURVE_HETE)
// ---------------------------------------------------------------------------

/**
 * Port of VOS create90DegreeArc().
 * Draws a 90-degree arc between two points using direction vectors to
 * determine the arc center.
 *
 * VOS convention: uses NON-negated Z in atan2.
 * Center is found via midpoint + perpendicular offset.
 */
function create90DegreeArc(
	p1: Vector3,
	p2: Vector3,
	beforeDir: Vector2,
	afterDir: Vector2,
	segments: number,
): Vector3[] {
	// VOS: 90도 원호에서 두 점 사이 거리 d와 반지름 r의 관계: d = r * sqrt(2)
	const d = p1.distanceTo(p2);
	const r = d / Math.SQRT2;

	// VOS: 중점 계산
	const mid = new Vector3().addVectors(p1, p2).multiplyScalar(0.5);

	// VOS: p1에서 p2로 가는 방향 (xz 평면)
	const ddx = p2.x - p1.x;
	const ddz = p2.z - p1.z;
	const len = Math.sqrt(ddx * ddx + ddz * ddz);

	if (len < 1e-9) {
		return [p1.clone(), p2.clone()];
	}

	// VOS: cross product (xz 평면): beforeDir × afterDir
	// 양수면 왼쪽(반시계)으로 꺾음, 음수면 오른쪽(시계)으로 꺾음
	const cross = beforeDir.x * afterDir.y - beforeDir.y * afterDir.x;

	// VOS: 수직 방향 벡터 (왼쪽 수직: -dz, dx)
	const perpX = -ddz / len;
	const perpZ = ddx / len;

	// VOS: 중점에서 수직 방향으로 d/2 만큼 이동한 곳이 원의 중심
	const centerDist = d / 2;

	// VOS: cross에 따라 방향 결정
	// cross > 0: 중심은 왼쪽에
	// cross < 0: 중심은 오른쪽에
	const centerSign = cross > 0 ? 1 : -1;
	const C = new Vector3(
		mid.x + perpX * centerDist * centerSign,
		p1.y,
		mid.z + perpZ * centerDist * centerSign,
	);

	// VOS: 시작/끝 각도 계산 (NON-negated Z)
	const startAngle = Math.atan2(p1.z - C.z, p1.x - C.x);
	const endAngle = Math.atan2(p2.z - C.z, p2.x - C.x);

	// VOS: 각도 차이 조정 (짧은 경로로)
	let angleDiff = endAngle - startAngle;
	while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
	while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

	// VOS: 원호 포인트 생성
	const points: Vector3[] = [];
	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const angle = startAngle + angleDiff * t;
		points.push(
			new Vector3(
				C.x + r * Math.cos(angle),
				MathUtils.lerp(p1.y, p2.y, t),
				C.z + r * Math.sin(angle), // VOS: NON-negated Z
			),
		);
	}

	return points;
}

// ---------------------------------------------------------------------------
// resampleByArcLength — VOS port
// ---------------------------------------------------------------------------

/**
 * Port of VOS resampleByArcLength().
 * Resamples a polyline to have evenly-spaced points by arc length.
 *
 * @param pts - dense polyline points
 * @param count - number of output segments (→ count+1 points)
 */
function resampleByArcLength(pts: Vector3[], count: number): Vector3[] {
	if (pts.length === 0) return [];
	if (pts.length === 1 || count <= 0) return [pts[0].clone()];

	// VOS: 누적 거리 배열
	const dists: number[] = [0];
	for (let i = 1; i < pts.length; i++) {
		dists[i] = dists[i - 1] + pts[i - 1].distanceTo(pts[i]);
	}
	const total = dists[dists.length - 1];
	if (total <= 1e-9) return [pts[0].clone()];

	// VOS: 균등 재샘플
	const out: Vector3[] = [];
	for (let k = 0; k <= count; k++) {
		const target = (total * k) / count;
		// VOS: 선형 탐색으로 구간 찾기
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
