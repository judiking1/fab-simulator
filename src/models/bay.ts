/**
 * Bay — An ordered set of Rails forming a closed loop.
 * OHTs circulate within a bay in the specified direction.
 */
export interface BayData {
	id: string;
	fabId: string;
	/** Ordered rail IDs forming the closed loop */
	railIds: string[];
	/** Loop travel direction (counter-clockwise by default) */
	loopDirection: "ccw" | "cw";
}
