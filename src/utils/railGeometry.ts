/**
 * railGeometry.ts — Convert curves into renderable rail segments for InstancedMesh.
 *
 * Each segment represents a small straight piece of rail:
 *   - position:  midpoint of the segment
 *   - direction: normalized forward vector
 *   - length:    segment length (with a small overlap for visual continuity)
 *
 * Segment count heuristics:
 *   - LINEAR: always 1 segment (a single stretched box)
 *   - Curves: max(80, ceil(curveLength / 0.1)) for smooth appearance
 */

import { type CatmullRomCurve3, Vector3 } from "three";
import type { RailType } from "@/models/rail";
import { RAIL_TYPE } from "@/models/rail";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RailSegment {
	/** Midpoint of this segment in world space */
	position: Vector3;
	/** Normalized direction (from→to) of this segment */
	direction: Vector3;
	/** Length of this segment in world units */
	length: number;
}

/**
 * SoA (Structure of Arrays) layout for bulk InstancedMesh updates.
 * Avoids per-segment object overhead for 1000+ rail rendering.
 */
export interface RailSegmentSoA {
	/** Flat [x,y,z, ...] stride 3 — midpoint positions */
	positions: Float32Array;
	/** Flat [x,y,z, ...] stride 3 — normalized directions */
	directions: Float32Array;
	/** Flat [len, ...] — segment lengths */
	lengths: Float32Array;
	/** Total number of segments */
	count: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EPS = 1e-9;

/**
 * Small overlap added to each segment length for visual continuity.
 * Prevents hairline gaps between adjacent segments on curves.
 */
const SEGMENT_OVERLAP = 0.05;

/** Minimum segment count for curved rails */
const MIN_CURVE_SEGMENTS = 80;

/** Target segment spacing in world units for curves */
const CURVE_SEGMENT_SPACING = 0.1;

// ---------------------------------------------------------------------------
// Reusable temporaries
// ---------------------------------------------------------------------------

const _prev = new Vector3();
const _curr = new Vector3();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create rail segments from a curve for InstancedMesh rendering.
 *
 * Each segment is a small oriented box: position (center), direction, and length.
 * Segments include a small overlap ({@link SEGMENT_OVERLAP}) for visual continuity.
 *
 * @param curve        - The rail curve to subdivide
 * @param segmentCount - Number of segments (typically from {@link getSegmentCount})
 */
export function createRailSegments(curve: CatmullRomCurve3, segmentCount: number): RailSegment[] {
	const segments: RailSegment[] = new Array(segmentCount);

	_prev.copy(curve.getPoint(0));

	for (let i = 1; i <= segmentCount; i++) {
		const t = i / segmentCount;
		_curr.copy(curve.getPoint(t));

		const position = new Vector3().addVectors(_prev, _curr).multiplyScalar(0.5);
		const direction = new Vector3().subVectors(_curr, _prev);
		const segLen = direction.length();

		if (segLen > EPS) {
			direction.multiplyScalar(1 / segLen);
		} else {
			direction.set(1, 0, 0);
		}

		segments[i - 1] = {
			position,
			direction,
			length: segLen + SEGMENT_OVERLAP,
		};

		_prev.copy(_curr);
	}

	return segments;
}

/**
 * Convert an array of RailSegments into a SoA layout for InstancedMesh.
 *
 * This is the preferred format for rendering — flat typed arrays
 * can be written directly into InstancedBufferAttributes.
 */
export function segmentsToSoA(segments: RailSegment[]): RailSegmentSoA {
	const count = segments.length;
	const positions = new Float32Array(count * 3);
	const directions = new Float32Array(count * 3);
	const lengths = new Float32Array(count);

	for (let i = 0; i < count; i++) {
		const seg = segments[i];
		const o3 = i * 3;
		positions[o3] = seg.position.x;
		positions[o3 + 1] = seg.position.y;
		positions[o3 + 2] = seg.position.z;

		directions[o3] = seg.direction.x;
		directions[o3 + 1] = seg.direction.y;
		directions[o3 + 2] = seg.direction.z;

		lengths[i] = seg.length;
	}

	return { positions, directions, lengths, count };
}

/**
 * Determine the appropriate segment count for a given rail type and length.
 *
 * - LINEAR: always 1 (single stretched box)
 * - Curves: max(MIN_CURVE_SEGMENTS, ceil(length / CURVE_SEGMENT_SPACING))
 *
 * @param railType - The rail type discriminant
 * @param length   - Total rail length in world units
 */
export function getSegmentCount(railType: RailType, length: number): number {
	if (railType === RAIL_TYPE.LINEAR) {
		return 1;
	}

	return Math.max(MIN_CURVE_SEGMENTS, Math.ceil(length / CURVE_SEGMENT_SPACING));
}

/**
 * Build a complete SoA buffer for a single rail, combining curve evaluation
 * and segment generation in one pass. Avoids intermediate RailSegment[] allocation.
 *
 * Use this for bulk rail processing where GC pressure matters.
 */
export function buildRailSoA(curve: CatmullRomCurve3, segmentCount: number): RailSegmentSoA {
	const positions = new Float32Array(segmentCount * 3);
	const directions = new Float32Array(segmentCount * 3);
	const lengths = new Float32Array(segmentCount);

	_prev.copy(curve.getPoint(0));

	for (let i = 1; i <= segmentCount; i++) {
		const t = i / segmentCount;
		_curr.copy(curve.getPoint(t));

		const idx = i - 1;
		const o3 = idx * 3;

		// Midpoint
		positions[o3] = (_prev.x + _curr.x) * 0.5;
		positions[o3 + 1] = (_prev.y + _curr.y) * 0.5;
		positions[o3 + 2] = (_prev.z + _curr.z) * 0.5;

		// Direction + length
		const dx = _curr.x - _prev.x;
		const dy = _curr.y - _prev.y;
		const dz = _curr.z - _prev.z;
		const segLen = Math.sqrt(dx * dx + dy * dy + dz * dz);

		if (segLen > EPS) {
			const inv = 1 / segLen;
			directions[o3] = dx * inv;
			directions[o3 + 1] = dy * inv;
			directions[o3 + 2] = dz * inv;
		} else {
			directions[o3] = 1;
			directions[o3 + 1] = 0;
			directions[o3 + 2] = 0;
		}

		lengths[idx] = segLen + SEGMENT_OVERLAP;

		_prev.copy(_curr);
	}

	return { positions, directions, lengths, count: segmentCount };
}
