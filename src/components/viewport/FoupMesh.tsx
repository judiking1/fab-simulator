import { useMemo } from "react";
import type { Equipment } from "@/models/equipment";
import type { Foup } from "@/models/foup";
import { FOUP_LOCATIONS } from "@/models/foup";
import type { Oht } from "@/models/oht";
import type { RailEdge, RailNode } from "@/models/rail";
import type { EntityId, Vector3 } from "@/types/common";
import type { OhtSnapshot } from "@/types/simulation";

// ─── Constants ──────────────────────────────────────────────────
const FOUP_COLOR = "#b83280"; // Magenta/purple
const FOUP_SIZE: [number, number, number] = [0.2, 0.2, 0.15];

// ─── Helper: interpolate position on rail edge ──────────────────

function getPositionOnEdge(fromNode: RailNode, toNode: RailNode, ratio: number): Vector3 {
	return {
		x: fromNode.position.x + (toNode.position.x - fromNode.position.x) * ratio,
		y: fromNode.position.y + (toNode.position.y - fromNode.position.y) * ratio,
		z: fromNode.position.z + (toNode.position.z - fromNode.position.z) * ratio,
	};
}

// ─── Props ──────────────────────────────────────────────────────

interface FoupMeshProps {
	foups: Record<EntityId, Foup>;
	ohts: Record<EntityId, Oht>;
	equipment: Record<EntityId, Equipment>;
	railEdges: Record<EntityId, RailEdge>;
	railNodes: Record<EntityId, RailNode>;
	ohtPositions?: Record<EntityId, OhtSnapshot>;
}

// ─── Single FOUP box ────────────────────────────────────────────

function FoupBox({ position }: { position: [number, number, number] }): React.ReactElement {
	return (
		<mesh position={position}>
			<boxGeometry args={FOUP_SIZE} />
			<meshStandardMaterial color={FOUP_COLOR} emissive={FOUP_COLOR} emissiveIntensity={0.2} />
		</mesh>
	);
}

// ─── Main FoupMesh component ────────────────────────────────────

export function FoupMesh({
	foups,
	ohts,
	equipment,
	railEdges,
	railNodes,
	ohtPositions,
}: FoupMeshProps): React.ReactElement | null {
	const foupPositions = useMemo(() => {
		const positions: { id: EntityId; pos: [number, number, number] }[] = [];

		for (const foup of Object.values(foups)) {
			const loc = foup.location;

			if (loc.type === FOUP_LOCATIONS.ON_OHT) {
				// FOUP on an OHT: position above OHT
				const oht = ohts[loc.hostId];
				if (!oht) continue;

				const snapshot = ohtPositions?.[oht.id];
				let worldPos: Vector3 = { x: 0, y: 3, z: 0 };

				if (snapshot) {
					const edge = railEdges[snapshot.edgeId];
					if (edge) {
						const fromNode = railNodes[edge.fromNodeId];
						const toNode = railNodes[edge.toNodeId];
						if (fromNode && toNode) {
							worldPos = getPositionOnEdge(fromNode, toNode, snapshot.ratio);
						}
					}
				} else if (oht.currentEdgeId) {
					const edge = railEdges[oht.currentEdgeId];
					if (edge) {
						const fromNode = railNodes[edge.fromNodeId];
						const toNode = railNodes[edge.toNodeId];
						if (fromNode && toNode) {
							worldPos = getPositionOnEdge(fromNode, toNode, oht.edgeProgress);
						}
					}
				} else if (oht.currentNodeId) {
					const node = railNodes[oht.currentNodeId];
					if (node) {
						worldPos = node.position;
					}
				}

				// Place FOUP on top of OHT (OHT is at y+0.2, FOUP at y+0.5)
				positions.push({
					id: foup.id,
					pos: [worldPos.x, worldPos.y + 0.5, worldPos.z],
				});
			} else if (
				loc.type === FOUP_LOCATIONS.EQUIPMENT_PORT ||
				loc.type === FOUP_LOCATIONS.STORAGE_SLOT
			) {
				// FOUP at equipment: show near the equipment position
				const eq = equipment[loc.hostId];
				if (!eq) continue;

				// Find port position if available
				if (loc.slotId) {
					const port = eq.ports.find((p) => p.id === loc.slotId);
					if (port) {
						positions.push({
							id: foup.id,
							pos: [
								eq.position.x + port.position.x,
								eq.position.y + port.position.y + 0.15,
								eq.position.z + port.position.z,
							],
						});
						continue;
					}
				}

				// Fallback: slightly above equipment
				positions.push({
					id: foup.id,
					pos: [eq.position.x, eq.position.y + 1.5, eq.position.z],
				});
			}
		}

		return positions;
	}, [foups, ohts, equipment, railEdges, railNodes, ohtPositions]);

	if (foupPositions.length === 0) return null;

	return (
		<group name="foups">
			{foupPositions.map((fp) => (
				<FoupBox key={fp.id} position={fp.pos} />
			))}
		</group>
	);
}
