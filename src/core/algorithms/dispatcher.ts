import type { Oht } from "@/models/oht";
import type { RailEdge, RailNode } from "@/models/rail";
import type { TransferCommand } from "@/models/transfer";
import type { EntityId } from "@/types/common";
import { findPath } from "./router";

// ─── Dispatcher ─────────────────────────────────────────────────
// OHT assignment algorithms. Matches pending transfers to idle OHTs.
// Pure functions operating on provided state.

export const DISPATCH_ALGORITHMS = {
	FIFO: "fifo",
	NEAREST_FIRST: "nearest_first",
	PRIORITY: "priority",
} as const;

export type DispatchAlgorithm = (typeof DISPATCH_ALGORITHMS)[keyof typeof DISPATCH_ALGORITHMS];

export interface DispatchResult {
	transferId: EntityId;
	ohtId: EntityId;
	/** Cost of the path from OHT's current node to the transfer source port node */
	pathCost: number;
}

export interface DispatchConfig {
	idleOhts: ReadonlyArray<Oht>;
	pendingTransfers: ReadonlyArray<TransferCommand>;
	adjacency: ReadonlyMap<EntityId, EntityId[]>;
	nodes: ReadonlyMap<EntityId, RailNode>;
	edges: ReadonlyMap<EntityId, RailEdge>;
	/** portId -> nodeId */
	portNodeMap: ReadonlyMap<EntityId, EntityId>;
	algorithm: DispatchAlgorithm;
	currentTime: number;
	defaultMaxSpeed: number;
}

/**
 * Select the next OHT-transfer pairing based on the configured algorithm.
 * Returns null if no valid assignment can be made.
 */
export function dispatchNext(config: DispatchConfig): DispatchResult | null {
	if (config.idleOhts.length === 0 || config.pendingTransfers.length === 0) {
		return null;
	}

	switch (config.algorithm) {
		case DISPATCH_ALGORITHMS.FIFO:
			return dispatchFifo(config);
		case DISPATCH_ALGORITHMS.NEAREST_FIRST:
			return dispatchNearestFirst(config);
		case DISPATCH_ALGORITHMS.PRIORITY:
			return dispatchPriority(config);
		default:
			return dispatchFifo(config);
	}
}

/** FIFO: oldest pending transfer -> nearest idle OHT */
function dispatchFifo(config: DispatchConfig): DispatchResult | null {
	const transfer = config.pendingTransfers[0];
	if (!transfer) return null;

	const sourceNodeId = config.portNodeMap.get(transfer.sourcePortId);
	if (!sourceNodeId) return null;

	return findNearestOht(config, transfer.id, sourceNodeId);
}

/** NEAREST_FIRST: for each pending transfer, find closest idle OHT, pick min */
function dispatchNearestFirst(config: DispatchConfig): DispatchResult | null {
	let bestResult: DispatchResult | null = null;

	for (const transfer of config.pendingTransfers) {
		const sourceNodeId = config.portNodeMap.get(transfer.sourcePortId);
		if (!sourceNodeId) continue;

		const result = findNearestOht(config, transfer.id, sourceNodeId);
		if (result && (bestResult === null || result.pathCost < bestResult.pathCost)) {
			bestResult = result;
		}
	}

	return bestResult;
}

/** PRIORITY: weighted score = priority_weight * age + distance_weight * (1/pathCost) */
function dispatchPriority(config: DispatchConfig): DispatchResult | null {
	const PRIORITY_WEIGHT = 0.7;
	const DISTANCE_WEIGHT = 0.3;

	let bestResult: DispatchResult | null = null;
	let bestScore = -1;

	for (const transfer of config.pendingTransfers) {
		const sourceNodeId = config.portNodeMap.get(transfer.sourcePortId);
		if (!sourceNodeId) continue;

		const createdAt = transfer.timestamps.created;
		const age = createdAt != null ? config.currentTime - createdAt : 0;

		for (const oht of config.idleOhts) {
			const ohtNodeId = oht.currentNodeId;
			if (!ohtNodeId) continue;

			const route = findPath(
				config.adjacency,
				config.nodes,
				config.edges,
				ohtNodeId,
				sourceNodeId,
				config.defaultMaxSpeed,
			);
			if (!route.found) continue;

			const distanceScore = route.cost > 0 ? 1 / route.cost : 1000;
			const score = PRIORITY_WEIGHT * age + DISTANCE_WEIGHT * distanceScore;

			if (score > bestScore) {
				bestScore = score;
				bestResult = {
					transferId: transfer.id,
					ohtId: oht.id,
					pathCost: route.cost,
				};
			}
		}
	}

	return bestResult;
}

/** Find the nearest idle OHT to a target node */
function findNearestOht(
	config: DispatchConfig,
	transferId: EntityId,
	targetNodeId: EntityId,
): DispatchResult | null {
	let bestOhtId: EntityId | null = null;
	let bestCost = Number.POSITIVE_INFINITY;

	for (const oht of config.idleOhts) {
		const ohtNodeId = oht.currentNodeId;
		if (!ohtNodeId) continue;

		const route = findPath(
			config.adjacency,
			config.nodes,
			config.edges,
			ohtNodeId,
			targetNodeId,
			config.defaultMaxSpeed,
		);
		if (!route.found) continue;

		if (route.cost < bestCost) {
			bestCost = route.cost;
			bestOhtId = oht.id;
		}
	}

	if (bestOhtId === null) return null;
	return { transferId, ohtId: bestOhtId, pathCost: bestCost };
}
