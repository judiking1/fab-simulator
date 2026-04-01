import { useMemo } from "react";
import * as THREE from "three";
import { useLayoutStore } from "@/stores/layoutStore";

export function RailLines() {
	const railNodes = useLayoutStore((s) => s.railNodes);
	const railEdges = useLayoutStore((s) => s.railEdges);

	const lineGeometry = useMemo(() => {
		const edges = Object.values(railEdges);
		if (edges.length === 0) return null;

		const points: THREE.Vector3[] = [];

		for (const edge of edges) {
			const from = railNodes[edge.fromNodeId];
			const to = railNodes[edge.toNodeId];
			if (!from || !to) continue;

			points.push(
				new THREE.Vector3(from.position.x, from.position.y + 0.1, from.position.z),
				new THREE.Vector3(to.position.x, to.position.y + 0.1, to.position.z),
			);
		}

		if (points.length === 0) return null;

		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		return geometry;
	}, [railNodes, railEdges]);

	if (!lineGeometry) return null;

	return (
		<group name="rails">
			<lineSegments geometry={lineGeometry}>
				<lineBasicMaterial color="#616161" linewidth={2} />
			</lineSegments>
		</group>
	);
}
