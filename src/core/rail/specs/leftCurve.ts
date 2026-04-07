/**
 * LeftCurveSpec — LEFT_CURVE / CCW_CURVE: QuadraticBezier CCW arc.
 *
 * VOS convention: atan2 with NEGATED Z.
 * VOS default: curvature=1.0 (passed by createDefaultLinePoints).
 */

import { QuadraticBezierCurve3, Vector3 } from "three";
import { RAIL_TYPE } from "@/models/rail";
import type { CurveOptions, CurveSpec } from "../CurveSpec";
import { assembleFleOleTle } from "../curveUtils";

function buildLeftCurvePoints(
	start: Vector3,
	end: Vector3,
	segments = 50,
	curvature = 1.0,
): Vector3[] {
	const center = new Vector3().addVectors(start, end).multiplyScalar(0.5);
	const radius = start.distanceTo(center);

	const startAngle = Math.atan2(-(start.z - center.z), start.x - center.x);
	let endAngle = Math.atan2(-(end.z - center.z), end.x - center.x);

	if (endAngle <= startAngle) endAngle += 2 * Math.PI;

	const midAngle = (startAngle + endAngle) / 2;
	const controlPoint = new Vector3(
		center.x + radius * Math.cos(midAngle) * curvature,
		(start.y + end.y) / 2,
		center.z - radius * Math.sin(midAngle) * curvature,
	);

	const bezierCurve = new QuadraticBezierCurve3(start, controlPoint, end);
	return bezierCurve.getPoints(segments);
}

export const leftCurveSpec: CurveSpec = {
	type: RAIL_TYPE.LEFT_CURVE,

	generateCurve(from: Vector3, to: Vector3, options?: CurveOptions): Vector3[] {
		const originFrom = options?.originFrom
			? new Vector3(options.originFrom.x, options.originFrom.y, options.originFrom.z)
			: from;
		const originTo = options?.originTo
			? new Vector3(options.originTo.x, options.originTo.y, options.originTo.z)
			: to;

		const segments = options?.segments ?? 500;
		const curvature = options?.curvature ?? 1.0;
		const curvePoints = buildLeftCurvePoints(originFrom, originTo, segments, curvature);

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
