import type { RailEdge } from "@/models/rail";

// ─── Speed Calculator ───────────────────────────────────────────
// Kinematics-based travel time calculation using trapezoidal/triangular
// speed profiles. Pure functions — no side effects.

/** Result of a travel time calculation */
export interface TravelTimeResult {
	/** Total travel time in seconds */
	totalTime: number;
	/** Peak speed achieved (may be less than maxSpeed for short distances) */
	peakSpeed: number;
	/** Whether a full trapezoidal profile was achieved (vs triangular) */
	isTriangular: boolean;
}

/**
 * Calculate travel time for a given distance using a trapezoidal speed profile.
 *
 * The speed profile has three phases:
 * 1. Acceleration: 0 -> maxSpeed at rate `accel`
 * 2. Cruise: constant maxSpeed (may be zero if distance is too short)
 * 3. Deceleration: maxSpeed -> 0 at rate `decel`
 *
 * If distance is too short for full accel + decel, uses a triangular profile
 * where peak speed is less than maxSpeed.
 */
export function calcTravelTime(
	distance: number,
	maxSpeed: number,
	accel: number,
	decel: number,
): TravelTimeResult {
	if (distance <= 0) {
		return { totalTime: 0, peakSpeed: 0, isTriangular: false };
	}

	// Distance needed for full accel and decel phases
	const distAccel = (maxSpeed * maxSpeed) / (2 * accel);
	const distDecel = (maxSpeed * maxSpeed) / (2 * decel);
	const distAccelDecel = distAccel + distDecel;

	if (distance >= distAccelDecel) {
		// Trapezoidal profile: accel + cruise + decel
		const timeAccel = maxSpeed / accel;
		const timeDecel = maxSpeed / decel;
		const distCruise = distance - distAccelDecel;
		const timeCruise = distCruise / maxSpeed;

		return {
			totalTime: timeAccel + timeCruise + timeDecel,
			peakSpeed: maxSpeed,
			isTriangular: false,
		};
	}

	// Triangular profile: no cruise phase
	// Peak speed: v_peak = sqrt(2 * distance * accel * decel / (accel + decel))
	const peakSpeed = Math.sqrt((2 * distance * accel * decel) / (accel + decel));
	const timeAccel = peakSpeed / accel;
	const timeDecel = peakSpeed / decel;

	return {
		totalTime: timeAccel + timeDecel,
		peakSpeed,
		isTriangular: true,
	};
}

/** Convenience: calculate travel time for a rail edge given OHT config */
export function calcSegmentTravelTime(
	edge: RailEdge,
	ohtMaxSpeed: number,
	accel: number,
	decel: number,
	curveSpeedFactor = 1.0,
): number {
	let effectiveMaxSpeed = Math.min(ohtMaxSpeed, edge.maxSpeed);
	if (edge.lineType !== "straight") {
		effectiveMaxSpeed *= curveSpeedFactor;
	}
	const result = calcTravelTime(edge.distance, effectiveMaxSpeed, accel, decel);
	return result.totalTime;
}

/** Calculate stopping distance from a given speed: v^2 / (2 * decel) */
export function calcStoppingDistance(speed: number, deceleration: number): number {
	if (speed <= 0 || deceleration <= 0) return 0;
	return (speed * speed) / (2 * deceleration);
}
