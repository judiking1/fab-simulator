/**
 * Map Store — Source of truth for all map entities (Layer 1).
 *
 * Architecture (ADR-003 3-Layer Rendering):
 *   Layer 1: This Zustand store (CRUD, adjacency index, dirty tracking)
 *   Layer 2: Geometry cache (refs, Float32Array buffers — external)
 *   Layer 3: InstancedMesh (imperative updates in useFrame — external)
 *
 * Dirty flag chain:
 *   Node moved → adjacencyMap lookup → dirtyRailIds.add(...)
 *   Rail updated → ports on that rail → dirtyPortIds.add(...)
 *
 * Performance notes:
 * - Plain Zustand (no immer) — spread operator for immutable updates
 * - Sets for dirty tracking are mutable (consumed imperatively in useFrame)
 * - Record<string, T> for O(1) entity lookup
 */

import { create } from "zustand";
import type {
	BayData,
	EquipmentData,
	EquipmentSpec,
	FabMapFile,
	FabMapMetadata,
	NodeData,
	PortData,
	RailData,
} from "@/models";
import { deriveEquipmentFromPorts } from "@/utils/equipmentDerivation";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface MapState {
	// Core entity maps (Record for O(1) lookup)
	nodes: Record<string, NodeData>;
	rails: Record<string, RailData>;
	ports: Record<string, PortData>;
	bays: Record<string, BayData>;
	equipment: Record<string, EquipmentData>;
	equipmentSpecs: Record<string, EquipmentSpec>;

	// Derived index (auto-maintained on rail add/remove)
	adjacencyMap: Record<string, string[]>;

	// Dirty tracking for Layer 2 geometry cache (mutable Sets, consumed by useFrame)
	dirtyRailIds: Set<string>;
	dirtyPortIds: Set<string>;
	dirtyEquipmentIds: Set<string>;

	// Map metadata
	metadata: FabMapMetadata | null;
}

interface MapActions {
	// --- Node CRUD ---
	addNode: (node: NodeData) => void;
	updateNode: (id: string, updates: Partial<NodeData>) => void;
	removeNode: (id: string) => void;

	// --- Rail CRUD ---
	addRail: (rail: RailData) => void;
	updateRail: (id: string, updates: Partial<RailData>) => void;
	removeRail: (id: string) => void;

	// --- Port CRUD ---
	addPort: (port: PortData) => void;
	updatePort: (id: string, updates: Partial<PortData>) => void;
	removePort: (id: string) => void;

	// --- Bay CRUD ---
	addBay: (bay: BayData) => void;
	updateBay: (id: string, updates: Partial<BayData>) => void;
	removeBay: (id: string) => void;

	// --- Equipment CRUD ---
	addEquipment: (eq: EquipmentData) => void;
	updateEquipment: (id: string, updates: Partial<EquipmentData>) => void;
	removeEquipment: (id: string) => void;

	// --- Batch operations ---
	batchCreate: (params: {
		nodes: NodeData[];
		rails: RailData[];
		ports: PortData[];
		bayId: string;
	}) => void;
	/** Batch update multiple entities in a single set() call (for drag moves) */
	batchUpdate: (updates: {
		nodes?: Array<{ id: string; changes: Partial<NodeData> }>;
		equipment?: Array<{ id: string; changes: Partial<EquipmentData> }>;
	}) => void;
	loadMap: (file: FabMapFile) => void;
	clearMap: () => void;

	// --- Dirty flag consumption (called by useFrame) ---
	consumeDirtyRails: () => string[];
	consumeDirtyPorts: () => string[];
	consumeDirtyEquipment: () => string[];
}

// ---------------------------------------------------------------------------
// Initial (empty) state factory
// ---------------------------------------------------------------------------

function createEmptyState(): MapState {
	return {
		nodes: {},
		rails: {},
		ports: {},
		bays: {},
		equipment: {},
		equipmentSpecs: {},
		adjacencyMap: {},
		dirtyRailIds: new Set<string>(),
		dirtyPortIds: new Set<string>(),
		dirtyEquipmentIds: new Set<string>(),
		metadata: null,
	};
}

// ---------------------------------------------------------------------------
// Adjacency helpers (pure functions, no mutation of input)
// ---------------------------------------------------------------------------

/** Add a rail's endpoints to the adjacency map. Returns a new map. */
function addRailToAdjacency(
	adj: Record<string, string[]>,
	rail: RailData,
): Record<string, string[]> {
	const next = { ...adj };
	next[rail.fromNodeId] = [...(next[rail.fromNodeId] ?? []), rail.id];
	next[rail.toNodeId] = [...(next[rail.toNodeId] ?? []), rail.id];
	return next;
}

/** Remove a rail from the adjacency map. Returns a new map. */
function removeRailFromAdjacency(
	adj: Record<string, string[]>,
	rail: RailData,
): Record<string, string[]> {
	const next = { ...adj };

	const filterOut = (nodeId: string): void => {
		const list = next[nodeId];
		if (!list) return;
		const filtered = list.filter((rid) => rid !== rail.id);
		if (filtered.length === 0) {
			delete next[nodeId];
		} else {
			next[nodeId] = filtered;
		}
	};

	filterOut(rail.fromNodeId);
	filterOut(rail.toNodeId);
	return next;
}

/** Mark all rails connected to a node as dirty. */
function markNodeRailsDirty(
	adjacencyMap: Record<string, string[]>,
	nodeId: string,
	dirtySet: Set<string>,
): void {
	const railIds = adjacencyMap[nodeId];
	if (railIds) {
		for (const rid of railIds) {
			dirtySet.add(rid);
		}
	}
}

/** Mark all ports on a rail as dirty. */
function markRailPortsDirty(
	ports: Record<string, PortData>,
	railId: string,
	dirtySet: Set<string>,
): void {
	// Linear scan over ports — acceptable because port count per rail is small
	// and this only fires on explicit rail update, not every frame.
	for (const port of Object.values(ports)) {
		if (port.railId === railId) {
			dirtySet.add(port.id);
		}
	}
}

// ---------------------------------------------------------------------------
// Merge coincident nodes — VOS data creates separate node IDs at junctions
// ---------------------------------------------------------------------------

/**
 * Merge nodes that share the exact same (x, y, z) coordinates.
 * The first node ID encountered becomes the "canonical" ID.
 * All rail/port references to duplicate node IDs are remapped.
 *
 * Also remaps curveNodeIds in rails (intermediate curve waypoints).
 */
function mergeCoincidentNodes(
	inputNodes: Record<string, NodeData>,
	inputRails: Record<string, RailData>,
	inputPorts: Record<string, PortData>,
): {
	nodes: Record<string, NodeData>;
	rails: Record<string, RailData>;
	ports: Record<string, PortData>;
} {
	// Build coordinate → canonical node ID mapping
	const coordToCanonical = new Map<string, string>();
	const idRemap = new Map<string, string>(); // duplicateId → canonicalId

	for (const node of Object.values(inputNodes)) {
		// Use fixed precision to handle floating-point comparison
		const key = `${node.x.toFixed(6)},${node.y.toFixed(6)},${node.z.toFixed(6)}`;
		const existing = coordToCanonical.get(key);
		if (existing) {
			idRemap.set(node.id, existing);
		} else {
			coordToCanonical.set(key, node.id);
		}
	}

	// If no duplicates, return as-is (avoid unnecessary copies)
	if (idRemap.size === 0) {
		return {
			nodes: { ...inputNodes },
			rails: { ...inputRails },
			ports: { ...inputPorts },
		};
	}

	console.log(
		`[mapStore] Merged ${idRemap.size} coincident nodes (${Object.keys(inputNodes).length} → ${Object.keys(inputNodes).length - idRemap.size})`,
	);

	// Build deduplicated nodes record (only canonical nodes)
	const nodes: Record<string, NodeData> = {};
	for (const node of Object.values(inputNodes)) {
		if (!idRemap.has(node.id)) {
			nodes[node.id] = node;
		}
	}

	// Remap rail endpoint references
	const remapId = (id: string): string => idRemap.get(id) ?? id;

	const rails: Record<string, RailData> = {};
	for (const rail of Object.values(inputRails)) {
		rails[rail.id] = {
			...rail,
			fromNodeId: remapId(rail.fromNodeId),
			toNodeId: remapId(rail.toNodeId),
			curveNodeIds: rail.curveNodeIds.map(remapId),
		};
	}

	// Remap port references (ports reference rails, not nodes directly, so no changes needed)
	const ports: Record<string, PortData> = { ...inputPorts };

	return { nodes, rails, ports };
}

// ---------------------------------------------------------------------------
// Build adjacency from a full rails record (used by loadMap)
// ---------------------------------------------------------------------------

function buildAdjacencyMap(rails: Record<string, RailData>): Record<string, string[]> {
	const adj: Record<string, string[]> = {};
	for (const rail of Object.values(rails)) {
		const fromList = adj[rail.fromNodeId] ?? [];
		fromList.push(rail.id);
		adj[rail.fromNodeId] = fromList;

		const toList = adj[rail.toNodeId] ?? [];
		toList.push(rail.id);
		adj[rail.toNodeId] = toList;
	}
	return adj;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMapStore = create<MapState & MapActions>()((set, get) => ({
	...createEmptyState(),

	// =========================================================================
	// Node CRUD
	// =========================================================================

	addNode(node: NodeData): void {
		set((state) => ({
			nodes: { ...state.nodes, [node.id]: node },
		}));
	},

	updateNode(id: string, updates: Partial<NodeData>): void {
		const state = get();
		const existing = state.nodes[id];
		if (!existing) {
			console.warn(`[mapStore] updateNode: node "${id}" not found`);
			return;
		}

		// Mark connected rails dirty BEFORE the state update so useFrame picks them up
		markNodeRailsDirty(state.adjacencyMap, id, state.dirtyRailIds);

		// Also mark ports on those rails dirty
		const connectedRailIds = state.adjacencyMap[id];
		if (connectedRailIds) {
			for (const railId of connectedRailIds) {
				markRailPortsDirty(state.ports, railId, state.dirtyPortIds);
			}
		}

		set((prev) => ({
			nodes: { ...prev.nodes, [id]: { ...existing, ...updates, id } },
		}));
	},

	removeNode(id: string): void {
		const state = get();
		const connectedRails = state.adjacencyMap[id];
		if (connectedRails && connectedRails.length > 0) {
			throw new Error(
				`[mapStore] Cannot remove node "${id}": still referenced by rails [${connectedRails.join(", ")}]. Remove those rails first.`,
			);
		}

		set((prev) => {
			const { [id]: _removed, ...rest } = prev.nodes;
			return { nodes: rest };
		});
	},

	// =========================================================================
	// Rail CRUD
	// =========================================================================

	addRail(rail: RailData): void {
		set((state) => ({
			rails: { ...state.rails, [rail.id]: rail },
			adjacencyMap: addRailToAdjacency(state.adjacencyMap, rail),
		}));
		// New rail is dirty so Layer 2 builds its geometry
		get().dirtyRailIds.add(rail.id);
	},

	updateRail(id: string, updates: Partial<RailData>): void {
		const state = get();
		const existing = state.rails[id];
		if (!existing) {
			console.warn(`[mapStore] updateRail: rail "${id}" not found`);
			return;
		}

		// Mark this rail and its ports dirty
		state.dirtyRailIds.add(id);
		markRailPortsDirty(state.ports, id, state.dirtyPortIds);

		const updated: RailData = { ...existing, ...updates, id };

		// If endpoints changed, update adjacency map
		const endpointsChanged = updates.fromNodeId !== undefined || updates.toNodeId !== undefined;

		if (endpointsChanged) {
			set((prev) => ({
				rails: { ...prev.rails, [id]: updated },
				adjacencyMap: addRailToAdjacency(
					removeRailFromAdjacency(prev.adjacencyMap, existing),
					updated,
				),
			}));
		} else {
			set((prev) => ({
				rails: { ...prev.rails, [id]: updated },
			}));
		}
	},

	removeRail(id: string): void {
		const state = get();
		const existing = state.rails[id];
		if (!existing) {
			console.warn(`[mapStore] removeRail: rail "${id}" not found`);
			return;
		}

		// Collect ports and equipment attached to this rail for cascade delete
		const portsToRemove: string[] = [];
		for (const port of Object.values(state.ports)) {
			if (port.railId === id) {
				portsToRemove.push(port.id);
			}
		}
		const equipmentToRemove: string[] = [];
		for (const eq of Object.values(state.equipment)) {
			if (eq.railId === id) {
				equipmentToRemove.push(eq.id);
			}
		}

		set((prev) => {
			const { [id]: _removed, ...restRails } = prev.rails;
			let nextPorts = prev.ports;
			if (portsToRemove.length > 0) {
				nextPorts = { ...prev.ports };
				for (const pid of portsToRemove) {
					delete (nextPorts as Record<string, PortData | undefined>)[pid];
				}
			}
			let nextEquipment = prev.equipment;
			if (equipmentToRemove.length > 0) {
				nextEquipment = { ...prev.equipment };
				for (const eqId of equipmentToRemove) {
					delete (nextEquipment as Record<string, EquipmentData | undefined>)[eqId];
				}
			}
			return {
				rails: restRails,
				ports: nextPorts,
				equipment: nextEquipment,
				adjacencyMap: removeRailFromAdjacency(prev.adjacencyMap, existing),
			};
		});
	},

	// =========================================================================
	// Port CRUD
	// =========================================================================

	addPort(port: PortData): void {
		set((state) => ({
			ports: { ...state.ports, [port.id]: port },
		}));
		get().dirtyPortIds.add(port.id);
	},

	updatePort(id: string, updates: Partial<PortData>): void {
		const state = get();
		const existing = state.ports[id];
		if (!existing) {
			console.warn(`[mapStore] updatePort: port "${id}" not found`);
			return;
		}

		state.dirtyPortIds.add(id);

		set((prev) => ({
			ports: { ...prev.ports, [id]: { ...existing, ...updates, id } },
		}));
	},

	removePort(id: string): void {
		set((prev) => {
			const { [id]: _removed, ...rest } = prev.ports;
			return { ports: rest };
		});
	},

	// =========================================================================
	// Bay CRUD
	// =========================================================================

	addBay(bay: BayData): void {
		set((state) => ({
			bays: { ...state.bays, [bay.id]: bay },
		}));
	},

	updateBay(id: string, updates: Partial<BayData>): void {
		const state = get();
		const existing = state.bays[id];
		if (!existing) {
			console.warn(`[mapStore] updateBay: bay "${id}" not found`);
			return;
		}

		set((prev) => ({
			bays: { ...prev.bays, [id]: { ...existing, ...updates, id } },
		}));
	},

	removeBay(id: string): void {
		set((prev) => {
			const { [id]: _removed, ...rest } = prev.bays;
			return { bays: rest };
		});
	},

	// =========================================================================
	// Equipment CRUD
	// =========================================================================

	addEquipment(eq: EquipmentData): void {
		set((state) => ({
			equipment: { ...state.equipment, [eq.id]: eq },
		}));
		get().dirtyEquipmentIds.add(eq.id);
	},

	updateEquipment(id: string, updates: Partial<EquipmentData>): void {
		const state = get();
		const existing = state.equipment[id];
		if (!existing) {
			console.warn(`[mapStore] updateEquipment: equipment "${id}" not found`);
			return;
		}

		state.dirtyEquipmentIds.add(id);

		// If the equipment moved, its ports may also need re-positioning
		if (updates.railId !== undefined || updates.ratio !== undefined || updates.side !== undefined) {
			for (const portId of existing.portIds) {
				state.dirtyPortIds.add(portId);
			}
		}

		set((prev) => ({
			equipment: { ...prev.equipment, [id]: { ...existing, ...updates, id } },
		}));
	},

	removeEquipment(id: string): void {
		const state = get();
		const existing = state.equipment[id];
		if (!existing) {
			console.warn(`[mapStore] removeEquipment: equipment "${id}" not found`);
			return;
		}

		// Cascade-delete owned ports
		set((prev) => {
			const { [id]: _removed, ...restEquipment } = prev.equipment;
			let nextPorts = prev.ports;
			if (existing.portIds.length > 0) {
				nextPorts = { ...prev.ports };
				for (const portId of existing.portIds) {
					delete (nextPorts as Record<string, PortData | undefined>)[portId];
				}
			}
			return { equipment: restEquipment, ports: nextPorts };
		});
	},

	// =========================================================================
	// Batch operations
	// =========================================================================

	batchCreate({ nodes, rails, ports, bayId }): void {
		set((state) => {
			// Build new nodes record
			let nextNodes = state.nodes;
			if (nodes.length > 0) {
				nextNodes = { ...state.nodes };
				for (const node of nodes) {
					nextNodes[node.id] = node;
				}
			}

			// Build new rails record + adjacency
			let nextRails = state.rails;
			let nextAdj = state.adjacencyMap;
			if (rails.length > 0) {
				nextRails = { ...state.rails };
				for (const rail of rails) {
					nextRails[rail.id] = rail;
					nextAdj = addRailToAdjacency(nextAdj, rail);
					state.dirtyRailIds.add(rail.id);
				}
			}

			// Build new ports record
			let nextPorts = state.ports;
			if (ports.length > 0) {
				nextPorts = { ...state.ports };
				for (const port of ports) {
					nextPorts[port.id] = port;
					state.dirtyPortIds.add(port.id);
				}
			}

			// Add or update the bay
			const existingBay = state.bays[bayId];
			const newRailIds = rails.map((r) => r.id);
			const bayRailIds = existingBay ? [...existingBay.railIds, ...newRailIds] : newRailIds;

			const nextBays = {
				...state.bays,
				[bayId]: existingBay
					? { ...existingBay, railIds: bayRailIds }
					: {
							id: bayId,
							fabId: rails[0]?.fabId ?? "",
							railIds: bayRailIds,
							loopDirection: "ccw" as const,
						},
			};

			return {
				nodes: nextNodes,
				rails: nextRails,
				ports: nextPorts,
				bays: nextBays,
				adjacencyMap: nextAdj,
			};
		});
	},

	batchUpdate(updates): void {
		const state = get();

		set((prev) => {
			let nextNodes = prev.nodes;
			if (updates.nodes && updates.nodes.length > 0) {
				nextNodes = { ...prev.nodes };
				for (const { id, changes } of updates.nodes) {
					const existing = nextNodes[id];
					if (!existing) continue;
					nextNodes[id] = { ...existing, ...changes, id };
					// Mark connected rails dirty
					markNodeRailsDirty(state.adjacencyMap, id, state.dirtyRailIds);
					const connectedRailIds = state.adjacencyMap[id];
					if (connectedRailIds) {
						for (const railId of connectedRailIds) {
							markRailPortsDirty(prev.ports, railId, state.dirtyPortIds);
						}
					}
				}
			}

			let nextEquipment = prev.equipment;
			if (updates.equipment && updates.equipment.length > 0) {
				nextEquipment = { ...prev.equipment };
				for (const { id, changes } of updates.equipment) {
					const existing = nextEquipment[id];
					if (!existing) continue;
					nextEquipment[id] = { ...existing, ...changes, id };
					state.dirtyEquipmentIds.add(id);
					// Mark owned ports dirty if position changed
					if (
						changes.railId !== undefined ||
						changes.ratio !== undefined ||
						changes.side !== undefined
					) {
						for (const portId of existing.portIds) {
							state.dirtyPortIds.add(portId);
						}
					}
				}
			}

			return { nodes: nextNodes, equipment: nextEquipment };
		});
	},

	loadMap(file: FabMapFile): void {
		// Merge coincident nodes (same coordinates) into a single representative node.
		// VOS data often creates separate node IDs per rail endpoint at junctions.
		const { nodes, rails, ports } = mergeCoincidentNodes(file.nodes, file.rails, file.ports);

		const adjacencyMap = buildAdjacencyMap(rails);

		// Derive equipment from ports if not present in file (backward compat)
		const equipment = file.equipment ? { ...file.equipment } : deriveEquipmentFromPorts(ports);
		const equipmentSpecs = file.equipmentSpecs ? { ...file.equipmentSpecs } : {};

		// Fresh dirty sets — all entities are "dirty" after load so Layer 2 rebuilds
		const dirtyRailIds = new Set<string>(Object.keys(rails));
		const dirtyPortIds = new Set<string>(Object.keys(ports));
		const dirtyEquipmentIds = new Set<string>(Object.keys(equipment));

		set({
			nodes,
			rails,
			ports,
			bays: { ...file.bays },
			equipment,
			equipmentSpecs,
			adjacencyMap,
			dirtyRailIds,
			dirtyPortIds,
			dirtyEquipmentIds,
			metadata: file.metadata,
		});
	},

	clearMap(): void {
		set(createEmptyState());
	},

	// =========================================================================
	// Dirty flag consumption — Equipment
	// =========================================================================

	consumeDirtyEquipment(): string[] {
		const state = get();
		if (state.dirtyEquipmentIds.size === 0) return [];
		const ids = [...state.dirtyEquipmentIds];
		state.dirtyEquipmentIds.clear();
		return ids;
	},

	// =========================================================================
	// Dirty flag consumption (imperative, called by useFrame)
	// =========================================================================

	consumeDirtyRails(): string[] {
		const state = get();
		if (state.dirtyRailIds.size === 0) return [];
		const ids = [...state.dirtyRailIds];
		state.dirtyRailIds.clear();
		return ids;
	},

	consumeDirtyPorts(): string[] {
		const state = get();
		if (state.dirtyPortIds.size === 0) return [];
		const ids = [...state.dirtyPortIds];
		state.dirtyPortIds.clear();
		return ids;
	},
}));

// ---------------------------------------------------------------------------
// Selectors — for React components that need entity counts
// (InstancedMesh recreation triggers on count change)
// ---------------------------------------------------------------------------

export const selectNodeCount = (state: MapState): number => Object.keys(state.nodes).length;

export const selectRailCount = (state: MapState): number => Object.keys(state.rails).length;

export const selectPortCount = (state: MapState): number => Object.keys(state.ports).length;

export const selectBayCount = (state: MapState): number => Object.keys(state.bays).length;

export const selectEquipmentCount = (state: MapState): number =>
	Object.keys(state.equipment).length;
