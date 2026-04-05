/**
 * curveCache.ts — Pre-compute and cache sample points along curves.
 *
 * Stores positions (stride 3) and quaternions (stride 4) in Float32Arrays
 * for zero-allocation interpolation during playback. Default 500 samples
 * (501 entries) matches the VOS reference implementation.
 *
 * Quaternions are derived from a Frenet-like frame:
 *   tangent  = forward direction along curve
 *   normal   = world up crossed appropriately
 *   binormal = completes the basis
 */

import { type CatmullRomCurve3, Matrix4, Quaternion, Vector3 } from "three";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CachedCurveData {
	/** Position samples, stride 3: [x,y,z, x,y,z, ...]. Length = (sampleCount+1)*3 */
	points: Float32Array;
	/** Orientation samples, stride 4: [x,y,z,w, ...]. Length = (sampleCount+1)*4 */
	quaternions: Float32Array;
	/** Total arc length of the curve */
	length: number;
	/** Number of sample intervals (point count = sampleCount + 1) */
	sampleCount: number;
}

// ---------------------------------------------------------------------------
// Reusable temporaries (module-scoped to avoid per-call allocations)
// ---------------------------------------------------------------------------

const _tmpPt = new Vector3();
const _tmpPt2 = new Vector3();
const _tangent = new Vector3();
const _binormal = new Vector3();
const _normal = new Vector3();
const _mat4 = new Matrix4();
const _quat = new Quaternion();
const _worldUp = new Vector3(0, 1, 0);

const _outPos = new Vector3();
const _outQuat = new Quaternion();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Cache N uniformly-spaced samples along a CatmullRomCurve3.
 *
 * Produces (sampleCount + 1) entries — index 0 is t=0, index sampleCount is t=1.
 * Positions and orientations are stored in flat typed arrays for fast
 * per-frame lookups with minimal GC pressure.
 *
 * @param curve       - The curve to sample
 * @param sampleCount - Number of intervals (default 500 → 501 points)
 */
export function cacheCurve(curve: CatmullRomCurve3, sampleCount = 500): CachedCurveData {
	const count = sampleCount + 1;
	const points = new Float32Array(count * 3);
	const quaternions = new Float32Array(count * 4);

	// Sample positions
	for (let i = 0; i < count; i++) {
		curve.getPoint(i / sampleCount, _tmpPt);
		const o3 = i * 3;
		points[o3] = _tmpPt.x;
		points[o3 + 1] = _tmpPt.y;
		points[o3 + 2] = _tmpPt.z;
	}

	// Sample orientations (tangent-based Frenet frame)
	for (let i = 0; i < count; i++) {
		const t = i / sampleCount;
		computeTangent(curve, t, _tangent);

		// Build orthonormal basis: tangent, normal, binormal
		_binormal.crossVectors(_tangent, _worldUp).normalize();

		// If tangent is nearly parallel to world up, pick an arbitrary right vector
		if (_binormal.lengthSq() < 1e-6) {
			_binormal.set(1, 0, 0);
		}

		_normal.crossVectors(_binormal, _tangent).normalize();

		_mat4.makeBasis(_tangent, _normal, _binormal);
		_quat.setFromRotationMatrix(_mat4);

		const o4 = i * 4;
		quaternions[o4] = _quat.x;
		quaternions[o4 + 1] = _quat.y;
		quaternions[o4 + 2] = _quat.z;
		quaternions[o4 + 3] = _quat.w;
	}

	return {
		points,
		quaternions,
		length: curve.getLength(),
		sampleCount,
	};
}

/**
 * Retrieve an interpolated position at a given ratio (0–1) from a cache.
 *
 * Uses linear interpolation between the two nearest cached samples.
 * Returns a new Vector3 (caller may reuse via .copy()).
 */
export function getPositionAtRatio(cache: CachedCurveData, ratio: number): Vector3 {
	const t = clamp01(ratio) * cache.sampleCount;
	const idx = Math.min(Math.floor(t), cache.sampleCount - 1);
	const frac = t - idx;

	const o1 = idx * 3;
	const o2 = (idx + 1) * 3;

	_outPos.set(
		cache.points[o1] + frac * (cache.points[o2] - cache.points[o1]),
		cache.points[o1 + 1] + frac * (cache.points[o2 + 1] - cache.points[o1 + 1]),
		cache.points[o1 + 2] + frac * (cache.points[o2 + 2] - cache.points[o1 + 2]),
	);

	return _outPos.clone();
}

/**
 * Retrieve an interpolated quaternion at a given ratio (0–1) from a cache.
 *
 * Uses spherical linear interpolation (slerp) between the two nearest samples.
 * Returns a new Quaternion (caller may reuse via .copy()).
 */
export function getQuaternionAtRatio(cache: CachedCurveData, ratio: number): Quaternion {
	const t = clamp01(ratio) * cache.sampleCount;
	const idx = Math.min(Math.floor(t), cache.sampleCount - 1);
	const frac = t - idx;

	const o1 = idx * 4;
	const o2 = (idx + 1) * 4;

	const q1 = new Quaternion(
		cache.quaternions[o1],
		cache.quaternions[o1 + 1],
		cache.quaternions[o1 + 2],
		cache.quaternions[o1 + 3],
	);
	const q2 = new Quaternion(
		cache.quaternions[o2],
		cache.quaternions[o2 + 1],
		cache.quaternions[o2 + 2],
		cache.quaternions[o2 + 3],
	);

	_outQuat.copy(q1).slerp(q2, frac);
	return _outQuat.clone();
}

/**
 * Write interpolated position directly into a Float32Array at the given offset.
 * Zero-allocation — intended for bulk updates during animation frames.
 *
 * @param cache  - Cached curve data
 * @param ratio  - Position along curve (0–1)
 * @param out    - Target Float32Array
 * @param offset - Byte offset (index into the array, not byte offset)
 */
export function writePositionAtRatio(
	cache: CachedCurveData,
	ratio: number,
	out: Float32Array,
	offset: number,
): void {
	const t = clamp01(ratio) * cache.sampleCount;
	const idx = Math.min(Math.floor(t), cache.sampleCount - 1);
	const frac = t - idx;

	const o1 = idx * 3;
	const o2 = (idx + 1) * 3;

	out[offset] = cache.points[o1] + frac * (cache.points[o2] - cache.points[o1]);
	out[offset + 1] = cache.points[o1 + 1] + frac * (cache.points[o2 + 1] - cache.points[o1 + 1]);
	out[offset + 2] = cache.points[o1 + 2] + frac * (cache.points[o2 + 2] - cache.points[o1 + 2]);
}

/**
 * Write interpolated quaternion directly into a Float32Array at the given offset.
 * Zero-allocation — intended for bulk updates during animation frames.
 */
export function writeQuaternionAtRatio(
	cache: CachedCurveData,
	ratio: number,
	out: Float32Array,
	offset: number,
): void {
	const t = clamp01(ratio) * cache.sampleCount;
	const idx = Math.min(Math.floor(t), cache.sampleCount - 1);
	const frac = t - idx;

	const o1 = idx * 4;
	const o2 = (idx + 1) * 4;

	const q1x = cache.quaternions[o1];
	const q1y = cache.quaternions[o1 + 1];
	const q1z = cache.quaternions[o1 + 2];
	const q1w = cache.quaternions[o1 + 3];

	const q2x = cache.quaternions[o2];
	const q2y = cache.quaternions[o2 + 1];
	const q2z = cache.quaternions[o2 + 2];
	const q2w = cache.quaternions[o2 + 3];

	// Manual slerp to avoid Quaternion allocation
	let dot = q1x * q2x + q1y * q2y + q1z * q2z + q1w * q2w;

	// Ensure shortest path
	let s2x = q2x;
	let s2y = q2y;
	let s2z = q2z;
	let s2w = q2w;
	if (dot < 0) {
		dot = -dot;
		s2x = -s2x;
		s2y = -s2y;
		s2z = -s2z;
		s2w = -s2w;
	}

	let s0: number;
	let s1: number;

	if (1.0 - dot > 1e-6) {
		const omega = Math.acos(Math.min(dot, 1.0));
		const sinOmega = Math.sin(omega);
		s0 = Math.sin((1.0 - frac) * omega) / sinOmega;
		s1 = Math.sin(frac * omega) / sinOmega;
	} else {
		// Nearly identical quaternions — linear interpolation
		s0 = 1.0 - frac;
		s1 = frac;
	}

	out[offset] = s0 * q1x + s1 * s2x;
	out[offset + 1] = s0 * q1y + s1 * s2y;
	out[offset + 2] = s0 * q1z + s1 * s2z;
	out[offset + 3] = s0 * q1w + s1 * s2w;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute a tangent vector at parameter t using finite differences.
 * Matches VOS approach: sample two nearby points and normalize the delta.
 */
function computeTangent(curve: CatmullRomCurve3, t: number, out: Vector3): void {
	const DELTA = 0.005;
	const t1 = Math.max(0, t - DELTA);
	const t2 = Math.min(1, t + DELTA);
	curve.getPoint(t1, _tmpPt);
	curve.getPoint(t2, _tmpPt2);
	out.copy(_tmpPt2).sub(_tmpPt).normalize();
}

function clamp01(value: number): number {
	return value < 0 ? 0 : value > 1 ? 1 : value;
}
