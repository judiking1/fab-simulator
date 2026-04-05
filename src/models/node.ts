/**
 * Node — A waypoint in the rail network graph.
 * Coordinates use Three.js Y-up convention.
 */
export interface NodeData {
	id: string;
	/** World X (lateral) */
	x: number;
	/** World Y (up/height) */
	y: number;
	/** World Z (depth) */
	z: number;
}
