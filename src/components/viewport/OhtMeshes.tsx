import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Oht, OhtState } from "@/models/oht";
import { OHT_STATES } from "@/models/oht";
import type { RailEdge, RailNode } from "@/models/rail";
import type { EntityId, Vector3 } from "@/types/common";
import type { OhtSnapshot } from "@/types/simulation";

// ─── OHT state colors ──────────────────────────────────────────
const OHT_STATE_COLORS: Record<OhtState, string> = {
	[OHT_STATES.IDLE]: "#718096",
	[OHT_STATES.MOVING_TO_LOAD]: "#48bb78",
	[OHT_STATES.LOADING]: "#ed8936",
	[OHT_STATES.MOVING_TO_UNLOAD]: "#4299e1",
	[OHT_STATES.UNLOADING]: "#9f7aea",
};

// ─── Helper: interpolate position on a rail edge ────────────────

function getPositionOnEdge(fromNode: RailNode, toNode: RailNode, ratio: number): Vector3 {
	return {
		x: fromNode.position.x + (toNode.position.x - fromNode.position.x) * ratio,
		y: fromNode.position.y + (toNode.position.y - fromNode.position.y) * ratio,
		z: fromNode.position.z + (toNode.position.z - fromNode.position.z) * ratio,
	};
}

// ─── Props ──────────────────────────────────────────────────────

interface OhtMeshesProps {
	ohts: Record<EntityId, Oht>;
	railEdges: Record<EntityId, RailEdge>;
	railNodes: Record<EntityId, RailNode>;
	/** Playback positions (optional, overrides static positions from Oht data) */
	ohtPositions?: Record<EntityId, OhtSnapshot>;
}

// ─── Reusable objects for matrix computation (avoid GC pressure) ─

const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

// ─── OHT InstancedMesh component ────────────────────────────────

export function OhtMeshes({
	ohts,
	railEdges,
	railNodes,
	ohtPositions,
}: OhtMeshesProps): React.ReactElement | null {
	const meshRef = useRef<THREE.InstancedMesh>(null);

	const ohtList = useMemo(() => Object.values(ohts), [ohts]);
	const count = ohtList.length;

	// Create geometry and material once
	const geometry = useMemo(() => new THREE.BoxGeometry(0.6, 0.3, 0.3), []);
	const material = useMemo(() => new THREE.MeshStandardMaterial(), []);

	// Update instance matrices and colors when data changes
	useEffect(() => {
		const mesh = meshRef.current;
		if (!mesh || count === 0) return;

		for (let i = 0; i < count; i++) {
			const oht = ohtList[i];
			if (!oht) continue;

			// Determine position
			let worldPos: Vector3 = { x: 0, y: 3, z: 0 };

			const snapshot = ohtPositions?.[oht.id];
			if (snapshot) {
				// Playback mode: use snapshot
				const edge = railEdges[snapshot.edgeId];
				if (edge) {
					const fromNode = railNodes[edge.fromNodeId];
					const toNode = railNodes[edge.toNodeId];
					if (fromNode && toNode) {
						worldPos = getPositionOnEdge(fromNode, toNode, snapshot.ratio);
					}
				}
			} else if (oht.currentEdgeId) {
				// Static mode: use oht's current edge + progress
				const edge = railEdges[oht.currentEdgeId];
				if (edge) {
					const fromNode = railNodes[edge.fromNodeId];
					const toNode = railNodes[edge.toNodeId];
					if (fromNode && toNode) {
						worldPos = getPositionOnEdge(fromNode, toNode, oht.edgeProgress);
					}
				}
			} else if (oht.currentNodeId) {
				// At a node
				const node = railNodes[oht.currentNodeId];
				if (node) {
					worldPos = node.position;
				}
			}

			_position.set(worldPos.x, worldPos.y + 0.2, worldPos.z);
			_matrix.compose(_position, _quaternion, _scale);
			mesh.setMatrixAt(i, _matrix);

			// Set color by state
			const stateKey = (snapshot?.state ?? oht.state) as OhtState;
			const colorHex = OHT_STATE_COLORS[stateKey] ?? OHT_STATE_COLORS[OHT_STATES.IDLE];
			_color.set(colorHex);
			mesh.setColorAt(i, _color);
		}

		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) {
			mesh.instanceColor.needsUpdate = true;
		}
	}, [ohtList, count, ohtPositions, railEdges, railNodes]);

	if (count === 0) return null;

	return (
		<group name="ohts">
			<instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} />
		</group>
	);
}
