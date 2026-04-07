/**
 * RailRenderer — Renders all rails as dual-track parallel lines (Layer 3).
 *
 * 3-Layer architecture (ADR-003):
 *   Layer 1: Zustand store (selectRailCount triggers React re-render on add/delete)
 *   Layer 2: Geometry cache (ref-based, rebuilt on dirty rails)
 *   Layer 3: TWO InstancedMeshes (left track + right track)
 *
 * Each rail is subdivided into segments. Each segment produces TWO instances
 * (one per track), offset perpendicular to the rail direction.
 */

import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	Color,
	DoubleSide,
	type InstancedMesh,
	Matrix4,
	MeshBasicMaterial,
	PlaneGeometry,
	Quaternion,
	Vector3,
} from "three";
import { selectRailCount, useMapStore } from "@/stores/mapStore";
import { registerMesh } from "@/systems/instanceRegistry";
import { buildRailCurve } from "@/utils/curveBuilder";
import type { CachedCurveData } from "@/utils/curveCache";
import { cacheCurve } from "@/utils/curveCache";
import { buildRailSoA, getSegmentCount, type RailSegmentSoA } from "@/utils/railGeometry";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RAIL_COLOR = new Color("#2563eb");
const TRACK_WIDTH = 0.12;
const TRACK_OFFSET = 0.18;
const FORWARD = new Vector3(1, 0, 0); // Base direction of PlaneGeometry
const UP_VECTOR = new Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// Module-scoped temporaries (avoid per-frame allocation)
// ---------------------------------------------------------------------------

const _position = new Vector3();
const _direction = new Vector3();
const _perpendicular = new Vector3();
const _trackPos = new Vector3();
const _scale = new Vector3();
const _quaternion = new Quaternion();
const _matrix = new Matrix4();

// ---------------------------------------------------------------------------
// Per-rail cached geometry entry
// ---------------------------------------------------------------------------

interface RailGeometryEntry {
	curve: ReturnType<typeof buildRailCurve>;
	curveCache: CachedCurveData;
	soa: RailSegmentSoA;
	/** Start index in the combined InstancedMesh */
	soaStartIndex: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RailRenderer(): React.JSX.Element | null {
	const railCount = useMapStore(selectRailCount);

	// Layer 2: geometry cache (ref-based, outside React render cycle)
	const geometryCacheRef = useRef<Map<string, RailGeometryEntry>>(new Map());
	const leftMeshRef = useRef<InstancedMesh>(null);
	const rightMeshRef = useRef<InstancedMesh>(null);
	const totalSegmentsRef = useRef(0);

	// Shared geometry and material (reused across rebuilds)
	const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
	const material = useMemo(
		() =>
			new MeshBasicMaterial({
				color: RAIL_COLOR,
				side: DoubleSide,
				toneMapped: false,
			}),
		[],
	);

	/**
	 * Rebuild geometry cache and InstancedMesh matrices for ALL rails.
	 * Called on mount, when rail count changes, and when dirty rails need full reindex.
	 *
	 * Stable ref: only accesses refs and store.getState() — no reactive deps.
	 */
	const rebuildAllRails = useCallback((): void => {
		const { nodes, rails } = useMapStore.getState();
		const cache = new Map<string, RailGeometryEntry>();
		let totalSegments = 0;

		const railEntries = Object.values(rails);

		// Pass 1: build curves and SoA for each rail, compute total segment count
		for (const rail of railEntries) {
			const fromNode = nodes[rail.fromNodeId];
			const toNode = nodes[rail.toNodeId];
			if (!fromNode || !toNode) continue;

			const fromPos = new Vector3(fromNode.x, fromNode.y, fromNode.z);
			const toPos = new Vector3(toNode.x, toNode.y, toNode.z);

			const curve = buildRailCurve({ rail, fromPos, toPos, nodePositions: nodes });

			const curveData = cacheCurve(curve);
			const segCount = getSegmentCount(rail.railType, curveData.length);
			const soa = buildRailSoA(curve, segCount);

			cache.set(rail.id, {
				curve,
				curveCache: curveData,
				soa,
				soaStartIndex: totalSegments,
			});

			totalSegments += soa.count;
		}

		geometryCacheRef.current = cache;
		totalSegmentsRef.current = totalSegments;

		// Pass 2: write all matrices into both InstancedMeshes
		const leftMesh = leftMeshRef.current;
		const rightMesh = rightMeshRef.current;
		if (!leftMesh || !rightMesh) return;

		leftMesh.count = totalSegments;
		rightMesh.count = totalSegments;

		for (const entry of cache.values()) {
			writeSegmentMatrices(leftMesh, rightMesh, entry);
		}

		leftMesh.instanceMatrix.needsUpdate = true;
		rightMesh.instanceMatrix.needsUpdate = true;

		// Register with instance registry for raycasting
		// Build segment-index → railId mapping
		const segmentToRailId: string[] = [];
		for (const [railId, entry] of cache) {
			for (let i = 0; i < entry.soa.count; i++) {
				segmentToRailId[entry.soaStartIndex + i] = railId;
			}
		}
		registerMesh(leftMesh.uuid, "rail", segmentToRailId);
		registerMesh(rightMesh.uuid, "rail", segmentToRailId);
	}, []);

	// Full rebuild when rail count changes (add/delete rail).
	// biome-ignore lint/correctness/useExhaustiveDependencies: railCount is an intentional trigger — rebuild geometry when rails are added/removed
	useEffect(() => {
		rebuildAllRails();
	}, [railCount, rebuildAllRails]);

	/**
	 * Rebuild only dirty rails (node moved, rail updated).
	 * Called every frame via useFrame.
	 */
	useFrame(() => {
		const dirtyRailIds = useMapStore.getState().consumeDirtyRails();
		if (dirtyRailIds.length === 0) return;

		const leftMesh = leftMeshRef.current;
		const rightMesh = rightMeshRef.current;
		if (!leftMesh || !rightMesh) return;

		const { nodes, rails } = useMapStore.getState();
		const cache = geometryCacheRef.current;

		// Check if any dirty rail requires total segment count change
		let needsFullRebuild = false;

		for (const railId of dirtyRailIds) {
			const rail = rails[railId];
			const existing = cache.get(railId);

			if (!rail || !existing) {
				needsFullRebuild = true;
				break;
			}

			const fromNode = nodes[rail.fromNodeId];
			const toNode = nodes[rail.toNodeId];
			if (!fromNode || !toNode) continue;

			const fromPos = new Vector3(fromNode.x, fromNode.y, fromNode.z);
			const toPos = new Vector3(toNode.x, toNode.y, toNode.z);

			const curve = buildRailCurve({ rail, fromPos, toPos, nodePositions: nodes });

			const curveData = cacheCurve(curve);
			const segCount = getSegmentCount(rail.railType, curveData.length);

			if (segCount !== existing.soa.count) {
				needsFullRebuild = true;
				break;
			}

			// Same segment count: update in place
			const soa = buildRailSoA(curve, segCount);
			existing.curve = curve;
			existing.curveCache = curveData;
			existing.soa = soa;

			writeSegmentMatrices(leftMesh, rightMesh, existing);
		}

		if (needsFullRebuild) {
			rebuildAllRails();
			return;
		}

		leftMesh.instanceMatrix.needsUpdate = true;
		rightMesh.instanceMatrix.needsUpdate = true;
	});

	// Max instance count — generous upper bound for dynamic resizing
	const maxInstances = Math.max(railCount * 100, 1);

	return (
		<>
			<instancedMesh
				ref={leftMeshRef}
				args={[geometry, material, maxInstances]}
				frustumCulled={false}
				count={0}
			/>
			<instancedMesh
				ref={rightMeshRef}
				args={[geometry, material, maxInstances]}
				frustumCulled={false}
				count={0}
			/>
		</>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write segment matrices from a rail's SoA data into BOTH InstancedMeshes.
 * Each segment produces two instances: left track and right track,
 * offset perpendicular to the rail direction.
 */
function writeSegmentMatrices(
	leftMesh: InstancedMesh,
	rightMesh: InstancedMesh,
	entry: RailGeometryEntry,
): void {
	const { soa, soaStartIndex } = entry;

	for (let i = 0; i < soa.count; i++) {
		const o3 = i * 3;

		// Center position (midpoint of segment)
		_position.set(soa.positions[o3], soa.positions[o3 + 1], soa.positions[o3 + 2]);

		// Direction → quaternion
		_direction.set(soa.directions[o3], soa.directions[o3 + 1], soa.directions[o3 + 2]);
		_quaternion.setFromUnitVectors(FORWARD, _direction);

		// Perpendicular vector in XZ plane (cross of direction × up)
		_perpendicular.crossVectors(_direction, UP_VECTOR).normalize();

		// Scale: length along X (forward), track width along Y
		_scale.set(soa.lengths[i], TRACK_WIDTH, 1);

		const idx = soaStartIndex + i;

		// Left track: offset in -perpendicular direction
		_trackPos.copy(_position).addScaledVector(_perpendicular, -TRACK_OFFSET);
		_matrix.compose(_trackPos, _quaternion, _scale);
		leftMesh.setMatrixAt(idx, _matrix);

		// Right track: offset in +perpendicular direction
		_trackPos.copy(_position).addScaledVector(_perpendicular, TRACK_OFFSET);
		_matrix.compose(_trackPos, _quaternion, _scale);
		rightMesh.setMatrixAt(idx, _matrix);
	}
}
