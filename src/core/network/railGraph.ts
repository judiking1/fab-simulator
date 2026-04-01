import type { RailEdge, RailNode } from "@/models/rail";
import type { EntityId, Vector3 } from "@/types/common";

// ─── Rail Graph ──────────────────────────────────────────────────
// Directed graph for OHT pathfinding. Built from RailNode/RailEdge records.
// Provides adjacency list lookup and shortest path via Dijkstra.

export interface RailGraph {
	nodes: ReadonlyMap<EntityId, RailNode>;
	edges: ReadonlyMap<EntityId, RailEdge>;
	/** nodeId → outgoing edge IDs */
	adjacency: ReadonlyMap<EntityId, EntityId[]>;
	/** nodeId → incoming edge IDs (reverse lookup) */
	reverseAdjacency: ReadonlyMap<EntityId, EntityId[]>;
}

/** Build a RailGraph from flat entity records */
export function buildRailGraph(
	nodeRecords: Record<EntityId, RailNode>,
	edgeRecords: Record<EntityId, RailEdge>,
): RailGraph {
	const nodes = new Map<EntityId, RailNode>();
	const edges = new Map<EntityId, RailEdge>();
	const adjacency = new Map<EntityId, EntityId[]>();
	const reverseAdjacency = new Map<EntityId, EntityId[]>();

	// Initialize nodes
	for (const node of Object.values(nodeRecords)) {
		nodes.set(node.id, node);
		adjacency.set(node.id, []);
		reverseAdjacency.set(node.id, []);
	}

	// Build adjacency from edges
	for (const edge of Object.values(edgeRecords)) {
		edges.set(edge.id, edge);

		const outgoing = adjacency.get(edge.fromNodeId);
		if (outgoing) {
			outgoing.push(edge.id);
		}

		const incoming = reverseAdjacency.get(edge.toNodeId);
		if (incoming) {
			incoming.push(edge.id);
		}
	}

	return { nodes, edges, adjacency, reverseAdjacency };
}

// ─── Connectivity ────────────────────────────────────────────────

/** Check if all nodes are reachable from any other node (strongly connected check is expensive, this checks weak connectivity) */
export function getConnectedComponents(graph: RailGraph): EntityId[][] {
	const visited = new Set<EntityId>();
	const components: EntityId[][] = [];

	// Build undirected adjacency for weak connectivity
	const undirected = new Map<EntityId, Set<EntityId>>();
	for (const nodeId of graph.nodes.keys()) {
		undirected.set(nodeId, new Set());
	}
	for (const edge of graph.edges.values()) {
		undirected.get(edge.fromNodeId)?.add(edge.toNodeId);
		undirected.get(edge.toNodeId)?.add(edge.fromNodeId);
	}

	for (const nodeId of graph.nodes.keys()) {
		if (visited.has(nodeId)) continue;

		const component: EntityId[] = [];
		const stack = [nodeId];

		while (stack.length > 0) {
			const current = stack.pop();
			if (current === undefined) break;
			if (visited.has(current)) continue;
			visited.add(current);
			component.push(current);

			const neighbors = undirected.get(current);
			if (neighbors) {
				for (const neighbor of neighbors) {
					if (!visited.has(neighbor)) {
						stack.push(neighbor);
					}
				}
			}
		}

		components.push(component);
	}

	return components;
}

/** Returns true if the rail graph is weakly connected (single component) */
export function isGraphConnected(graph: RailGraph): boolean {
	if (graph.nodes.size === 0) return true;
	return getConnectedComponents(graph).length === 1;
}

// ─── Shortest Path (Dijkstra) ────────────────────────────────────

export interface PathResult {
	/** Ordered list of node IDs from source to target */
	nodeIds: EntityId[];
	/** Ordered list of edge IDs along the path */
	edgeIds: EntityId[];
	/** Total distance of the path */
	totalDistance: number;
}

/** Find the shortest path between two nodes using Dijkstra's algorithm */
export function findShortestPath(
	graph: RailGraph,
	sourceNodeId: EntityId,
	targetNodeId: EntityId,
): PathResult | null {
	if (sourceNodeId === targetNodeId) {
		return { nodeIds: [sourceNodeId], edgeIds: [], totalDistance: 0 };
	}

	if (!graph.nodes.has(sourceNodeId) || !graph.nodes.has(targetNodeId)) {
		return null;
	}

	const dist = new Map<EntityId, number>();
	const prev = new Map<EntityId, { nodeId: EntityId; edgeId: EntityId }>();
	// Simple priority queue using sorted array (adequate for graph sizes < 10k nodes)
	const queue: Array<{ nodeId: EntityId; distance: number }> = [];

	dist.set(sourceNodeId, 0);
	queue.push({ nodeId: sourceNodeId, distance: 0 });

	while (queue.length > 0) {
		// Extract min
		let minIdx = 0;
		for (let i = 1; i < queue.length; i++) {
			if (queue[i].distance < queue[minIdx].distance) {
				minIdx = i;
			}
		}
		const { nodeId: current, distance: currentDist } = queue[minIdx];
		queue.splice(minIdx, 1);

		// Skip if we already found a better path
		const knownDist = dist.get(current);
		if (knownDist !== undefined && currentDist > knownDist) continue;

		// Found target
		if (current === targetNodeId) {
			return reconstructPath(prev, sourceNodeId, targetNodeId, currentDist);
		}

		// Explore neighbors
		const outEdgeIds = graph.adjacency.get(current);
		if (!outEdgeIds) continue;

		for (const edgeId of outEdgeIds) {
			const edge = graph.edges.get(edgeId);
			if (!edge) continue;

			const newDist = currentDist + edge.distance;
			const prevDist = dist.get(edge.toNodeId);

			if (prevDist === undefined || newDist < prevDist) {
				dist.set(edge.toNodeId, newDist);
				prev.set(edge.toNodeId, { nodeId: current, edgeId });
				queue.push({ nodeId: edge.toNodeId, distance: newDist });
			}
		}
	}

	return null; // No path found
}

function reconstructPath(
	prev: Map<EntityId, { nodeId: EntityId; edgeId: EntityId }>,
	source: EntityId,
	target: EntityId,
	totalDistance: number,
): PathResult {
	const nodeIds: EntityId[] = [];
	const edgeIds: EntityId[] = [];
	let current = target;

	while (current !== source) {
		nodeIds.push(current);
		const entry = prev.get(current);
		if (!entry) break;
		edgeIds.push(entry.edgeId);
		current = entry.nodeId;
	}
	nodeIds.push(source);

	nodeIds.reverse();
	edgeIds.reverse();

	return { nodeIds, edgeIds, totalDistance };
}

// ─── Utility ─────────────────────────────────────────────────────

export function computeDistance(a: Vector3, b: Vector3): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dz = b.z - a.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
