import { beforeEach, describe, expect, it } from "vitest";
import { useLayoutStore } from "@/stores/layoutStore";

describe("LayoutStore", () => {
	beforeEach(() => {
		useLayoutStore.getState().clear();
	});

	// ── Fab CRUD ─────────────────────────────────────────────────

	it("adds and retrieves a fab", () => {
		const id = useLayoutStore.getState().addFab("TestFab");
		const fab = useLayoutStore.getState().fabs[id];

		expect(fab).toBeDefined();
		expect(fab?.name).toBe("TestFab");
		expect(id).toMatch(/^FAB-/);
	});

	it("removes a fab and cascades to children", () => {
		const state = useLayoutStore.getState();
		const fabId = state.addFab("F1");
		const bayId = state.addBay(fabId, "B1");
		const areaId = state.addArea(bayId, "A1");
		const modId = state.addModule(areaId, "M1");
		state.addEquipment(modId, "process", "EQ1");

		useLayoutStore.getState().removeFab(fabId);

		const s = useLayoutStore.getState();
		expect(Object.keys(s.fabs)).toHaveLength(0);
		expect(Object.keys(s.bays)).toHaveLength(0);
		expect(Object.keys(s.areas)).toHaveLength(0);
		expect(Object.keys(s.modules)).toHaveLength(0);
		expect(Object.keys(s.equipment)).toHaveLength(0);
	});

	it("updates a fab", () => {
		const id = useLayoutStore.getState().addFab("Old");
		useLayoutStore.getState().updateFab(id, { name: "New" });

		expect(useLayoutStore.getState().fabs[id]?.name).toBe("New");
	});

	// ── Hierarchy ────────────────────────────────────────────────

	it("builds correct parent-child hierarchy", () => {
		const state = useLayoutStore.getState();
		const fabId = state.addFab("F1");
		const bay1 = state.addBay(fabId, "B1");
		const bay2 = state.addBay(fabId, "B2");

		const children = useLayoutStore.getState().fabBays[fabId];
		expect(children).toContain(bay1);
		expect(children).toContain(bay2);
		expect(children).toHaveLength(2);
	});

	// ── Equipment ────────────────────────────────────────────────

	it("adds equipment with correct type", () => {
		const state = useLayoutStore.getState();
		const fabId = state.addFab("F1");
		const bayId = state.addBay(fabId, "B1");
		const areaId = state.addArea(bayId, "A1");
		const modId = state.addModule(areaId, "M1");
		const eqId = state.addEquipment(modId, "stocker", "STK1");

		const eq = useLayoutStore.getState().equipment[eqId];
		expect(eq?.type).toBe("stocker");
		expect(eq?.name).toBe("STK1");
	});

	it("removes equipment from parent children list", () => {
		const state = useLayoutStore.getState();
		const fabId = state.addFab("F1");
		const bayId = state.addBay(fabId, "B1");
		const areaId = state.addArea(bayId, "A1");
		const modId = state.addModule(areaId, "M1");
		const eqId = state.addEquipment(modId, "process", "EQ1");

		useLayoutStore.getState().removeEquipment(eqId);

		expect(useLayoutStore.getState().equipment[eqId]).toBeUndefined();
		expect(useLayoutStore.getState().moduleEquipment[modId]).toHaveLength(0);
	});

	// ── Rail ─────────────────────────────────────────────────────

	it("adds rail nodes and edges", () => {
		const state = useLayoutStore.getState();
		const fabId = state.addFab("F1");
		const n1 = state.addRailNode(fabId, "station", { x: 0, y: 0, z: 0 });
		const n2 = state.addRailNode(fabId, "waypoint", { x: 10, y: 0, z: 0 });
		const edgeId = state.addRailEdge(fabId, n1, n2);

		const edge = useLayoutStore.getState().railEdges[edgeId];
		expect(edge).toBeDefined();
		expect(edge?.fromNodeId).toBe(n1);
		expect(edge?.toNodeId).toBe(n2);
		expect(edge?.distance).toBeCloseTo(10, 1);
	});

	it("removes rail node and cascades edge removal", () => {
		const state = useLayoutStore.getState();
		const fabId = state.addFab("F1");
		const n1 = state.addRailNode(fabId, "station", { x: 0, y: 0, z: 0 });
		const n2 = state.addRailNode(fabId, "waypoint", { x: 10, y: 0, z: 0 });
		state.addRailEdge(fabId, n1, n2);

		useLayoutStore.getState().removeRailNode(n1);

		expect(Object.keys(useLayoutStore.getState().railEdges)).toHaveLength(0);
		expect(useLayoutStore.getState().railNodes[n1]).toBeUndefined();
	});

	// ── Selection ────────────────────────────────────────────────

	it("selects and clears selection", () => {
		useLayoutStore.getState().select("EQ-123", "equipment");
		expect(useLayoutStore.getState().selectedEntityId).toBe("EQ-123");
		expect(useLayoutStore.getState().selectedEntityType).toBe("equipment");

		useLayoutStore.getState().clearSelection();
		expect(useLayoutStore.getState().selectedEntityId).toBeNull();
	});

	// ── Load/Clear ───────────────────────────────────────────────

	it("clears all entities", () => {
		const state = useLayoutStore.getState();
		state.addFab("F1");
		state.clear();

		expect(Object.keys(useLayoutStore.getState().fabs)).toHaveLength(0);
	});
});
