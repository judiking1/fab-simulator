/**
 * CurveSpec — Interface for rail curve type specifications.
 *
 * Each rail type (LINEAR, LEFT_CURVE, S_CURVE, etc.) implements this interface.
 * The spec is the single source of truth for "how to draw a curve given two endpoints."
 *
 * Key design: TMP/origin points are computed internally and never exposed.
 * The caller provides fromPos + toPos + optional overrides, and gets back
 * a fully constructed point array ready for CatmullRomCurve3.
 */

import type { Vector3 } from "three";
import type { RailType } from "@/models/rail";

// ---------------------------------------------------------------------------
// Core interfaces
// ---------------------------------------------------------------------------

/**
 * Options that override the spec's default behavior.
 * Only fields that differ from the spec's defaults need to be provided.
 * These are stored in RailData.curveOverrides for rails that deviate from defaults.
 */
export interface CurveOptions {
	/** Curve radius override (each spec has its own default) */
	radius?: number;
	/** Curvature factor for Bezier curves (default varies by spec) */
	curvature?: number;
	/** Total output segments (default 500, matching VOS) */
	segments?: number;
	/** Waypoint coordinates for CSC_CURVE_HETE (6 points) */
	waypoints?: Array<{ x: number; y: number; z: number }>;

	// --- VOS legacy overrides (used during import, phased out over time) ---
	/** Explicit origin start point (bypasses auto-calculation) */
	originFrom?: { x: number; y: number; z: number };
	/** Explicit origin end point (bypasses auto-calculation) */
	originTo?: { x: number; y: number; z: number };
	/** Explicit FLE/TLE/OLE lengths (bypasses auto-calculation) */
	fle?: number;
	tle?: number;
	ole?: number;
}

/**
 * A CurveSpec defines how to generate curve points for a specific rail type.
 *
 * Implementations must be pure functions with no side effects.
 * All intermediate computation (TMP points, origins, etc.) stays internal.
 */
export interface CurveSpec {
	/** The rail type(s) this spec handles */
	readonly type: RailType;

	/**
	 * Generate the complete point array for this curve type.
	 *
	 * For curved types, this assembles:
	 *   1. FLE (straight: fromPos → originFrom)
	 *   2. OLE (curve: originFrom → originTo)
	 *   3. TLE (straight: originTo → toPos)
	 *
	 * Origins and FLE/TLE/OLE are either auto-computed or taken from options.
	 *
	 * @param from - Start node position (fromNode)
	 * @param to   - End node position (toNode)
	 * @param options - Optional overrides for curve parameters
	 * @returns Array of Vector3 points for CatmullRomCurve3
	 */
	generateCurve(from: Vector3, to: Vector3, options?: CurveOptions): Vector3[];
}
