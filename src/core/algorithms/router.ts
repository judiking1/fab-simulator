import type { RailEdge, RailNode } from "@/models/rail";
import type { EntityId, Vector3 } from "@/types/common";

// ─── A* Router ──────────────────────────────────────────────────
// Pathfinding on the directed rail graph using A* with euclidean
// distance heuristic. Cost is based on edge distance / maxSpeed.

export interface RouteResult {
	/** Ordered node IDs from source to target */
	path: EntityId[];
	/** Ordered edge IDs along the path */
	edgeIds: EntityId[];
	/** Total cost (time-based) */
	cost: number;
	/** Whether a valid path was found */
	found: boolean;
}

/** Edge cost with BPR congestion penalty: travel time * congestion multiplier * weight */
function edgeCost(edge: RailEdge, bprAlpha = 8.0, bprBeta = 4.0): number {
	const baseCost = edge.distance / edge.maxSpeed;
	if (!edge.enabled) return Number.POSITIVE_INFINITY;
	const bprMultiplier = 1 + bprAlpha * (edge.density / 100) ** bprBeta;
	return baseCost * bprMultiplier * edge.weight;
}

/** Euclidean distance heuristic divided by max speed for admissibility */
function euclideanHeuristic(a: Vector3, b: Vector3, maxSpeed: number): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dz = b.z - a.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz) / maxSpeed;
}

/**
 * A* pathfinding on the directed rail graph.
 *
 * @param adjacency - nodeId -> outgoing edgeId[]
 * @param nodes - All rail nodes by ID
 * @param edges - All rail edges by ID
 * @param fromNodeId - Source node
 * @param toNodeId - Target node
 * @param defaultMaxSpeed - Default max speed for heuristic (m/s)
 */
export function findPath(
	adjacency: ReadonlyMap<EntityId, EntityId[]>,
	nodes: ReadonlyMap<EntityId, RailNode>,
	edges: ReadonlyMap<EntityId, RailEdge>,
	fromNodeId: EntityId,
	toNodeId: EntityId,
	defaultMaxSpeed = 5,
	bprAlpha = 8.0,
	bprBeta = 4.0,
): RouteResult {
	const notFound: RouteResult = { path: [], edgeIds: [], cost: 0, found: false };

	if (fromNodeId === toNodeId) {
		return { path: [fromNodeId], edgeIds: [], cost: 0, found: true };
	}

	const fromNode = nodes.get(fromNodeId);
	const toNode = nodes.get(toNodeId);
	if (!fromNode || !toNode) return notFound;

	// g-score: best known cost from start to node
	const gScore = new Map<EntityId, number>();
	gScore.set(fromNodeId, 0);

	// f-score: g + heuristic
	const fScore = new Map<EntityId, number>();
	fScore.set(fromNodeId, euclideanHeuristic(fromNode.position, toNode.position, defaultMaxSpeed));

	// Track path for reconstruction
	const cameFrom = new Map<EntityId, { nodeId: EntityId; edgeId: EntityId }>();

	// Open set
	const openSet = new Set<EntityId>();
	openSet.add(fromNodeId);

	while (openSet.size > 0) {
		// Find node with lowest fScore in open set
		let current: EntityId | undefined;
		let currentF = Number.POSITIVE_INFINITY;
		for (const nodeId of openSet) {
			const f = fScore.get(nodeId) ?? Number.POSITIVE_INFINITY;
			if (f < currentF) {
				currentF = f;
				current = nodeId;
			}
		}

		if (current === undefined) break;

		// Reached target
		if (current === toNodeId) {
			return reconstructRoute(cameFrom, fromNodeId, toNodeId, gScore.get(toNodeId) ?? 0);
		}

		openSet.delete(current);

		const outEdgeIds = adjacency.get(current);
		if (!outEdgeIds) continue;

		const currentG = gScore.get(current) ?? Number.POSITIVE_INFINITY;

		for (const edgeId of outEdgeIds) {
			const edge = edges.get(edgeId);
			if (!edge) continue;

			const neighborId = edge.toNodeId;
			const neighborNode = nodes.get(neighborId);
			if (!neighborNode) continue;

			if (!edge.enabled) continue;
			const cost = edgeCost(edge, bprAlpha, bprBeta);
			const tentativeG = currentG + cost;
			const previousG = gScore.get(neighborId) ?? Number.POSITIVE_INFINITY;

			if (tentativeG < previousG) {
				cameFrom.set(neighborId, { nodeId: current, edgeId });
				gScore.set(neighborId, tentativeG);
				const h = euclideanHeuristic(neighborNode.position, toNode.position, defaultMaxSpeed);
				fScore.set(neighborId, tentativeG + h);

				if (!openSet.has(neighborId)) {
					openSet.add(neighborId);
				}
			}
		}
	}

	return notFound;
}

function reconstructRoute(
	cameFrom: Map<EntityId, { nodeId: EntityId; edgeId: EntityId }>,
	source: EntityId,
	target: EntityId,
	totalCost: number,
): RouteResult {
	const path: EntityId[] = [];
	const edgeIds: EntityId[] = [];
	let current = target;

	while (current !== source) {
		path.push(current);
		const entry = cameFrom.get(current);
		if (!entry) break;
		edgeIds.push(entry.edgeId);
		current = entry.nodeId;
	}
	path.push(source);

	path.reverse();
	edgeIds.reverse();

	return { path, edgeIds, cost: totalCost, found: true };
}
