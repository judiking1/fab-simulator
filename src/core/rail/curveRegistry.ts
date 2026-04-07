/**
 * curveRegistry — Maps RailType → CurveSpec.
 *
 * Single lookup point for all curve type specifications.
 * Handles VOS aliases (CCW_CURVE → LEFT_CURVE, CW_CURVE → RIGHT_CURVE).
 */

import type { RailType } from "@/models/rail";
import { RAIL_TYPE } from "@/models/rail";
import type { CurveSpec } from "./CurveSpec";
import { cscHeteSpec } from "./specs/cscHete";
import { cscHomoSpec } from "./specs/cscHomo";
import { leftCurveSpec } from "./specs/leftCurve";
import { linearSpec } from "./specs/linear";
import { rightCurveSpec } from "./specs/rightCurve";
import { sCurveSpec } from "./specs/sCurve";
import { semicircleSpec } from "./specs/semicircle";

const registry = new Map<RailType, CurveSpec>([
	[RAIL_TYPE.LINEAR, linearSpec],
	[RAIL_TYPE.CURVE, semicircleSpec],
	[RAIL_TYPE.LEFT_CURVE, leftCurveSpec],
	[RAIL_TYPE.RIGHT_CURVE, rightCurveSpec],
	[RAIL_TYPE.S_CURVE, sCurveSpec],
	[RAIL_TYPE.CSC_CURVE_HOMO, cscHomoSpec],
	[RAIL_TYPE.CSC_CURVE_HETE, cscHeteSpec],
]);

/**
 * Get the CurveSpec for a given rail type.
 * Falls back to linearSpec for unknown types.
 */
export function getCurveSpec(railType: RailType): CurveSpec {
	return registry.get(railType) ?? linearSpec;
}
