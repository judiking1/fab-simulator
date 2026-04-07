/**
 * SemicircleSpec — CURVE type: CCW semicircle arc.
 *
 * VOS convention: atan2 with NEGATED Z.
 * Y is flat (start.y for all points).
 */

import { Vector3 } from "three";
import { RAIL_TYPE } from "@/models/rail";
import type { CurveOptions, CurveSpec } from "../CurveSpec";
import { assembleFleOleTle } from "../curveUtils";

function buildSemicirclePoints(start: Vector3, end: Vector3, segments = 100): Vector3[] {
	const center = new Vector3().addVectors(start, end).multiplyScalar(0.5);
	const radius = start.distanceTo(center);

	const startAngle = Math.atan2(-(start.z - center.z), start.x - center.x);
	let endAngle = Math.atan2(-(end.z - center.z), end.x - center.x);

	if (endAngle <= startAngle) endAngle += 2 * Math.PI;

	return Array.from({ length: segments + 1 }, (_, i) => {
		const t = i / segments;
		const angle = startAngle + t * (endAngle - startAngle);
		const x = center.x + radius * Math.cos(angle);
		const z = center.z - radius * Math.sin(angle);
		return new Vector3(x, start.y, z);
	});
}

export const semicircleSpec: CurveSpec = {
	type: RAIL_TYPE.CURVE,

	generateCurve(from: Vector3, to: Vector3, options?: CurveOptions): Vector3[] {
		const originFrom = options?.originFrom
			? new Vector3(options.originFrom.x, options.originFrom.y, options.originFrom.z)
			: from;
		const originTo = options?.originTo
			? new Vector3(options.originTo.x, options.originTo.y, options.originTo.z)
			: to;

		const segments = options?.segments ?? 500;
		const curvePoints = buildSemicirclePoints(originFrom, originTo, segments);

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
