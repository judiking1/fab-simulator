import type { RailNode } from "@/models/rail";
import { RAIL_NODE_TYPES } from "@/models/rail";
import { useLayoutStore } from "@/stores/layoutStore";

const NODE_COLORS: Record<string, string> = {
	[RAIL_NODE_TYPES.WAYPOINT]: "#757575",
	[RAIL_NODE_TYPES.JUNCTION]: "#42a5f5",
	[RAIL_NODE_TYPES.MERGE]: "#ab47bc",
	[RAIL_NODE_TYPES.STATION]: "#ef5350",
};

function NodeSphere({ node }: { node: RailNode }) {
	const color = NODE_COLORS[node.type] ?? "#757575";
	const radius = node.type === RAIL_NODE_TYPES.STATION ? 0.3 : 0.15;

	return (
		<mesh position={[node.position.x, node.position.y + 0.1, node.position.z]}>
			<sphereGeometry args={[radius, 8, 8]} />
			<meshStandardMaterial color={color} />
		</mesh>
	);
}

export function RailNodes3D() {
	const railNodes = useLayoutStore((s) => s.railNodes);
	const entries = Object.values(railNodes);

	if (entries.length === 0) return null;

	return (
		<group name="rail-nodes">
			{entries.map((node) => (
				<NodeSphere key={node.id} node={node} />
			))}
		</group>
	);
}
