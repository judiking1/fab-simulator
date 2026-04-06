/**
 * SelectionOverlay — Renders highlights around selected entities.
 *
 * Node: slightly larger wireframe sphere (matches node size)
 * Rail: highlight both endpoint nodes with rings
 * Equipment: wireframe box matching actual equipment scale
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
	Color,
	type InstancedMesh,
	Matrix4,
	MeshBasicMaterial,
	Quaternion,
	RingGeometry,
	Vector3,
} from "three";
import { ENTITY_KIND } from "@/models/editor";
import { EQUIPMENT_TYPE } from "@/models/port";
import { useMapStore } from "@/stores/mapStore";
import { useUiStore } from "@/stores/uiStore";
import { getDraggedPosition, isDragActive as checkDragActive } from "@/systems/dragPreview";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIGHLIGHT_COLOR = new Color("#38bdf8");
const MAX_HIGHLIGHTS = 2000;

// Node highlight: ring slightly larger than the node sphere (radius 0.15)
const NODE_RING_INNER = 0.18;
const NODE_RING_OUTER = 0.35;

// Module-scoped temporaries
const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _matrix = new Matrix4();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SelectionOverlay(): React.JSX.Element {
	const ringMeshRef = useRef<InstancedMesh>(null);

	// Ring geometry lies flat on XZ plane — visible from above
	const ringGeometry = useMemo(() => {
		const geo = new RingGeometry(NODE_RING_INNER, NODE_RING_OUTER, 16);
		geo.rotateX(-Math.PI / 2); // Make it horizontal
		return geo;
	}, []);

	const material = useMemo(
		() =>
			new MeshBasicMaterial({
				color: HIGHLIGHT_COLOR,
				toneMapped: false,
				transparent: true,
				opacity: 0.9,
				depthTest: false,
			}),
		[],
	);

	useFrame(() => {
		const { selectedEntities } = useUiStore.getState();

		// Always update — selection overlay cost is negligible for small selection counts
		// This fixes: undo not updating overlay, drag preview not reflecting, etc.

		const ringMesh = ringMeshRef.current;
		if (!ringMesh) return;

		if (selectedEntities.length === 0) {
			ringMesh.count = 0;
			ringMesh.instanceMatrix.needsUpdate = true;
			return;
		}

		const { nodes, rails, equipment } = useMapStore.getState();
		let ringIdx = 0;
		_quat.identity();

		// Collect all node IDs that should be highlighted
		const highlightNodeIds = new Set<string>();

		for (const ref of selectedEntities) {
			switch (ref.kind) {
				case ENTITY_KIND.NODE: {
					highlightNodeIds.add(ref.id);
					break;
				}

				case ENTITY_KIND.RAIL: {
					// Highlight both endpoint nodes of the rail
					const rail = rails[ref.id];
					if (rail) {
						highlightNodeIds.add(rail.fromNodeId);
						highlightNodeIds.add(rail.toNodeId);
					}
					break;
				}

				case ENTITY_KIND.EQUIPMENT: {
					// Highlight with a ring at equipment position on rail
					const eq = equipment[ref.id];
					if (!eq) break;
					const rail = rails[eq.railId];
					if (!rail) break;
					const fn = nodes[rail.fromNodeId];
					const tn = nodes[rail.toNodeId];
					if (!fn || !tn) break;

					// Equipment midpoint on rail (approximate with linear interp for ring)
					_pos.set(
						fn.x + (tn.x - fn.x) * eq.ratio,
						fn.y + (tn.y - fn.y) * eq.ratio + 0.05,
						fn.z + (tn.z - fn.z) * eq.ratio,
					);

					// Scale ring based on equipment type
					const ringScale = eq.category === EQUIPMENT_TYPE.EQ ? 2.0
						: eq.category === EQUIPMENT_TYPE.STK ? 1.8
						: 1.2; // OHB
					_scale.set(ringScale, ringScale, ringScale);
					_matrix.compose(_pos, _quat, _scale);
					ringMesh.setMatrixAt(ringIdx++, _matrix);
					break;
				}

				case ENTITY_KIND.PORT: {
					// Highlight port's parent rail nodes
					const port = useMapStore.getState().ports[ref.id];
					if (port) {
						const rail = rails[port.railId];
						if (rail) {
							highlightNodeIds.add(rail.fromNodeId);
							highlightNodeIds.add(rail.toNodeId);
						}
					}
					break;
				}
			}
		}

		// Render rings at all highlighted node positions
		for (const nodeId of highlightNodeIds) {
			// Use drag preview position if dragging
			const dragPos = checkDragActive() ? getDraggedPosition(nodeId) : null;
			const node = dragPos ?? nodes[nodeId];
			if (!node) continue;
			_pos.set(node.x, node.y + 0.05, node.z); // Slightly above ground
			_scale.set(1, 1, 1);
			_matrix.compose(_pos, _quat, _scale);
			ringMesh.setMatrixAt(ringIdx++, _matrix);
		}

		ringMesh.count = ringIdx;
		ringMesh.instanceMatrix.needsUpdate = true;
	});

	return (
		<instancedMesh
			ref={ringMeshRef}
			args={[ringGeometry, material, MAX_HIGHLIGHTS]}
			frustumCulled={false}
			renderOrder={999}
			count={0}
		/>
	);
}
