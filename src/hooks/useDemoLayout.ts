import { useEffect, useRef } from "react";
import { useLayoutStore } from "@/stores/layoutStore";

/** Seeds the LayoutStore with a small demo layout on first mount */
export function useDemoLayout(): void {
	const initialized = useRef(false);

	useEffect(() => {
		if (initialized.current) return;
		initialized.current = true;

		const state = useLayoutStore.getState();
		// Only seed if empty
		if (Object.keys(state.fabs).length > 0) return;

		// ── Create a small demo fab ──────────────────────────────
		const fabId = state.addFab("FAB-A", { x: 0, y: 0, z: 0 });
		const bayId = state.addBay(fabId, "Bay-1", { x: 0, y: 0, z: 0 });
		const areaId = state.addArea(bayId, "Photo Area", { x: 0, y: 0, z: 0 });
		const modId = state.addModule(areaId, "Module-1", { x: 0, y: 0, z: 0 });

		// Equipment
		state.addEquipment(modId, "process", "Litho-01", { x: 0, y: 0, z: 0 });
		state.addEquipment(modId, "process", "Litho-02", { x: 5, y: 0, z: 0 });
		state.addEquipment(modId, "process", "Etch-01", { x: 10, y: 0, z: 0 });
		state.addEquipment(modId, "stocker", "STK-01", { x: -5, y: 0, z: 5 });
		state.addEquipment(modId, "ohb", "OHB-01", { x: 2.5, y: 3, z: -3 });

		// Rail network — simple linear path
		const n1 = state.addRailNode(fabId, "station", { x: -5, y: 3, z: 5 });
		const n2 = state.addRailNode(fabId, "waypoint", { x: 0, y: 3, z: -3 });
		const n3 = state.addRailNode(fabId, "junction", { x: 5, y: 3, z: -3 });
		const n4 = state.addRailNode(fabId, "station", { x: 10, y: 3, z: -3 });
		const n5 = state.addRailNode(fabId, "waypoint", { x: 10, y: 3, z: 5 });
		const n6 = state.addRailNode(fabId, "station", { x: -5, y: 3, z: -3 });

		// Edges (directed loop)
		state.addRailEdge(fabId, n6, n2);
		state.addRailEdge(fabId, n2, n3);
		state.addRailEdge(fabId, n3, n4);
		state.addRailEdge(fabId, n4, n5);
		state.addRailEdge(fabId, n5, n1);
		state.addRailEdge(fabId, n1, n6);
	}, []);
}
