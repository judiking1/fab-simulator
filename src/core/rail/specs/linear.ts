/**
 * LinearSpec — Straight line between two nodes.
 * No curve, no FLE/TLE/OLE.
 */

import { Vector3 } from "three";
import { RAIL_TYPE } from "@/models/rail";
import type { CurveOptions, CurveSpec } from "../CurveSpec";
import { linearPoints } from "../curveUtils";

export const linearSpec: CurveSpec = {
	type: RAIL_TYPE.LINEAR,

	generateCurve(from: Vector3, to: Vector3, _options?: CurveOptions): Vector3[] {
		return linearPoints(from, to, 2);
	},
};
