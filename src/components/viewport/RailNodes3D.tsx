import { useMemo } from "react";
import type { RailNode } from "@/models/rail";
import { RAIL_NODE_TYPES } from "@/models/rail";
import { useLayoutStore } from "@/stores/layoutStore";

// ─── Node colors by type ────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
	[RAIL_NODE_TYPES.WAYPOINT]: "#ffffff",
	[RAIL_NODE_TYPES.JUNCTION]: "#ecc94b",
	[RAIL_NODE_TYPES.MERGE]: "#ed8936",
	[RAIL_NODE_TYPES.PORT]: "#76e4f7",
};

// ─── Waypoint: small white sphere ───────────────────────────────

function WaypointNode({ node }: { node: RailNode }): React.ReactElement {
	return (
		<mesh position={[node.position.x, node.position.y + 0.1, node.position.z]}>
			<sphereGeometry args={[0.1, 8, 8]} />
			<meshStandardMaterial color={NODE_COLORS[RAIL_NODE_TYPES.WAYPOINT]} />
		</mesh>
	);
}

// ─── Junction/Merge: diamond shape (rotated box) ────────────────

function DiamondNode({ node, color }: { node: RailNode; color: string }): React.ReactElement {
	return (
		<mesh
			position={[node.position.x, node.position.y + 0.1, node.position.z]}
			rotation={[0, 0, Math.PI / 4]}
		>
			<boxGeometry args={[0.2, 0.2, 0.2]} />
			<meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
		</mesh>
	);
}

// ─── Port: larger cyan sphere ───────────────────────────────────

function PortNode({ node }: { node: RailNode }): React.ReactElement {
	const color = NODE_COLORS[RAIL_NODE_TYPES.PORT] ?? "#76e4f7";
	return (
		<mesh position={[node.position.x, node.position.y + 0.1, node.position.z]}>
			<sphereGeometry args={[0.18, 12, 12]} />
			<meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
		</mesh>
	);
}

// ─── Node renderer dispatcher ───────────────────────────────────

function NodeMesh({ node }: { node: RailNode }): React.ReactElement {
	switch (node.type) {
		case RAIL_NODE_TYPES.WAYPOINT:
			return <WaypointNode node={node} />;
		case RAIL_NODE_TYPES.JUNCTION:
			return <DiamondNode node={node} color={NODE_COLORS[RAIL_NODE_TYPES.JUNCTION] ?? "#ecc94b"} />;
		case RAIL_NODE_TYPES.MERGE:
			return <DiamondNode node={node} color={NODE_COLORS[RAIL_NODE_TYPES.MERGE] ?? "#ed8936"} />;
		case RAIL_NODE_TYPES.PORT:
			return <PortNode node={node} />;
		default:
			return <WaypointNode node={node} />;
	}
}

// ─── Main RailNodes3D component ─────────────────────────────────

export function RailNodes3D(): React.ReactElement | null {
	const railNodes = useLayoutStore((s) => s.railNodes);
	const entries = useMemo(() => Object.values(railNodes), [railNodes]);

	if (entries.length === 0) return null;

	return (
		<group name="rail-nodes">
			{entries.map((node) => (
				<NodeMesh key={node.id} node={node} />
			))}
		</group>
	);
}
