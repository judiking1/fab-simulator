import { Line } from "@react-three/drei";
import { useMemo } from "react";
import type { RailEdge, RailLineType } from "@/models/rail";
import { RAIL_LINE_TYPES } from "@/models/rail";
import { useLayoutStore } from "@/stores/layoutStore";
import type { EntityId } from "@/types/common";

// ─── Color by lineType ──────────────────────────────────────────
const LINE_TYPE_COLORS: Record<RailLineType, string> = {
	[RAIL_LINE_TYPES.STRAIGHT]: "#4a5568",
	[RAIL_LINE_TYPES.CURVE]: "#3182ce",
	[RAIL_LINE_TYPES.S_CURVE]: "#805ad5",
	[RAIL_LINE_TYPES.U_TURN]: "#dd6b20",
};

const SELECTED_COLOR = "#00e5ff";

// ─── Diamond marker for confluence/branch points ────────────────

function DiamondMarker({
	position,
	color,
}: {
	position: [number, number, number];
	color: string;
}): React.ReactElement {
	return (
		<mesh position={position} rotation={[0, 0, Math.PI / 4]}>
			<boxGeometry args={[0.25, 0.25, 0.25]} />
			<meshStandardMaterial color={color} />
		</mesh>
	);
}

// ─── Single rail edge line ──────────────────────────────────────

interface RailEdgeLineProps {
	edge: RailEdge;
	fromPos: [number, number, number];
	toPos: [number, number, number];
	isSelected: boolean;
}

function RailEdgeLine({ edge, fromPos, toPos, isSelected }: RailEdgeLineProps): React.ReactElement {
	const select = useLayoutStore((s) => s.select);

	const color = isSelected ? SELECTED_COLOR : LINE_TYPE_COLORS[edge.lineType];
	const lineWidth = isSelected ? 5 : 3;
	const opacity = edge.enabled ? 1 : 0.3;

	return (
		<Line
			points={[fromPos, toPos]}
			color={color}
			lineWidth={lineWidth}
			transparent={!edge.enabled}
			opacity={opacity}
			dashed={!edge.enabled}
			dashSize={0.3}
			dashScale={1}
			gapSize={0.2}
			onClick={(e) => {
				e.stopPropagation();
				select(edge.id, "railEdge");
			}}
		/>
	);
}

// ─── Main RailLines component ───────────────────────────────────

export function RailLines(): React.ReactElement | null {
	const railNodes = useLayoutStore((s) => s.railNodes);
	const railEdges = useLayoutStore((s) => s.railEdges);
	const selectedId = useLayoutStore((s) => s.selectedEntityId);

	const edges = useMemo(() => Object.values(railEdges), [railEdges]);

	// Collect confluence/branch marker positions
	const markers = useMemo(() => {
		const result: { position: [number, number, number]; color: string; id: EntityId }[] = [];

		for (const edge of edges) {
			if (edge.isBranch) {
				const fromNode = railNodes[edge.fromNodeId];
				if (fromNode) {
					result.push({
						position: [fromNode.position.x, fromNode.position.y + 0.1, fromNode.position.z],
						color: "#ecc94b",
						id: `branch-${edge.id}`,
					});
				}
			}
			if (edge.isConfluence) {
				const toNode = railNodes[edge.toNodeId];
				if (toNode) {
					result.push({
						position: [toNode.position.x, toNode.position.y + 0.1, toNode.position.z],
						color: "#ed8936",
						id: `conf-${edge.id}`,
					});
				}
			}
		}
		return result;
	}, [edges, railNodes]);

	if (edges.length === 0) return null;

	return (
		<group name="rails">
			{edges.map((edge) => {
				const from = railNodes[edge.fromNodeId];
				const to = railNodes[edge.toNodeId];
				if (!from || !to) return null;

				const fromPos: [number, number, number] = [
					from.position.x,
					from.position.y + 0.1,
					from.position.z,
				];
				const toPos: [number, number, number] = [to.position.x, to.position.y + 0.1, to.position.z];

				return (
					<RailEdgeLine
						key={edge.id}
						edge={edge}
						fromPos={fromPos}
						toPos={toPos}
						isSelected={selectedId === edge.id}
					/>
				);
			})}
			{markers.map((m) => (
				<DiamondMarker key={m.id} position={m.position} color={m.color} />
			))}
		</group>
	);
}
