import { create } from "zustand";
import type { Equipment, EquipmentType } from "@/models/equipment";
import type { Foup } from "@/models/foup";
import type { Area, Bay, Fab, Module } from "@/models/layout";
import type { RailEdge, RailNode, RailNodeType } from "@/models/rail";
import type { EntityId, Vector3 } from "@/types/common";
import { createEntityId } from "@/types/common";

// ─── Normalized Entity Maps ──────────────────────────────────────

interface LayoutEntities {
	fabs: Record<EntityId, Fab>;
	bays: Record<EntityId, Bay>;
	areas: Record<EntityId, Area>;
	modules: Record<EntityId, Module>;
	equipment: Record<EntityId, Equipment>;
	railNodes: Record<EntityId, RailNode>;
	railEdges: Record<EntityId, RailEdge>;
	foups: Record<EntityId, Foup>;
}

// ─── Children Maps (hierarchy) ───────────────────────────────────
// parentId → childId[]

interface LayoutChildren {
	fabBays: Record<EntityId, EntityId[]>;
	bayAreas: Record<EntityId, EntityId[]>;
	areaModules: Record<EntityId, EntityId[]>;
	moduleEquipment: Record<EntityId, EntityId[]>;
}

// ─── Selection State ─────────────────────────────────────────────

interface SelectionState {
	selectedEntityId: EntityId | null;
	selectedEntityType: string | null;
}

// ─── Store Interface ─────────────────────────────────────────────

interface LayoutState extends LayoutEntities, LayoutChildren, SelectionState {
	// Fab CRUD
	addFab: (name: string, position?: Vector3) => EntityId;
	removeFab: (id: EntityId) => void;
	updateFab: (id: EntityId, updates: Partial<Omit<Fab, "id">>) => void;

	// Bay CRUD
	addBay: (fabId: EntityId, name: string, position?: Vector3) => EntityId;
	removeBay: (id: EntityId) => void;
	updateBay: (id: EntityId, updates: Partial<Omit<Bay, "id" | "fabId">>) => void;

	// Area CRUD
	addArea: (bayId: EntityId, name: string, position?: Vector3) => EntityId;
	removeArea: (id: EntityId) => void;
	updateArea: (id: EntityId, updates: Partial<Omit<Area, "id" | "bayId">>) => void;

	// Module CRUD
	addModule: (areaId: EntityId, name: string, position?: Vector3) => EntityId;
	removeModule: (id: EntityId) => void;
	updateModule: (id: EntityId, updates: Partial<Omit<Module, "id" | "areaId">>) => void;

	// Equipment CRUD
	addEquipment: (
		moduleId: EntityId,
		type: EquipmentType,
		name: string,
		position?: Vector3,
	) => EntityId;
	removeEquipment: (id: EntityId) => void;
	updateEquipment: (
		id: EntityId,
		updates: Partial<Omit<Equipment, "id" | "moduleId" | "type">>,
	) => void;

	// Rail CRUD
	addRailNode: (fabId: EntityId, type: RailNodeType, position: Vector3) => EntityId;
	removeRailNode: (id: EntityId) => void;
	addRailEdge: (
		fabId: EntityId,
		fromNodeId: EntityId,
		toNodeId: EntityId,
		maxSpeed?: number,
	) => EntityId;
	removeRailEdge: (id: EntityId) => void;

	// Selection
	select: (entityId: EntityId, entityType: string) => void;
	clearSelection: () => void;

	// Bulk operations
	clear: () => void;
	loadEntities: (data: { entities: LayoutEntities; children: LayoutChildren }) => void;
}

// ─── Defaults ────────────────────────────────────────────────────

const ZERO_VEC: Vector3 = { x: 0, y: 0, z: 0 };
const ZERO_ROT = { x: 0, y: 0, z: 0 };

function emptyEntities(): LayoutEntities {
	return {
		fabs: {},
		bays: {},
		areas: {},
		modules: {},
		equipment: {},
		railNodes: {},
		railEdges: {},
		foups: {},
	};
}

function emptyChildren(): LayoutChildren {
	return {
		fabBays: {},
		bayAreas: {},
		areaModules: {},
		moduleEquipment: {},
	};
}

function computeEdgeDistance(from: Vector3, to: Vector3): number {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const dz = to.z - from.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ─── Helper: remove ID from parent's children array ─────────────

function removeChild(
	childrenMap: Record<EntityId, EntityId[]>,
	parentId: EntityId,
	childId: EntityId,
): void {
	const siblings = childrenMap[parentId];
	if (!siblings) return;
	const idx = siblings.indexOf(childId);
	if (idx !== -1) {
		siblings.splice(idx, 1);
	}
}

// ─── Default equipment factory ───────────────────────────────────

function createDefaultEquipment(
	id: EntityId,
	moduleId: EntityId,
	type: EquipmentType,
	name: string,
	position: Vector3,
): Equipment {
	const base = { id, moduleId, name, position, ports: [] };
	switch (type) {
		case "process":
			return { ...base, type: "process", processTime: 60 };
		case "stocker":
			return { ...base, type: "stocker", slots: [], capacity: 20 };
		case "ohb":
			return { ...base, type: "ohb", railNodeId: "", slots: [], capacity: 2 };
	}
}

// ─── Store ───────────────────────────────────────────────────────

export const useLayoutStore = create<LayoutState>((set, get) => ({
	...emptyEntities(),
	...emptyChildren(),
	selectedEntityId: null,
	selectedEntityType: null,

	// ── Fab ──────────────────────────────────────────────────────
	addFab: (name, position = ZERO_VEC) => {
		const id = createEntityId("FAB");
		set((s) => ({
			fabs: { ...s.fabs, [id]: { id, name, position, rotation: ZERO_ROT } },
			fabBays: { ...s.fabBays, [id]: [] },
		}));
		return id;
	},
	removeFab: (id) => {
		const state = get();
		const bayIds = state.fabBays[id] ?? [];
		// Cascade: remove all children
		for (const bayId of bayIds) {
			state.removeBay(bayId);
		}
		set((s) => {
			const { [id]: _, ...restFabs } = s.fabs;
			const { [id]: __, ...restFabBays } = s.fabBays;
			return { fabs: restFabs, fabBays: restFabBays };
		});
	},
	updateFab: (id, updates) => {
		set((s) => {
			const existing = s.fabs[id];
			if (!existing) return s;
			return { fabs: { ...s.fabs, [id]: { ...existing, ...updates } } };
		});
	},

	// ── Bay ──────────────────────────────────────────────────────
	addBay: (fabId, name, position = ZERO_VEC) => {
		const id = createEntityId("BAY");
		set((s) => ({
			bays: { ...s.bays, [id]: { id, fabId, name, position, rotation: ZERO_ROT } },
			fabBays: { ...s.fabBays, [fabId]: [...(s.fabBays[fabId] ?? []), id] },
			bayAreas: { ...s.bayAreas, [id]: [] },
		}));
		return id;
	},
	removeBay: (id) => {
		const state = get();
		const bay = state.bays[id];
		if (!bay) return;
		const areaIds = state.bayAreas[id] ?? [];
		for (const areaId of areaIds) {
			state.removeArea(areaId);
		}
		set((s) => {
			const { [id]: _, ...restBays } = s.bays;
			const { [id]: __, ...restBayAreas } = s.bayAreas;
			const newFabBays = { ...s.fabBays };
			removeChild(newFabBays, bay.fabId, id);
			return { bays: restBays, bayAreas: restBayAreas, fabBays: newFabBays };
		});
	},
	updateBay: (id, updates) => {
		set((s) => {
			const existing = s.bays[id];
			if (!existing) return s;
			return { bays: { ...s.bays, [id]: { ...existing, ...updates } } };
		});
	},

	// ── Area ─────────────────────────────────────────────────────
	addArea: (bayId, name, position = ZERO_VEC) => {
		const id = createEntityId("AREA");
		set((s) => ({
			areas: { ...s.areas, [id]: { id, bayId, name, position } },
			bayAreas: { ...s.bayAreas, [bayId]: [...(s.bayAreas[bayId] ?? []), id] },
			areaModules: { ...s.areaModules, [id]: [] },
		}));
		return id;
	},
	removeArea: (id) => {
		const state = get();
		const area = state.areas[id];
		if (!area) return;
		const moduleIds = state.areaModules[id] ?? [];
		for (const moduleId of moduleIds) {
			state.removeModule(moduleId);
		}
		set((s) => {
			const { [id]: _, ...restAreas } = s.areas;
			const { [id]: __, ...restAreaModules } = s.areaModules;
			const newBayAreas = { ...s.bayAreas };
			removeChild(newBayAreas, area.bayId, id);
			return { areas: restAreas, areaModules: restAreaModules, bayAreas: newBayAreas };
		});
	},
	updateArea: (id, updates) => {
		set((s) => {
			const existing = s.areas[id];
			if (!existing) return s;
			return { areas: { ...s.areas, [id]: { ...existing, ...updates } } };
		});
	},

	// ── Module ───────────────────────────────────────────────────
	addModule: (areaId, name, position = ZERO_VEC) => {
		const id = createEntityId("MOD");
		set((s) => ({
			modules: { ...s.modules, [id]: { id, areaId, name, position } },
			areaModules: { ...s.areaModules, [areaId]: [...(s.areaModules[areaId] ?? []), id] },
			moduleEquipment: { ...s.moduleEquipment, [id]: [] },
		}));
		return id;
	},
	removeModule: (id) => {
		const state = get();
		const mod = state.modules[id];
		if (!mod) return;
		const eqIds = state.moduleEquipment[id] ?? [];
		for (const eqId of eqIds) {
			state.removeEquipment(eqId);
		}
		set((s) => {
			const { [id]: _, ...restModules } = s.modules;
			const { [id]: __, ...restModEq } = s.moduleEquipment;
			const newAreaModules = { ...s.areaModules };
			removeChild(newAreaModules, mod.areaId, id);
			return { modules: restModules, moduleEquipment: restModEq, areaModules: newAreaModules };
		});
	},
	updateModule: (id, updates) => {
		set((s) => {
			const existing = s.modules[id];
			if (!existing) return s;
			return { modules: { ...s.modules, [id]: { ...existing, ...updates } } };
		});
	},

	// ── Equipment ────────────────────────────────────────────────
	addEquipment: (moduleId, type, name, position = ZERO_VEC) => {
		const id = createEntityId("EQ");
		const eq = createDefaultEquipment(id, moduleId, type, name, position);
		set((s) => ({
			equipment: { ...s.equipment, [id]: eq },
			moduleEquipment: {
				...s.moduleEquipment,
				[moduleId]: [...(s.moduleEquipment[moduleId] ?? []), id],
			},
		}));
		return id;
	},
	removeEquipment: (id) => {
		const state = get();
		const eq = state.equipment[id];
		if (!eq) return;
		set((s) => {
			const { [id]: _, ...restEq } = s.equipment;
			const newModEq = { ...s.moduleEquipment };
			removeChild(newModEq, eq.moduleId, id);
			return { equipment: restEq, moduleEquipment: newModEq };
		});
	},
	updateEquipment: (id, updates) => {
		set((s) => {
			const existing = s.equipment[id];
			if (!existing) return s;
			return { equipment: { ...s.equipment, [id]: { ...existing, ...updates } as Equipment } };
		});
	},

	// ── Rail Nodes ───────────────────────────────────────────────
	addRailNode: (fabId, type, position) => {
		const id = createEntityId("RN");
		set((s) => ({
			railNodes: { ...s.railNodes, [id]: { id, fabId, type, position, equipmentId: null } },
		}));
		return id;
	},
	removeRailNode: (id) => {
		set((s) => {
			const { [id]: _, ...restNodes } = s.railNodes;
			// Also remove all edges connected to this node
			const restEdges: Record<EntityId, RailEdge> = {};
			for (const [edgeId, edge] of Object.entries(s.railEdges)) {
				if (edge.fromNodeId !== id && edge.toNodeId !== id) {
					restEdges[edgeId] = edge;
				}
			}
			return { railNodes: restNodes, railEdges: restEdges };
		});
	},

	// ── Rail Edges ───────────────────────────────────────────────
	addRailEdge: (fabId, fromNodeId, toNodeId, maxSpeed = 5) => {
		const id = createEntityId("RE");
		const state = get();
		const fromNode = state.railNodes[fromNodeId];
		const toNode = state.railNodes[toNodeId];
		const distance =
			fromNode && toNode ? computeEdgeDistance(fromNode.position, toNode.position) : 0;
		set((s) => ({
			railEdges: { ...s.railEdges, [id]: { id, fabId, fromNodeId, toNodeId, distance, maxSpeed } },
		}));
		return id;
	},
	removeRailEdge: (id) => {
		set((s) => {
			const { [id]: _, ...restEdges } = s.railEdges;
			return { railEdges: restEdges };
		});
	},

	// ── Selection ────────────────────────────────────────────────
	select: (entityId, entityType) => {
		set({ selectedEntityId: entityId, selectedEntityType: entityType });
	},
	clearSelection: () => {
		set({ selectedEntityId: null, selectedEntityType: null });
	},

	// ── Bulk ─────────────────────────────────────────────────────
	clear: () => {
		set({
			...emptyEntities(),
			...emptyChildren(),
			selectedEntityId: null,
			selectedEntityType: null,
		});
	},
	loadEntities: (data) => {
		set({
			...data.entities,
			...data.children,
			selectedEntityId: null,
			selectedEntityType: null,
		});
	},
}));
