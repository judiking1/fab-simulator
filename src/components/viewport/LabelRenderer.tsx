/**
 * LabelRenderer — Displays Node and Rail ID labels using VOS TextAtlas system.
 *
 * Architecture:
 *   - TextAtlas: Canvas 2D texture atlas (cellW×cellH per label)
 *   - InstancedMesh: GPU billboard quads with per-instance UV/alpha/color
 *   - Camera distance culling: only allocates cells for nearby entities
 *   - Throttled GPU upload (300ms) to minimize texSubImage2D calls
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
	Color,
	type InstancedMesh,
	InstancedBufferAttribute,
	Matrix4,
	Vector3,
} from "three";
import { selectNodeCount, selectRailCount, useMapStore } from "@/stores/mapStore";
import { TextAtlas } from "@/utils/text/TextAtlas";
import {
	createAtlasTextGeometry,
	createAtlasTextMaterial,
} from "@/utils/text/atlasTextMaterial";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max camera distance to show labels */
const LABEL_DISTANCE = 25;
const LABEL_DISTANCE_SQ = LABEL_DISTANCE * LABEL_DISTANCE;

/** Max visible labels at once */
const MAX_LABELS = 500;

/** Label quad height in world units */
const DISPLAY_HEIGHT = 0.35;

/** Y offset above entity */
const NODE_Y_OFFSET = 0.35;
const RAIL_Y_OFFSET = 0.2;

const NODE_COLOR = new Color("#9ca3af");
const RAIL_COLOR = new Color("#60a5fa");

// ---------------------------------------------------------------------------
// Module-scoped temporaries
// ---------------------------------------------------------------------------

const _camPos = new Vector3();
const _entityPos = new Vector3();
const _matrix = new Matrix4();
const _identityQuat = { x: 0, y: 0, z: 0, w: 1 };
const _unitScale = new Vector3(1, 1, 1);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabelRenderer(): React.JSX.Element | null {
	const nodeCount = useMapStore(selectNodeCount);
	const railCount = useMapStore(selectRailCount);
	const camera = useThree((s) => s.camera);
	const meshRef = useRef<InstancedMesh>(null);

	// Create atlas and material (memoized, survives re-renders)
	const atlas = useMemo(
		() =>
			new TextAtlas({
				atlasW: 2048,
				atlasH: 2048,
				cellW: 128,
				cellH: 32,
				font: "bold 20px monospace",
				fontSize: 20,
				fillColor: "#ffffff",
				strokeColor: "#000000",
				strokeWidth: 2,
			}),
		[],
	);

	const material = useMemo(
		() => createAtlasTextMaterial(atlas.texture),
		[atlas],
	);

	const geometry = useMemo(() => {
		const cellAspect = atlas.config.cellW / atlas.config.cellH;
		return createAtlasTextGeometry(DISPLAY_HEIGHT, cellAspect);
	}, [atlas]);

	// Per-instance attributes
	const attrRefs = useRef<{
		uvAttr: InstancedBufferAttribute;
		alphaAttr: InstancedBufferAttribute;
		colorAttr: InstancedBufferAttribute;
	} | null>(null);

	// Initialize instance attributes when mesh is ready
	// biome-ignore lint/correctness/useExhaustiveDependencies: nodeCount+railCount trigger rebuild
	useEffect(() => {
		const mesh = meshRef.current;
		if (!mesh) return;

		const uvData = new Float32Array(MAX_LABELS * 4);
		const alphaData = new Float32Array(MAX_LABELS);
		const colorData = new Float32Array(MAX_LABELS * 3);

		const uvAttr = new InstancedBufferAttribute(uvData, 4);
		const alphaAttr = new InstancedBufferAttribute(alphaData, 1);
		const colorAttr = new InstancedBufferAttribute(colorData, 3);

		mesh.geometry.setAttribute("aAtlasUV", uvAttr);
		mesh.geometry.setAttribute("aAlpha", alphaAttr);
		mesh.geometry.setAttribute("aColor", colorAttr);

		mesh.count = 0;
		attrRefs.current = { uvAttr, alphaAttr, colorAttr };
	}, [nodeCount, railCount]);

	// Cleanup
	useEffect(() => {
		return () => {
			atlas.dispose();
			material.dispose();
			geometry.dispose();
		};
	}, [atlas, material, geometry]);

	// Per-frame update
	useFrame(() => {
		const mesh = meshRef.current;
		const attrs = attrRefs.current;
		if (!mesh || !attrs) return;

		const { nodes, rails } = useMapStore.getState();
		_camPos.copy(camera.position);

		let count = 0;

		// Collect nearby nodes
		for (const node of Object.values(nodes)) {
			if (count >= MAX_LABELS) break;

			_entityPos.set(node.x, node.y, node.z);
			const distSq = _camPos.distanceToSquared(_entityPos);
			if (distSq > LABEL_DISTANCE_SQ) continue;

			const cellIdx = atlas.getOrAllocate(node.id, node.id);
			const [u0, v0, u1, v1] = atlas.getCellUV(cellIdx);

			// Position (billboard handled by vertex shader — just set translation)
			_entityPos.y += NODE_Y_OFFSET;
			_matrix.compose(_entityPos, _identityQuat as never, _unitScale);
			mesh.setMatrixAt(count, _matrix);

			// UV
			const o4 = count * 4;
			attrs.uvAttr.array[o4] = u0;
			attrs.uvAttr.array[o4 + 1] = v0;
			attrs.uvAttr.array[o4 + 2] = u1;
			attrs.uvAttr.array[o4 + 3] = v1;

			// Alpha (fade with distance)
			const fade = 1.0 - distSq / LABEL_DISTANCE_SQ;
			(attrs.alphaAttr.array as Float32Array)[count] = Math.min(1.0, fade * 2);

			// Color
			const o3 = count * 3;
			attrs.colorAttr.array[o3] = NODE_COLOR.r;
			attrs.colorAttr.array[o3 + 1] = NODE_COLOR.g;
			attrs.colorAttr.array[o3 + 2] = NODE_COLOR.b;

			count++;
		}

		// Collect nearby rails
		for (const rail of Object.values(rails)) {
			if (count >= MAX_LABELS) break;

			const fromNode = nodes[rail.fromNodeId];
			const toNode = nodes[rail.toNodeId];
			if (!fromNode || !toNode) continue;

			_entityPos.set(
				(fromNode.x + toNode.x) / 2,
				(fromNode.y + toNode.y) / 2,
				(fromNode.z + toNode.z) / 2,
			);
			const distSq = _camPos.distanceToSquared(_entityPos);
			if (distSq > LABEL_DISTANCE_SQ) continue;

			const cellIdx = atlas.getOrAllocate(rail.id, rail.id);
			const [u0, v0, u1, v1] = atlas.getCellUV(cellIdx);

			_entityPos.y += RAIL_Y_OFFSET;
			_matrix.compose(_entityPos, _identityQuat as never, _unitScale);
			mesh.setMatrixAt(count, _matrix);

			const o4 = count * 4;
			attrs.uvAttr.array[o4] = u0;
			attrs.uvAttr.array[o4 + 1] = v0;
			attrs.uvAttr.array[o4 + 2] = u1;
			attrs.uvAttr.array[o4 + 3] = v1;

			const fade = 1.0 - distSq / LABEL_DISTANCE_SQ;
			(attrs.alphaAttr.array as Float32Array)[count] = Math.min(1.0, fade * 2);

			const o3 = count * 3;
			attrs.colorAttr.array[o3] = RAIL_COLOR.r;
			attrs.colorAttr.array[o3 + 1] = RAIL_COLOR.g;
			attrs.colorAttr.array[o3 + 2] = RAIL_COLOR.b;

			count++;
		}

		mesh.count = count;
		mesh.instanceMatrix.needsUpdate = true;
		attrs.uvAttr.needsUpdate = true;
		attrs.alphaAttr.needsUpdate = true;
		attrs.colorAttr.needsUpdate = true;

		// Throttled GPU texture upload
		atlas.flushThrottled(300);
	});

	return (
		<instancedMesh
			ref={meshRef}
			args={[geometry, material, MAX_LABELS]}
			frustumCulled={false}
			renderOrder={999}
		/>
	);
}
