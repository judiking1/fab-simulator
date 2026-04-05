/**
 * Rail — A directed rail segment connecting two Nodes.
 * OHTs travel from fromNode to toNode (no reverse).
 */

export const RAIL_TYPE = {
	LINEAR: "LINEAR",
	CURVE: "CURVE",
	LEFT_CURVE: "LEFT_CURVE",
	RIGHT_CURVE: "RIGHT_CURVE",
	S_CURVE: "S_CURVE",
	CSC_CURVE_HOMO: "CSC_CURVE_HOMO",
	CSC_CURVE_HETE: "CSC_CURVE_HETE",
} as const;

export type RailType = (typeof RAIL_TYPE)[keyof typeof RAIL_TYPE];

export interface RailData {
	id: string;
	fromNodeId: string;
	toNodeId: string;
	railType: RailType;
	/** Calculated or measured length of the rail segment */
	length: number;
	bayId: string;
	fabId: string;
	/** Max speed on this rail (mm/s) */
	speed: number;
	/** Acceleration (mm/s²) */
	acc: number;
	/** Deceleration (mm/s², typically negative) */
	dec: number;
	/** Curve radius. -1 for LINEAR rails */
	radius: number;
	/**
	 * Intermediate node IDs for CSC_CURVE_HETE (typically 6 nodes).
	 * Empty array for all other rail types.
	 */
	curveNodeIds: string[];

	// --- Curve geometry data (from VOS origin coordinates) ---

	/** Curve start point (distinct from fromNode position). null for LINEAR. */
	originFrom: { x: number; y: number; z: number } | null;
	/** Curve end point (distinct from toNode position). null for LINEAR. */
	originTo: { x: number; y: number; z: number } | null;
	/** Front Linear Element — straight distance from fromNode to curve start */
	fle: number;
	/** Tail Linear Element — straight distance from curve end to toNode */
	tle: number;
	/** Outer Linear Element — curve portion distance */
	ole: number;
}

// ---------------------------------------------------------------------------
// RailCreationParams — discriminated union for type-safe rail creation
// ---------------------------------------------------------------------------

interface RailCreationBase {
	id: string;
	fromNodeId: string;
	toNodeId: string;
	bayId: string;
	fabId: string;
	speed: number;
	acc: number;
	dec: number;
}

interface LinearRailCreation extends RailCreationBase {
	railType: typeof RAIL_TYPE.LINEAR;
}

interface CurveRailCreation extends RailCreationBase {
	railType:
		| typeof RAIL_TYPE.CURVE
		| typeof RAIL_TYPE.LEFT_CURVE
		| typeof RAIL_TYPE.RIGHT_CURVE
		| typeof RAIL_TYPE.S_CURVE;
	radius: number;
}

interface CscHomoRailCreation extends RailCreationBase {
	railType: typeof RAIL_TYPE.CSC_CURVE_HOMO;
}

interface CscHeteRailCreation extends RailCreationBase {
	railType: typeof RAIL_TYPE.CSC_CURVE_HETE;
	/** Exactly 6 intermediate curve node IDs */
	curveNodeIds: [string, string, string, string, string, string];
}

export type RailCreationParams =
	| LinearRailCreation
	| CurveRailCreation
	| CscHomoRailCreation
	| CscHeteRailCreation;
