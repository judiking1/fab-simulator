/**
 * SCurveSpec — S_CURVE: Arc-Line-Arc with arc-length resampling.
 *
 * VOS convention: uses NON-negated Z in atan2.
 * Uses tangent-based sign selection for arc sweep direction.
 */

import { MathUtils, Vector2, Vector3 } from "three";
import { RAIL_TYPE } from "@/models/rail";
import type { CurveOptions, CurveSpec } from "../CurveSpec";
import { assembleFleOleTle, resampleByArcLength } from "../curveUtils";

function buildSCurvePoints(
	start: Vector3,
	end: Vector3,
	lengthCount: number,
	radius = 0.5,
	angleDeg = 43,
): Vector3[] {
	const theta = MathUtils.degToRad(angleDeg);

	const dx = end.x - start.x;
	const dz = end.z - start.z;
	const dir2 = new Vector2(dx, dz);
	const L = dir2.length();
	if (L < 1e-9) return [start.clone(), end.clone()];
	dir2.divideScalar(L);

	const axis: "x" | "z" = Math.abs(dx) > Math.abs(dz) ? "z" : "x";
	const sgn = axis === "z" ? (dz >= 0 ? 1 : -1) : dx >= 0 ? 1 : -1;

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

	const a1Start = Math.atan2(start.z - C1.z, start.x - C1.x);
	const a2End = Math.atan2(end.z - C2.z, end.x - C2.x);

	const tangentAt = (alpha: number, sign: 1 | -1): Vector2 => {
		const t = new Vector2(-Math.sin(alpha), Math.cos(alpha));
		return t.multiplyScalar(sign).normalize();
	};

	const chooseSignForStart = (a: number): 1 | -1 => {
		const dotPlus = tangentAt(a + theta, +1).dot(dir2);
		const dotMinus = tangentAt(a - theta, -1).dot(dir2);
		return dotPlus >= dotMinus ? +1 : -1;
	};
	const sgn1: 1 | -1 = chooseSignForStart(a1Start);
	const a1End = a1Start + sgn1 * theta;

	const chooseSignForEnd = (aEnd: number): 1 | -1 => {
		const dpPlus = tangentAt(aEnd, +1).dot(dir2);
		const dpMinus = tangentAt(aEnd, -1).dot(dir2);
		return dpPlus >= dpMinus ? +1 : -1;
	};
	const sgn2: 1 | -1 = chooseSignForEnd(a2End);
	const a2Start = a2End - sgn2 * theta;

	const yMid = MathUtils.lerp(start.y, end.y, 0.5);
	const P1 = new Vector3(
		C1.x + radius * Math.cos(a1End),
		yMid,
		C1.z + radius * Math.sin(a1End),
	);
	const P2 = new Vector3(
		C2.x + radius * Math.cos(a2Start),
		yMid,
		C2.z + radius * Math.sin(a2Start),
	);

	const baseArcN = Math.max(32, Math.round(lengthCount * 2));
	const baseLineN = Math.max(16, Math.round(lengthCount * 2));
	const dense: Vector3[] = [];

	for (let i = 0; i <= baseArcN; i++) {
		const t = i / baseArcN;
		const ang = MathUtils.lerp(a1Start, a1End, t);
		dense.push(
			new Vector3(
				C1.x + radius * Math.cos(ang),
				MathUtils.lerp(start.y, yMid, t),
				C1.z + radius * Math.sin(ang),
			),
		);
	}

	for (let i = 1; i <= baseLineN; i++) {
		const t = i / baseLineN;
		dense.push(new Vector3().lerpVectors(P1, P2, t));
	}

	for (let i = 1; i <= baseArcN; i++) {
		const t = i / baseArcN;
		const ang = MathUtils.lerp(a2Start, a2End, t);
		dense.push(
			new Vector3(
				C2.x + radius * Math.cos(ang),
				MathUtils.lerp(yMid, end.y, t),
				C2.z + radius * Math.sin(ang),
			),
		);
	}

	dense[dense.length - 1].copy(end);
	return resampleByArcLength(dense, lengthCount);
}

export const sCurveSpec: CurveSpec = {
	type: RAIL_TYPE.S_CURVE,

	generateCurve(from: Vector3, to: Vector3, options?: CurveOptions): Vector3[] {
		const originFrom = options?.originFrom
			? new Vector3(options.originFrom.x, options.originFrom.y, options.originFrom.z)
			: from;
		const originTo = options?.originTo
			? new Vector3(options.originTo.x, options.originTo.y, options.originTo.z)
			: to;

		const segments = options?.segments ?? 500;
		const radius = options?.radius ?? 0.5;
		const curvePoints = buildSCurvePoints(originFrom, originTo, segments, radius);

		return assembleFleOleTle(from, to, curvePoints, {
			originFrom,
			originTo,
			fle: options?.fle,
			tle: options?.tle,
			ole: options?.ole,
			segments,
		});
	},
};
