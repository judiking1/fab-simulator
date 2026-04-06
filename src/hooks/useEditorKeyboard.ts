/**
 * useEditorKeyboard — Global keyboard shortcuts for the map editor.
 *
 * Listens on document for keydown events. Ignores events when
 * focus is on input/textarea elements.
 */

import { useEffect } from "react";
import { ENTITY_KIND } from "@/models/editor";
import type { NodeData, PortData, RailData } from "@/models";
import type { EquipmentData } from "@/models/equipment";
import { useHistoryStore } from "@/stores/historyStore";
import { useMapStore } from "@/stores/mapStore";
import { useUiStore } from "@/stores/uiStore";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditorKeyboard(): void {
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent): void {
			// Skip if focus is in an input field
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

			const ctrl = e.ctrlKey || e.metaKey;

			// Undo: Ctrl+Z
			if (ctrl && !e.shiftKey && e.key === "z") {
				e.preventDefault();
				useHistoryStore.getState().undo();
				return;
			}

			// Redo: Ctrl+Shift+Z
			if (ctrl && e.shiftKey && e.key === "Z") {
				e.preventDefault();
				useHistoryStore.getState().redo();
				return;
			}

			// Select All: Ctrl+A
			if (ctrl && e.key === "a") {
				e.preventDefault();
				const { nodes } = useMapStore.getState();
				const nodeKind = ENTITY_KIND.NODE;
				const refs = Object.keys(nodes).map((id) => ({
					kind: nodeKind,
					id,
				}));
				useUiStore.getState().selectMultiple(refs);
				return;
			}

			// Delete: Del or Backspace
			if (e.key === "Delete" || e.key === "Backspace") {
				e.preventDefault();
				deleteSelectedEntities();
				return;
			}

			// Escape: Clear selection
			if (e.key === "Escape") {
				useUiStore.getState().clearSelection();
				return;
			}

			// Save: Ctrl+S (placeholder — Phase 5)
			if (ctrl && e.key === "s") {
				e.preventDefault();
				console.log("[editor] Save not yet implemented");
				return;
			}
		}

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);
}

// ---------------------------------------------------------------------------
// Delete logic
// ---------------------------------------------------------------------------

function deleteSelectedEntities(): void {
	const selected = useUiStore.getState().selectedEntities;
	if (selected.length === 0) return;

	const mapState = useMapStore.getState();

	// Snapshot entities for undo
	const deletedNodes: NodeData[] = [];
	const deletedRails: RailData[] = [];
	const deletedPorts: PortData[] = [];
	const deletedEquipment: EquipmentData[] = [];

	// Expand selection to include dependent entities
	const nodeIdsToDelete = new Set<string>();
	const railIdsToDelete = new Set<string>();
	const portIdsToDelete = new Set<string>();
	const equipmentIdsToDelete = new Set<string>();

	for (const ref of selected) {
		switch (ref.kind) {
			case ENTITY_KIND.NODE:
				nodeIdsToDelete.add(ref.id);
				break;
			case ENTITY_KIND.RAIL:
				railIdsToDelete.add(ref.id);
				break;
			case ENTITY_KIND.PORT:
				portIdsToDelete.add(ref.id);
				break;
			case ENTITY_KIND.EQUIPMENT:
				equipmentIdsToDelete.add(ref.id);
				break;
		}
	}

	// Cascade: nodes → connected rails → their ports/equipment
	for (const nodeId of nodeIdsToDelete) {
		const connectedRails = mapState.adjacencyMap[nodeId];
		if (connectedRails) {
			for (const railId of connectedRails) {
				railIdsToDelete.add(railId);
			}
		}
	}

	// Cascade: rails → attached ports/equipment
	for (const railId of railIdsToDelete) {
		for (const port of Object.values(mapState.ports)) {
			if (port.railId === railId) portIdsToDelete.add(port.id);
		}
		for (const eq of Object.values(mapState.equipment)) {
			if (eq.railId === railId) equipmentIdsToDelete.add(eq.id);
		}
	}

	// Cascade: equipment → owned ports
	for (const eqId of equipmentIdsToDelete) {
		const eq = mapState.equipment[eqId];
		if (eq) {
			for (const portId of eq.portIds) {
				portIdsToDelete.add(portId);
			}
		}
	}

	// Snapshot for undo
	for (const id of portIdsToDelete) {
		const p = mapState.ports[id];
		if (p) deletedPorts.push({ ...p });
	}
	for (const id of equipmentIdsToDelete) {
		const eq = mapState.equipment[id];
		if (eq) deletedEquipment.push({ ...eq, portIds: [...eq.portIds] });
	}
	for (const id of railIdsToDelete) {
		const r = mapState.rails[id];
		if (r) deletedRails.push({ ...r, curveNodeIds: [...r.curveNodeIds] });
	}
	for (const id of nodeIdsToDelete) {
		const n = mapState.nodes[id];
		if (n) deletedNodes.push({ ...n });
	}

	// Execute deletion in correct order (ports → equipment → rails → nodes)
	const doDelete = (): void => {
		const store = useMapStore.getState();
		for (const id of portIdsToDelete) store.removePort(id);
		for (const id of equipmentIdsToDelete) store.removeEquipment(id);
		for (const id of railIdsToDelete) store.removeRail(id);
		for (const id of nodeIdsToDelete) store.removeNode(id);
	};

	const doRestore = (): void => {
		const store = useMapStore.getState();
		for (const n of deletedNodes) store.addNode(n);
		for (const r of deletedRails) store.addRail(r);
		for (const eq of deletedEquipment) store.addEquipment(eq);
		for (const p of deletedPorts) store.addPort(p);
	};

	useHistoryStore.getState().push({
		label: `Delete ${selected.length} entity(s)`,
		execute: doDelete,
		undo: doRestore,
	});

	useUiStore.getState().clearSelection();
}
