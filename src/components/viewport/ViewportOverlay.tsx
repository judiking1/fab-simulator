import { useMemo } from "react";
import type { Equipment } from "@/models/equipment";
import type { Oht } from "@/models/oht";
import type { RailEdge, RailNode } from "@/models/rail";
import type { EntityId } from "@/types/common";

// ─── Props ──────────────────────────────────────────────────────

interface ViewportOverlayProps {
	/** Current simulation time in seconds (null if not playing) */
	simTime: number | null;
	/** Total OHT count */
	ohtCount: number;
	/** Active transfer count */
	activeTransferCount: number;
	/** Selected entity info */
	selectedEntity: {
		id: EntityId;
		type: string;
		name: string;
		state?: string;
	} | null;
}

// ─── Overlay component ──────────────────────────────────────────

export function ViewportOverlay({
	simTime,
	ohtCount,
	activeTransferCount,
	selectedEntity,
}: ViewportOverlayProps): React.ReactElement | null {
	const formattedTime = useMemo(() => {
		if (simTime === null) return null;
		const mins = Math.floor(simTime / 60);
		const secs = Math.floor(simTime % 60);
		return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
	}, [simTime]);

	const hasContent = simTime !== null || selectedEntity !== null;

	if (!hasContent) return null;

	return (
		<div className="pointer-events-none absolute inset-0 z-10">
			{/* Top-left: Simulation time */}
			{formattedTime !== null && (
				<div className="absolute left-3 top-3 rounded bg-black/60 px-3 py-1.5 text-sm font-mono text-white">
					SIM {formattedTime}
				</div>
			)}

			{/* Top-right: OHT and transfer counts */}
			{simTime !== null && (
				<div className="absolute right-3 top-3 rounded bg-black/60 px-3 py-1.5 text-xs text-white">
					<div>OHTs: {ohtCount}</div>
					<div>Transfers: {activeTransferCount}</div>
				</div>
			)}

			{/* Bottom-left: Selected entity info */}
			{selectedEntity && (
				<div className="absolute bottom-3 left-3 rounded bg-black/60 px-3 py-1.5 text-xs text-white">
					<div className="font-semibold">{selectedEntity.name}</div>
					<div className="text-gray-300">
						{selectedEntity.type}
						{selectedEntity.state ? ` | ${selectedEntity.state}` : ""}
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Helper hook to build selected entity info ──────────────────

interface BuildSelectedEntityParams {
	selectedEntityId: EntityId | null;
	selectedEntityType: string | null;
	equipment: Record<EntityId, Equipment>;
	ohts: Record<EntityId, Oht>;
	railNodes: Record<EntityId, RailNode>;
	railEdges: Record<EntityId, RailEdge>;
}

export function buildSelectedEntityInfo({
	selectedEntityId,
	selectedEntityType,
	equipment,
	ohts,
	railNodes,
	railEdges,
}: BuildSelectedEntityParams): ViewportOverlayProps["selectedEntity"] {
	if (!selectedEntityId || !selectedEntityType) return null;

	if (selectedEntityType === "equipment") {
		const eq = equipment[selectedEntityId];
		if (eq) {
			return { id: eq.id, type: eq.type, name: eq.name };
		}
	}

	if (selectedEntityType === "oht") {
		const oht = ohts[selectedEntityId];
		if (oht) {
			return { id: oht.id, type: "oht", name: oht.name, state: oht.state };
		}
	}

	if (selectedEntityType === "railNode") {
		const node = railNodes[selectedEntityId];
		if (node) {
			return { id: node.id, type: `node:${node.type}`, name: node.id };
		}
	}

	if (selectedEntityType === "railEdge") {
		const edge = railEdges[selectedEntityId];
		if (edge) {
			return { id: edge.id, type: `edge:${edge.lineType}`, name: edge.id };
		}
	}

	return null;
}
