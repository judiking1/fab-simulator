/**
 * NodeRenderer — Renders all nodes (waypoints) using a single InstancedMesh (Layer 3).
 *
 * 3-Layer architecture (ADR-003):
 *   Layer 1: Zustand store (selectNodeCount triggers React re-render on add/delete)
 *   Layer 2: Geometry cache (ref-based nodeIndexMap for instance index lookup)
 *   Layer 3: InstancedMesh (imperative setMatrixAt in useFrame)
 *
 * Node positions come directly from NodeData.{x, y, z} — no curve interpolation.
 * Dirty updates: when dirtyRailIds is non-empty, rebuild all node positions.
 * (Node moves go through updateNode() which marks connected rails dirty,
 *  so we piggyback on the rail dirty set — peek only, don't consume.)
 */

import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	Color,
	type InstancedMesh,
	Matrix4,
	MeshBasicMaterial,
	Quaternion,
	SphereGeometry,
	Vector3,
} from "three";
import { selectNodeCount, useMapStore } from "@/stores/mapStore";
import { getDraggedPosition, isDragActive } from "@/systems/dragPreview";
import { registerMesh } from "@/systems/instanceRegistry";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_COLOR = new Color("#6b7280");
const NODE_RADIUS = 0.18;
const HIT_RADIUS = 0.5; // Invisible hit area — larger for easy clicking
const NODE_WIDTH_SEGMENTS = 8;
const NODE_HEIGHT_SEGMENTS = 6;

// ---------------------------------------------------------------------------
// Module-scoped temporaries (avoid per-frame allocation)
// ---------------------------------------------------------------------------

const _position = new Vector3();
const _quaternion = new Quaternion();
const _scale = new Vector3(1, 1, 1);
const _matrix = new Matrix4();

// ---------------------------------------------------------------------------
// Pre-created geometry (shared across all instances)
// ---------------------------------------------------------------------------

const nodeGeometry = new SphereGeometry(NODE_RADIUS, NODE_WIDTH_SEGMENTS, NODE_HEIGHT_SEGMENTS);
const hitGeometry = new SphereGeometry(HIT_RADIUS, 6, 4);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NodeRenderer(): React.JSX.Element | null {
	const nodeCount = useMapStore(selectNodeCount);

	// Layer 2: index map (ref-based, outside React render cycle)
	const nodeIndexMapRef = useRef<Map<string, number>>(new Map());
	const meshRef = useRef<InstancedMesh>(null);
	const hitMeshRef = useRef<InstancedMesh>(null);

	// Shared material (reused across rebuilds)
	const material = useMemo(
		() =>
			new MeshBasicMaterial({
				color: NODE_COLOR,
				toneMapped: false,
			}),
		[],
	);

	// Invisible hit material
	const hitMaterial = useMemo(
		() =>
			new MeshBasicMaterial({
				visible: false,
			}),
		[],
	);

	/**
	 * Rebuild all node instance matrices from scratch.
	 * Called on mount and when node count changes (add/delete).
	 */
	const rebuildAllNodes = useCallback((): void => {
		const { nodes } = useMapStore.getState();
		const mesh = meshRef.current;
		const hitMesh = hitMeshRef.current;
		if (!mesh) return;

		const nodeList = Object.values(nodes);
		const indexMap = new Map<string, number>();

		mesh.count = nodeList.length;
		if (hitMesh) hitMesh.count = nodeList.length;

		_quaternion.identity();

		for (let i = 0; i < nodeList.length; i++) {
			const node = nodeList[i];
			indexMap.set(node.id, i);

			_position.set(node.x, node.y, node.z);
			_matrix.compose(_position, _quaternion, _scale);
			mesh.setMatrixAt(i, _matrix);
			if (hitMesh) hitMesh.setMatrixAt(i, _matrix);
		}

		nodeIndexMapRef.current = indexMap;
		mesh.instanceMatrix.needsUpdate = true;
		if (hitMesh) hitMesh.instanceMatrix.needsUpdate = true;

		// Register HIT mesh (not visual mesh) for raycasting — larger hit area
		const idList = nodeList.map((n) => n.id);
		if (hitMesh) {
			registerMesh(hitMesh.uuid, "node", idList);
		} else {
			registerMesh(mesh.uuid, "node", idList);
		}
	}, []);

	// Full rebuild when node count changes (add/delete node).
	// biome-ignore lint/correctness/useExhaustiveDependencies: nodeCount is an intentional trigger — rebuild geometry when nodes are added/removed
	useEffect(() => {
		rebuildAllNodes();
	}, [nodeCount, rebuildAllNodes]);

	/**
	 * Update node positions when rails are dirty (node moved).
	 *
	 * Since node position changes go through updateNode() which marks connected
	 * rails dirty, we peek at dirtyRailIds (without consuming — RailRenderer
	 * handles consumption). When any rail is dirty, we rebuild all node
	 * positions. With ~10k nodes this is still fast (just setMatrixAt per node,
	 * no geometry computation).
	 *
	 * Runs at priority -1 so it executes BEFORE RailRenderer (priority 0),
	 * ensuring we see the dirty set before it's consumed.
	 */
	useFrame(() => {
		const state = useMapStore.getState();
		const dragging = isDragActive();
		const hasDirty = state.dirtyRailIds.size > 0;

		if (!dragging && !hasDirty) return;

		const { nodes } = state;
		const mesh = meshRef.current;
		const hitMesh = hitMeshRef.current;
		if (!mesh) return;

		const indexMap = nodeIndexMapRef.current;
		_quaternion.identity();

		for (const [nodeId, index] of indexMap) {
			// During drag, use preview positions for dragged nodes
			if (dragging) {
				const dragPos = getDraggedPosition(nodeId);
				if (dragPos) {
					_position.set(dragPos.x, dragPos.y, dragPos.z);
					_matrix.compose(_position, _quaternion, _scale);
					mesh.setMatrixAt(index, _matrix);
					if (hitMesh) hitMesh.setMatrixAt(index, _matrix);
					continue;
				}
			}

			const node = nodes[nodeId];
			if (!node) continue;
			_position.set(node.x, node.y, node.z);
			_matrix.compose(_position, _quaternion, _scale);
			mesh.setMatrixAt(index, _matrix);
			if (hitMesh) hitMesh.setMatrixAt(index, _matrix);
		}

		mesh.instanceMatrix.needsUpdate = true;
		if (hitMesh) hitMesh.instanceMatrix.needsUpdate = true;
	}, -1);

	// Max instance count — generous upper bound for dynamic resizing
	const maxInstances = Math.max(nodeCount, 1);

	return (
		<>
			{/* Visual mesh — small spheres */}
			<instancedMesh
				ref={meshRef}
				args={[nodeGeometry, material, maxInstances]}
				frustumCulled={false}
				count={0}
			/>
			{/* Hit mesh — larger invisible spheres for easy clicking */}
			<instancedMesh
				ref={hitMeshRef}
				args={[hitGeometry, hitMaterial, maxInstances]}
				frustumCulled={false}
				count={0}
			/>
		</>
	);
}
