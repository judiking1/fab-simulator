/**
 * CscHomoSpec — CSC_CURVE_HOMO: 90°-Line-90° U-turn.
 *
 * VOS convention: uses NON-negated Z in atan2.
 * Direction is always "r" (right turn, turnSign = -1).
 */

import { MathUtils, Vector2, Vector3 } from "three";
import { RAIL_TYPE } from "@/models/rail";
import type { CurveOptions, CurveSpec } from "../CurveSpec";
import { assembleFleOleTle, resampleByArcLength } from "../curveUtils";

function buildCscHomoPoints(
	start: Vector3,
	end: Vector3,
	lengthCount: number,
	dir = "r",
	radius = 0.5,
): Vector3[] {
	const theta = MathUtils.degToRad(90);

	const dx = end.x - start.x;
	const dz = end.z - start.z;
	const dir2 = new Vector2(dx, dz);
	const dirLen = dir2.length();
	if (dirLen < 1e-9) return [start.clone(), end.clone()];
	dir2.divideScalar(dirLen);

	const turnSign = dir === "l" ? 1 : -1;

	const axis: "x" | "z" = Math.abs(dx) < Math.abs(dz) ? "z" : "x";
	const sgn = axis === "z" ? (dz >= 0 ? 1 : -1) : dx >= 0 ? 1 : -1;

	const C1 = new Vector3(
		start.x - (axis === "x" ? sgn * radius * turnSign : 0),
		start.y,
		start.z - (axis === "z" ? sgn * radius * turnSign : 0),
	);
	const C2 = new Vector3(
		end.x + (axis === "x" ? sgn * radius * turnSign : 0),
		end.y,
		end.z + (axis === "z" ? sgn * radius * turnSign : 0),
	);

	const a1Start = Math.atan2(start.z - C1.z, start.x - C1.x);
	const a1End = a1Start + turnSign * theta;

	const a2End = Math.atan2(end.z - C2.z, end.x - C2.x);
	const a2Start = a2End - turnSign * theta;

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

export const cscHomoSpec: CurveSpec = {
	type: RAIL_TYPE.CSC_CURVE_HOMO,

	generateCurve(from: Vector3, to: Vector3, options?: CurveOptions): Vector3[] {
		const originFrom = options?.originFrom
			? new Vector3(options.originFrom.x, options.originFrom.y, options.originFrom.z)
			: from;
		const originTo = options?.originTo
			? new Vector3(options.originTo.x, options.originTo.y, options.originTo.z)
			: to;

		const segments = options?.segments ?? 500;
		const radius = options?.radius ?? 0.5;
		const curvePoints = buildCscHomoPoints(originFrom, originTo, segments, "r", radius);

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
