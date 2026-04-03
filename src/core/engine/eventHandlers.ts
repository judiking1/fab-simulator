import type { Equipment } from "@/models/equipment";
import type { Oht } from "@/models/oht";
import { OHT_STATES } from "@/models/oht";
import type { RailEdge, RailNode } from "@/models/rail";
import { RAIL_NODE_TYPES } from "@/models/rail";
import type { TransferCommand } from "@/models/transfer";
import { TRANSFER_STATUSES } from "@/models/transfer";
import type { EntityId } from "@/types/common";
import type { SimEvent } from "@/types/simulation";
import { SIM_EVENT_TYPES } from "@/types/simulation";
import type { DispatchConfig } from "../algorithms/dispatcher";
import { dispatchNext } from "../algorithms/dispatcher";
import type { IntersectionManager } from "../algorithms/intersectionManager";
import { findPath } from "../algorithms/router";
import { calcSegmentTravelTime } from "../algorithms/speedCalculator";
import type { PriorityQueue } from "./priorityQueue";

// ─── Event Handlers ─────────────────────────────────────────────
// Each handler processes a simulation event and produces side effects
// (state mutations + new events). Called by DesEngine.

/** Mutable OHT state for simulation (Oht already includes pathEdgeIds + pathIndex) */
export type SimOht = Oht;

/** Shared simulation context passed to all event handlers */
export interface SimContext {
	queue: PriorityQueue;
	currentTime: number;

	// Entities
	ohts: Map<EntityId, SimOht>;
	transfers: Map<EntityId, TransferCommand>;
	equipment: ReadonlyMap<EntityId, Equipment>;

	// Rail graph
	nodes: ReadonlyMap<EntityId, RailNode>;
	edges: ReadonlyMap<EntityId, RailEdge>;
	adjacency: ReadonlyMap<EntityId, EntityId[]>;

	// Mappings
	portNodeMap: ReadonlyMap<EntityId, EntityId>;

	// Subsystems
	intersectionManager: IntersectionManager;

	// Config
	dispatchAlgorithm: string;
	loadDuration: number;
	unloadDuration: number;
	ohtMaxSpeed: number;
	acceleration: number;
	deceleration: number;

	// Event log
	events: SimEvent[];
}

// ─── Helpers ────────────────────────────────────────────────────

function scheduleEvent(ctx: SimContext, event: SimEvent): void {
	ctx.queue.insert(event);
}

function recordEvent(ctx: SimContext, event: SimEvent): void {
	ctx.events.push(event);
}

function getIdleOhts(ctx: SimContext): SimOht[] {
	const idle: SimOht[] = [];
	for (const oht of ctx.ohts.values()) {
		if (oht.state === OHT_STATES.IDLE) {
			idle.push(oht);
		}
	}
	return idle;
}

function getPendingTransfers(ctx: SimContext): TransferCommand[] {
	const pending: TransferCommand[] = [];
	for (const t of ctx.transfers.values()) {
		if (t.status === TRANSFER_STATUSES.CREATED) {
			pending.push(t);
		}
	}
	pending.sort((a, b) => (a.timestamps.created ?? 0) - (b.timestamps.created ?? 0));
	return pending;
}

function tryDispatch(ctx: SimContext): void {
	const idleOhts = getIdleOhts(ctx);
	const pendingTransfers = getPendingTransfers(ctx);
	if (idleOhts.length === 0 || pendingTransfers.length === 0) return;

	const dispatchConfig: DispatchConfig = {
		idleOhts,
		pendingTransfers,
		adjacency: ctx.adjacency,
		nodes: ctx.nodes,
		edges: ctx.edges,
		portNodeMap: ctx.portNodeMap,
		algorithm: ctx.dispatchAlgorithm as DispatchConfig["algorithm"],
		currentTime: ctx.currentTime,
		defaultMaxSpeed: ctx.ohtMaxSpeed,
	};

	const result = dispatchNext(dispatchConfig);
	if (result) {
		const assignEvent: SimEvent = {
			time: ctx.currentTime,
			type: SIM_EVENT_TYPES.TRANSFER_ASSIGNED,
			entityId: result.transferId,
			data: { ohtId: result.ohtId, pathCost: result.pathCost },
		};
		scheduleEvent(ctx, assignEvent);
	}
}

// ─── Handler: TRANSFER_CREATED ──────────────────────────────────

export function handleTransferCreated(ctx: SimContext, event: SimEvent): void {
	recordEvent(ctx, event);
	tryDispatch(ctx);
}

// ─── Handler: TRANSFER_ASSIGNED ─────────────────────────────────

export function handleTransferAssigned(ctx: SimContext, event: SimEvent): void {
	recordEvent(ctx, event);

	const transferId = event.entityId;
	const ohtId = event.data.ohtId as EntityId;

	const transfer = ctx.transfers.get(transferId);
	const oht = ctx.ohts.get(ohtId);
	if (!transfer || !oht) return;

	// Update transfer state
	transfer.status = TRANSFER_STATUSES.ASSIGNED;
	transfer.timestamps[TRANSFER_STATUSES.ASSIGNED] = ctx.currentTime;
	transfer.ohtId = ohtId;

	// Update OHT state
	oht.state = OHT_STATES.MOVING_TO_LOAD;
	oht.transferId = transferId;

	// Calculate route to source port
	const sourceNodeId = ctx.portNodeMap.get(transfer.sourcePortId);
	if (!sourceNodeId || !oht.currentNodeId) return;

	const route = findPath(
		ctx.adjacency,
		ctx.nodes,
		ctx.edges,
		oht.currentNodeId,
		sourceNodeId,
		ctx.ohtMaxSpeed,
	);

	if (!route.found || route.edgeIds.length === 0) {
		// Already at source — go directly to load
		const arriveEvent: SimEvent = {
			time: ctx.currentTime,
			type: SIM_EVENT_TYPES.OHT_ARRIVE_PORT,
			entityId: ohtId,
			data: { transferId, phase: "load", nodeId: sourceNodeId },
		};
		scheduleEvent(ctx, arriveEvent);
		return;
	}

	transfer.loadRoute = route.path;
	oht.pathEdgeIds = route.edgeIds;
	oht.pathIndex = 0;

	transfer.status = TRANSFER_STATUSES.MOVE_TO_LOAD;
	transfer.timestamps[TRANSFER_STATUSES.MOVE_TO_LOAD] = ctx.currentTime;

	const departEvent: SimEvent = {
		time: ctx.currentTime,
		type: SIM_EVENT_TYPES.OHT_DEPART,
		entityId: ohtId,
		data: { transferId, phase: "load" },
	};
	scheduleEvent(ctx, departEvent);
}

// ─── Handler: OHT_DEPART ────────────────────────────────────────

export function handleOhtDepart(ctx: SimContext, event: SimEvent): void {
	recordEvent(ctx, event);

	const ohtId = event.entityId;
	const oht = ctx.ohts.get(ohtId);
	if (!oht) return;

	scheduleNextSegment(ctx, oht, event.data.phase as string);
}

// ─── Handler: OHT_ARRIVE_POINT ──────────────────────────────────

export function handleOhtArrivePoint(ctx: SimContext, event: SimEvent): void {
	recordEvent(ctx, event);

	const ohtId = event.entityId;
	const oht = ctx.ohts.get(ohtId);
	if (!oht) return;

	const nodeId = event.data.nodeId as EntityId;
	const phase = event.data.phase as string;
	const transferId = event.data.transferId as EntityId;

	// Update OHT position
	oht.currentNodeId = nodeId;
	oht.currentEdgeId = null;
	oht.edgeProgress = 0;

	// Check intersection reservation
	const node = ctx.nodes.get(nodeId);
	const isIntersection =
		node?.type === RAIL_NODE_TYPES.JUNCTION || node?.type === RAIL_NODE_TYPES.MERGE;

	if (isIntersection) {
		const result = ctx.intersectionManager.reserve(ohtId, nodeId, ctx.currentTime);
		if (result === "queued") {
			const waitEvent: SimEvent = {
				time: ctx.currentTime,
				type: SIM_EVENT_TYPES.INTERSECTION_WAIT,
				entityId: ohtId,
				data: { nodeId, transferId, phase },
			};
			recordEvent(ctx, waitEvent);
			return;
		}
	}

	oht.pathIndex++;

	if (oht.pathIndex >= oht.pathEdgeIds.length) {
		if (isIntersection) {
			ctx.intersectionManager.release(ohtId, nodeId);
		}

		const arrivePortEvent: SimEvent = {
			time: ctx.currentTime,
			type: SIM_EVENT_TYPES.OHT_ARRIVE_PORT,
			entityId: ohtId,
			data: { transferId, phase, nodeId },
		};
		scheduleEvent(ctx, arrivePortEvent);
		return;
	}

	if (isIntersection) {
		ctx.intersectionManager.release(ohtId, nodeId);
		checkIntersectionQueue(ctx, nodeId);
	}

	scheduleNextSegment(ctx, oht, phase);
}

// ─── Handler: OHT_ARRIVE_PORT ───────────────────────────────────

export function handleOhtArrivePort(ctx: SimContext, event: SimEvent): void {
	recordEvent(ctx, event);

	const ohtId = event.entityId;
	const transferId = event.data.transferId as EntityId;
	const phase = event.data.phase as string;

	const oht = ctx.ohts.get(ohtId);
	const transfer = ctx.transfers.get(transferId);
	if (!oht || !transfer) return;

	if (phase === "load") {
		// Arrived at source — start loading
		transfer.status = TRANSFER_STATUSES.ARRIVE_AT_SOURCE;
		transfer.timestamps[TRANSFER_STATUSES.ARRIVE_AT_SOURCE] = ctx.currentTime;

		oht.state = OHT_STATES.LOADING;

		const loadStartEvent: SimEvent = {
			time: ctx.currentTime,
			type: SIM_EVENT_TYPES.TRANSFER_LOAD_START,
			entityId: transferId,
			data: { ohtId },
		};
		recordEvent(ctx, loadStartEvent);

		transfer.status = TRANSFER_STATUSES.LOADING;
		transfer.timestamps[TRANSFER_STATUSES.LOADING] = ctx.currentTime;

		const loadDoneEvent: SimEvent = {
			time: ctx.currentTime + ctx.loadDuration,
			type: SIM_EVENT_TYPES.TRANSFER_LOAD_DONE,
			entityId: transferId,
			data: { ohtId },
		};
		scheduleEvent(ctx, loadDoneEvent);
	} else {
		// Arrived at destination — start unloading
		transfer.status = TRANSFER_STATUSES.ARRIVE_AT_DEST;
		transfer.timestamps[TRANSFER_STATUSES.ARRIVE_AT_DEST] = ctx.currentTime;

		oht.state = OHT_STATES.UNLOADING;

		const unloadStartEvent: SimEvent = {
			time: ctx.currentTime,
			type: SIM_EVENT_TYPES.TRANSFER_UNLOAD_START,
			entityId: transferId,
			data: { ohtId },
		};
		recordEvent(ctx, unloadStartEvent);

		transfer.status = TRANSFER_STATUSES.UNLOADING;
		transfer.timestamps[TRANSFER_STATUSES.UNLOADING] = ctx.currentTime;

		const unloadDoneEvent: SimEvent = {
			time: ctx.currentTime + ctx.unloadDuration,
			type: SIM_EVENT_TYPES.TRANSFER_UNLOAD_DONE,
			entityId: transferId,
			data: { ohtId },
		};
		scheduleEvent(ctx, unloadDoneEvent);
	}
}

// ─── Handler: TRANSFER_LOAD_DONE ────────────────────────────────

export function handleTransferLoadDone(ctx: SimContext, event: SimEvent): void {
	recordEvent(ctx, event);

	const transferId = event.entityId;
	const ohtId = event.data.ohtId as EntityId;

	const transfer = ctx.transfers.get(transferId);
	const oht = ctx.ohts.get(ohtId);
	if (!transfer || !oht) return;

	// FOUP is now on the OHT
	transfer.status = TRANSFER_STATUSES.LOAD_DONE;
	transfer.timestamps[TRANSFER_STATUSES.LOAD_DONE] = ctx.currentTime;

	oht.foupId = transfer.foupId;
	oht.state = OHT_STATES.MOVING_TO_UNLOAD;

	// Calculate route to destination port
	const destNodeId = ctx.portNodeMap.get(transfer.destPortId);
	if (!destNodeId || !oht.currentNodeId) return;

	const route = findPath(
		ctx.adjacency,
		ctx.nodes,
		ctx.edges,
		oht.currentNodeId,
		destNodeId,
		ctx.ohtMaxSpeed,
	);

	transfer.status = TRANSFER_STATUSES.MOVE_TO_UNLOAD;
	transfer.timestamps[TRANSFER_STATUSES.MOVE_TO_UNLOAD] = ctx.currentTime;

	if (!route.found || route.edgeIds.length === 0) {
		const arriveEvent: SimEvent = {
			time: ctx.currentTime,
			type: SIM_EVENT_TYPES.OHT_ARRIVE_PORT,
			entityId: ohtId,
			data: { transferId, phase: "unload", nodeId: destNodeId },
		};
		scheduleEvent(ctx, arriveEvent);
		return;
	}

	transfer.unloadRoute = route.path;
	oht.pathEdgeIds = route.edgeIds;
	oht.pathIndex = 0;

	const departEvent: SimEvent = {
		time: ctx.currentTime,
		type: SIM_EVENT_TYPES.OHT_DEPART,
		entityId: ohtId,
		data: { transferId, phase: "unload" },
	};
	scheduleEvent(ctx, departEvent);
}

// ─── Handler: TRANSFER_UNLOAD_DONE ──────────────────────────────

export function handleTransferUnloadDone(ctx: SimContext, event: SimEvent): void {
	recordEvent(ctx, event);

	const transferId = event.entityId;
	const ohtId = event.data.ohtId as EntityId;

	const transfer = ctx.transfers.get(transferId);
	const oht = ctx.ohts.get(ohtId);
	if (!transfer || !oht) return;

	// Transfer complete
	transfer.status = TRANSFER_STATUSES.UNLOAD_DONE;
	transfer.timestamps[TRANSFER_STATUSES.UNLOAD_DONE] = ctx.currentTime;

	// Release OHT
	oht.state = OHT_STATES.IDLE;
	oht.foupId = null;
	oht.transferId = null;
	oht.pathEdgeIds = [];
	oht.pathIndex = 0;

	tryDispatch(ctx);
}

// ─── Handler: INTERSECTION_RELEASE ──────────────────────────────

export function handleIntersectionRelease(ctx: SimContext, event: SimEvent): void {
	recordEvent(ctx, event);
	const nodeId = event.data.nodeId as EntityId;
	checkIntersectionQueue(ctx, nodeId);
}

// ─── Internal Helpers ───────────────────────────────────────────

function scheduleNextSegment(ctx: SimContext, oht: SimOht, phase: string): void {
	const edgeId = oht.pathEdgeIds[oht.pathIndex];
	if (edgeId === undefined) return;

	const edge = ctx.edges.get(edgeId);
	if (!edge) return;

	const travelTime = calcSegmentTravelTime(
		edge,
		ctx.ohtMaxSpeed,
		ctx.acceleration,
		ctx.deceleration,
	);

	oht.currentEdgeId = edgeId;
	oht.currentNodeId = null;
	oht.edgeProgress = 0;

	const arriveEvent: SimEvent = {
		time: ctx.currentTime + travelTime,
		type: SIM_EVENT_TYPES.OHT_ARRIVE_POINT,
		entityId: oht.id,
		data: {
			nodeId: edge.toNodeId,
			edgeId,
			transferId: oht.transferId ?? "",
			phase,
		},
	};
	scheduleEvent(ctx, arriveEvent);
}

function checkIntersectionQueue(ctx: SimContext, nodeId: EntityId): void {
	const nextVehicleId = ctx.intersectionManager.getNextInQueue(nodeId);
	if (!nextVehicleId) return;

	const oht = ctx.ohts.get(nextVehicleId);
	if (!oht) return;

	const phase =
		oht.state === OHT_STATES.MOVING_TO_LOAD
			? "load"
			: oht.state === OHT_STATES.MOVING_TO_UNLOAD
				? "unload"
				: "load";

	oht.pathIndex++;

	if (oht.pathIndex >= oht.pathEdgeIds.length) {
		ctx.intersectionManager.release(nextVehicleId, nodeId);
		const arrivePortEvent: SimEvent = {
			time: ctx.currentTime,
			type: SIM_EVENT_TYPES.OHT_ARRIVE_PORT,
			entityId: nextVehicleId,
			data: { transferId: oht.transferId ?? "", phase, nodeId },
		};
		scheduleEvent(ctx, arrivePortEvent);
	} else {
		ctx.intersectionManager.release(nextVehicleId, nodeId);
		scheduleNextSegment(ctx, oht, phase);
	}
}
