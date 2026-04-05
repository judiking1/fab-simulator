/**
 * RailRenderer — Renders all rails using a single InstancedMesh (Layer 3).
 *
 * 3-Layer architecture (ADR-003):
 *   Layer 1: Zustand store (selectRailCount triggers React re-render on add/delete)
 *   Layer 2: Geometry cache (ref-based, rebuilt on dirty rails)
 *   Layer 3: InstancedMesh (imperative setMatrixAt in useFrame)
 *
 * Each rail is subdivided into segments. Each segment becomes one instance
 * of a PlaneGeometry(1, 1) stretched and oriented via its transform matrix.
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
import { buildRailCurve } from "@/utils/curveBuilder";
import type { CachedCurveData } from "@/utils/curveCache";
import { cacheCurve } from "@/utils/curveCache";
import { buildRailSoA, getSegmentCount, type RailSegmentSoA } from "@/utils/railGeometry";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RAIL_COLOR = new Color("#06b6d4");
const RAIL_WIDTH = 0.3;
const FORWARD = new Vector3(1, 0, 0); // Base direction of PlaneGeometry

// ---------------------------------------------------------------------------
// Module-scoped temporaries (avoid per-frame allocation)
// ---------------------------------------------------------------------------

const _position = new Vector3();
const _direction = new Vector3();
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
	const meshRef = useRef<InstancedMesh>(null);
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

			const curve = buildRailCurve({ rail, fromPos, toPos });

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

		// Pass 2: write all matrices into InstancedMesh
		const mesh = meshRef.current;
		if (!mesh) return;

		// Resize instance count if needed
		if (mesh.count !== totalSegments) {
			mesh.count = totalSegments;
		}

		for (const entry of cache.values()) {
			writeSegmentMatrices(mesh, entry);
		}

		mesh.instanceMatrix.needsUpdate = true;
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

		const mesh = meshRef.current;
		if (!mesh) return;

		const { nodes, rails } = useMapStore.getState();
		const cache = geometryCacheRef.current;

		// Check if any dirty rail requires total segment count change
		let needsFullRebuild = false;

		for (const railId of dirtyRailIds) {
			const rail = rails[railId];
			const existing = cache.get(railId);

			if (!rail || !existing) {
				// Rail was added or removed — need full rebuild
				needsFullRebuild = true;
				break;
			}

			const fromNode = nodes[rail.fromNodeId];
			const toNode = nodes[rail.toNodeId];
			if (!fromNode || !toNode) continue;

			const fromPos = new Vector3(fromNode.x, fromNode.y, fromNode.z);
			const toPos = new Vector3(toNode.x, toNode.y, toNode.z);

			const curve = buildRailCurve({ rail, fromPos, toPos });

			const curveData = cacheCurve(curve);
			const segCount = getSegmentCount(rail.railType, curveData.length);

			if (segCount !== existing.soa.count) {
				// Segment count changed — need full rebuild to reindex
				needsFullRebuild = true;
				break;
			}

			// Same segment count: update in place
			const soa = buildRailSoA(curve, segCount);
			existing.curve = curve;
			existing.curveCache = curveData;
			existing.soa = soa;

			writeSegmentMatrices(mesh, existing);
		}

		if (needsFullRebuild) {
			rebuildAllRails();
			return;
		}

		mesh.instanceMatrix.needsUpdate = true;
	});

	// Max instance count — generous upper bound for dynamic resizing
	const maxInstances = Math.max(railCount * 100, 1);

	return (
		<instancedMesh
			ref={meshRef}
			args={[geometry, material, maxInstances]}
			frustumCulled={false}
			count={0}
		/>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write segment matrices from a rail's SoA data into the InstancedMesh.
 */
function writeSegmentMatrices(mesh: InstancedMesh, entry: RailGeometryEntry): void {
	const { soa, soaStartIndex } = entry;

	for (let i = 0; i < soa.count; i++) {
		const o3 = i * 3;

		// Position (midpoint of segment)
		_position.set(soa.positions[o3], soa.positions[o3 + 1], soa.positions[o3 + 2]);

		// Direction → quaternion (rotate from FORWARD to segment direction)
		_direction.set(soa.directions[o3], soa.directions[o3 + 1], soa.directions[o3 + 2]);
		_quaternion.setFromUnitVectors(FORWARD, _direction);

		// Scale: length along X (forward), width along Y, flat along Z
		_scale.set(soa.lengths[i], RAIL_WIDTH, 1);

		_matrix.compose(_position, _quaternion, _scale);
		mesh.setMatrixAt(soaStartIndex + i, _matrix);
	}
}
