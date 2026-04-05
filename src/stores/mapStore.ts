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
import type { BayData, FabMapFile, FabMapMetadata, NodeData, PortData, RailData } from "@/models";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface MapState {
	// Core entity maps (Record for O(1) lookup)
	nodes: Record<string, NodeData>;
	rails: Record<string, RailData>;
	ports: Record<string, PortData>;
	bays: Record<string, BayData>;

	// Derived index (auto-maintained on rail add/remove)
	adjacencyMap: Record<string, string[]>;

	// Dirty tracking for Layer 2 geometry cache (mutable Sets, consumed by useFrame)
	dirtyRailIds: Set<string>;
	dirtyPortIds: Set<string>;

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

	// --- Batch operations ---
	batchCreate: (params: {
		nodes: NodeData[];
		rails: RailData[];
		ports: PortData[];
		bayId: string;
	}) => void;
	loadMap: (file: FabMapFile) => void;
	clearMap: () => void;

	// --- Dirty flag consumption (called by useFrame) ---
	consumeDirtyRails: () => string[];
	consumeDirtyPorts: () => string[];
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
		adjacencyMap: {},
		dirtyRailIds: new Set<string>(),
		dirtyPortIds: new Set<string>(),
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

		// Remove ports attached to this rail first
		const portsToRemove: string[] = [];
		for (const port of Object.values(state.ports)) {
			if (port.railId === id) {
				portsToRemove.push(port.id);
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
			return {
				rails: restRails,
				ports: nextPorts,
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

	loadMap(file: FabMapFile): void {
		const adjacencyMap = buildAdjacencyMap(file.rails);

		// Fresh dirty sets — all entities are "dirty" after load so Layer 2 rebuilds
		const dirtyRailIds = new Set<string>(Object.keys(file.rails));
		const dirtyPortIds = new Set<string>(Object.keys(file.ports));

		set({
			nodes: { ...file.nodes },
			rails: { ...file.rails },
			ports: { ...file.ports },
			bays: { ...file.bays },
			adjacencyMap,
			dirtyRailIds,
			dirtyPortIds,
			metadata: file.metadata,
		});
	},

	clearMap(): void {
		set(createEmptyState());
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
