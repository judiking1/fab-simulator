import type { Equipment } from "@/models/equipment";
import type { Foup } from "@/models/foup";
import { OHT_STATES } from "@/models/oht";
import type { RailEdge, RailNode } from "@/models/rail";
import { RAIL_NODE_TYPES } from "@/models/rail";
import {
	createTransferCommand,
	getDeliveryTime,
	getLeadTime,
	getQueueTime,
	getWaitTime,
} from "@/models/transfer";
import type { EntityId } from "@/types/common";
import type { KpiSummary, OhtSnapshot, SimEvent, SimResult, SimSnapshot } from "@/types/simulation";
import { SIM_EVENT_TYPES } from "@/types/simulation";
import { IntersectionManager } from "../algorithms/intersectionManager";
import type { SimContext, SimOht } from "./eventHandlers";
import {
	handleIntersectionRelease,
	handleOhtArrivePoint,
	handleOhtArrivePort,
	handleOhtDepart,
	handleTransferAssigned,
	handleTransferCreated,
	handleTransferLoadDone,
	handleTransferUnloadDone,
} from "./eventHandlers";
import { PriorityQueue } from "./priorityQueue";
import { SimulationClock } from "./simulationClock";

// ─── DES Engine ─────────────────────────────────────────────────
// Discrete Event Simulation engine for OHT transfer logistics.
// Runs to completion in batch mode (Web Worker), producing an
// event log and position snapshots for 3D playback.

export interface DesEngineConfig {
	/** Maximum events to process (safety limit). Default: 10_000_000 */
	maxEvents: number;
	/** Seconds between position snapshots. Default: 0.1 */
	snapshotInterval: number;
	/** Callback for progress updates */
	progressCallback?: (progress: number, eventsProcessed: number, simTime: number) => void;
	/** Events between progress callbacks. Default: 1000 */
	progressInterval: number;
}

/** Layout data passed to initialize the engine */
export interface LayoutData {
	equipment: Record<EntityId, Equipment>;
	railNodes: Record<EntityId, RailNode>;
	railEdges: Record<EntityId, RailEdge>;
	foups: Record<EntityId, Foup>;
}

/** Simulation configuration */
export interface SimConfig {
	ohtCount: number;
	ohtSpeed: number;
	loadDuration: number;
	unloadDuration: number;
	dispatchingAlgorithm: string;
	simulationDuration: number;
	seed: number;
	/** Acceleration in m/s^2 (default 1.5) */
	acceleration: number;
	/** Deceleration in m/s^2 (default 1.5) */
	deceleration: number;
}

const DEFAULT_ENGINE_CONFIG: DesEngineConfig = {
	maxEvents: 10_000_000,
	snapshotInterval: 0.1,
	progressInterval: 1000,
};

export class DesEngine {
	private clock = new SimulationClock();
	private queue = new PriorityQueue();
	private config: DesEngineConfig;

	// Simulation state
	private ohts = new Map<EntityId, SimOht>();
	private transfers = new Map<EntityId, import("@/models/transfer").TransferCommand>();
	private equipment = new Map<EntityId, Equipment>();
	private nodes = new Map<EntityId, RailNode>();
	private edges = new Map<EntityId, RailEdge>();
	private adjacency = new Map<EntityId, EntityId[]>();
	private portNodeMap = new Map<EntityId, EntityId>();
	private intersectionManager = new IntersectionManager();

	// Config
	private simConfig: SimConfig | null = null;

	// Output
	private events: SimEvent[] = [];
	private snapshots: SimSnapshot[] = [];

	// PRNG state
	private rngState = 0;

	constructor(engineConfig?: Partial<DesEngineConfig>) {
		this.config = { ...DEFAULT_ENGINE_CONFIG, ...engineConfig };
	}

	/** Initialize the engine with layout data and simulation parameters. */
	initialize(layout: LayoutData, simConfig: SimConfig): void {
		this.simConfig = simConfig;
		this.clock.reset();
		this.queue.clear();
		this.events = [];
		this.snapshots = [];
		this.intersectionManager.clear();

		this.rngState = simConfig.seed === 0 ? Date.now() : simConfig.seed;

		// Load equipment
		this.equipment.clear();
		for (const eq of Object.values(layout.equipment)) {
			this.equipment.set(eq.id, eq);
		}

		// Build rail graph
		this.nodes.clear();
		this.edges.clear();
		this.adjacency.clear();

		for (const node of Object.values(layout.railNodes)) {
			this.nodes.set(node.id, node);
			this.adjacency.set(node.id, []);
		}

		for (const edge of Object.values(layout.railEdges)) {
			this.edges.set(edge.id, edge);
			const outgoing = this.adjacency.get(edge.fromNodeId);
			if (outgoing) {
				outgoing.push(edge.id);
			}
		}

		// Build port -> node mapping from port nodes
		this.portNodeMap.clear();
		for (const node of this.nodes.values()) {
			if (node.type === RAIL_NODE_TYPES.PORT && node.equipmentId) {
				const eq = this.equipment.get(node.equipmentId);
				if (eq) {
					for (const port of eq.ports) {
						if (!port.railNodeId) {
							this.portNodeMap.set(port.id, node.id);
						}
					}
				}
			}
		}

		// Also use explicit port.railNodeId mappings
		for (const eq of this.equipment.values()) {
			for (const port of eq.ports) {
				if (port.railNodeId && !this.portNodeMap.has(port.id)) {
					this.portNodeMap.set(port.id, port.railNodeId);
				}
			}
		}

		// Place OHTs at initial positions
		this.ohts.clear();
		this.transfers.clear();
		const nodeIds = Array.from(this.nodes.keys());
		if (nodeIds.length > 0) {
			for (let i = 0; i < simConfig.ohtCount; i++) {
				const nodeIndex = i % nodeIds.length;
				const nodeId = nodeIds[nodeIndex];
				if (!nodeId) continue;
				const ohtId = `oht-${i}`;
				const oht: SimOht = {
					id: ohtId,
					name: `OHT-${i + 1}`,
					state: OHT_STATES.IDLE,
					speed: 0,
					maxSpeed: simConfig.ohtSpeed,
					acceleration: simConfig.acceleration,
					deceleration: simConfig.deceleration,
					curveSpeedFactor: 1.0,
					currentEdgeId: null,
					currentNodeId: nodeId,
					edgeProgress: 0,
					foupId: null,
					transferId: null,
					pathEdgeIds: [],
					pathIndex: 0,
				};
				this.ohts.set(ohtId, oht);
			}
		}

		// Generate transfer commands
		this.generateTransfers(simConfig);
	}

	/** Run the simulation to completion. */
	run(): SimResult {
		if (!this.simConfig) {
			throw new Error("Engine not initialized. Call initialize() first.");
		}

		const { maxEvents, snapshotInterval, progressCallback, progressInterval } = this.config;
		const duration = this.simConfig.simulationDuration;
		let nextSnapshotTime = 0;
		let eventsSinceProgress = 0;

		// Initial snapshot
		this.snapshots.push(this.captureSnapshot(0));

		while (!this.queue.isEmpty) {
			const event = this.queue.extractMin();
			if (!event) break;

			if (event.time > duration) break;
			if (this.clock.eventsProcessed >= maxEvents) break;

			this.clock.advanceTo(event.time);
			this.clock.recordEvent();

			// Capture snapshots at intervals
			while (nextSnapshotTime <= event.time) {
				this.snapshots.push(this.captureSnapshot(nextSnapshotTime));
				nextSnapshotTime += snapshotInterval;
			}

			const ctx = this.buildContext();
			this.dispatchEvent(ctx, event);

			eventsSinceProgress++;
			if (progressCallback && eventsSinceProgress >= progressInterval) {
				const progress = Math.min(100, (event.time / duration) * 100);
				progressCallback(progress, this.clock.eventsProcessed, event.time);
				eventsSinceProgress = 0;
			}
		}

		// Final snapshot
		const finalTime = Math.min(this.clock.currentTime, duration);
		this.snapshots.push(this.captureSnapshot(finalTime));

		if (this.config.progressCallback) {
			this.config.progressCallback(100, this.clock.eventsProcessed, finalTime);
		}

		return {
			events: this.events,
			snapshots: this.snapshots,
			duration: finalTime,
			kpiSummary: this.computeKpi(),
		};
	}

	// ─── Private Methods ──────────────────────────────────────────

	private buildContext(): SimContext {
		return {
			queue: this.queue,
			currentTime: this.clock.currentTime,
			ohts: this.ohts,
			transfers: this.transfers,
			equipment: this.equipment,
			nodes: this.nodes,
			edges: this.edges,
			adjacency: this.adjacency,
			portNodeMap: this.portNodeMap,
			intersectionManager: this.intersectionManager,
			dispatchAlgorithm: this.simConfig?.dispatchingAlgorithm ?? "fifo",
			loadDuration: this.simConfig?.loadDuration ?? 10,
			unloadDuration: this.simConfig?.unloadDuration ?? 10,
			ohtMaxSpeed: this.simConfig?.ohtSpeed ?? 5,
			acceleration: this.simConfig?.acceleration ?? 1.5,
			deceleration: this.simConfig?.deceleration ?? 1.5,
			events: this.events,
		};
	}

	private dispatchEvent(ctx: SimContext, event: SimEvent): void {
		switch (event.type) {
			case SIM_EVENT_TYPES.TRANSFER_CREATED:
				handleTransferCreated(ctx, event);
				break;
			case SIM_EVENT_TYPES.TRANSFER_ASSIGNED:
				handleTransferAssigned(ctx, event);
				break;
			case SIM_EVENT_TYPES.OHT_DEPART:
				handleOhtDepart(ctx, event);
				break;
			case SIM_EVENT_TYPES.OHT_ARRIVE_POINT:
				handleOhtArrivePoint(ctx, event);
				break;
			case SIM_EVENT_TYPES.OHT_ARRIVE_PORT:
				handleOhtArrivePort(ctx, event);
				break;
			case SIM_EVENT_TYPES.TRANSFER_LOAD_DONE:
				handleTransferLoadDone(ctx, event);
				break;
			case SIM_EVENT_TYPES.TRANSFER_UNLOAD_DONE:
				handleTransferUnloadDone(ctx, event);
				break;
			case SIM_EVENT_TYPES.INTERSECTION_RELEASE:
				handleIntersectionRelease(ctx, event);
				break;
			default:
				this.events.push(event);
				break;
		}
	}

	private captureSnapshot(time: number): SimSnapshot {
		const ohtPositions: Record<EntityId, OhtSnapshot> = {};
		const transferStates: Record<EntityId, import("@/models/transfer").TransferStatus> = {};

		for (const oht of this.ohts.values()) {
			ohtPositions[oht.id] = {
				edgeId: oht.currentEdgeId ?? oht.currentNodeId ?? "",
				ratio: oht.edgeProgress,
				speed: oht.speed,
				state: oht.state,
				foupId: oht.foupId,
			};
		}

		for (const transfer of this.transfers.values()) {
			transferStates[transfer.id] = transfer.status;
		}

		return { time, ohtPositions, transferStates };
	}

	private generateTransfers(simConfig: SimConfig): void {
		const equipmentWithPorts: Array<{ eqId: EntityId; portId: EntityId }> = [];

		for (const eq of this.equipment.values()) {
			for (const port of eq.ports) {
				if (this.portNodeMap.has(port.id)) {
					equipmentWithPorts.push({ eqId: eq.id, portId: port.id });
				}
			}
		}

		if (equipmentWithPorts.length < 2) return;

		// Generate transfers at a rate based on equipment count and duration
		const transferRate = Math.max(
			1,
			Math.floor(simConfig.simulationDuration / (equipmentWithPorts.length * 5)),
		);
		const numTransfers = Math.min(Math.floor(simConfig.simulationDuration / transferRate), 10000);

		for (let i = 0; i < numTransfers; i++) {
			const time = i * transferRate + this.pseudoRandom() * transferRate * 0.5;
			if (time >= simConfig.simulationDuration) break;

			const srcIdx = Math.floor(this.pseudoRandom() * equipmentWithPorts.length);
			let destIdx = Math.floor(this.pseudoRandom() * (equipmentWithPorts.length - 1));
			if (destIdx >= srcIdx) destIdx++;

			const src = equipmentWithPorts[srcIdx];
			const dest = equipmentWithPorts[destIdx];
			if (!src || !dest) continue;

			const transferId = `transfer-${i}`;
			const foupId = `foup-${i}`;

			const transfer = createTransferCommand(
				transferId,
				foupId,
				src.eqId,
				src.portId,
				dest.eqId,
				dest.portId,
				time,
			);
			this.transfers.set(transferId, transfer);

			const event: SimEvent = {
				time,
				type: SIM_EVENT_TYPES.TRANSFER_CREATED,
				entityId: transferId,
				data: { sourceEquipmentId: src.eqId, destEquipmentId: dest.eqId },
			};
			this.queue.insert(event);
		}
	}

	/** Simple seeded PRNG (xorshift32). Returns value in [0, 1). */
	private pseudoRandom(): number {
		let x = this.rngState;
		x ^= x << 13;
		x ^= x >> 17;
		x ^= x << 5;
		this.rngState = x;
		// Use unsigned right shift to get positive 32-bit value
		return (x >>> 0) / 4294967296;
	}

	private computeKpi(): KpiSummary {
		const leadTimes: number[] = [];
		const queueTimes: number[] = [];
		const waitTimes: number[] = [];
		const deliveryTimes: number[] = [];
		let completedCount = 0;

		for (const transfer of this.transfers.values()) {
			const lt = getLeadTime(transfer);
			if (lt != null && lt >= 0) {
				leadTimes.push(lt);
				completedCount++;
			}

			const qt = getQueueTime(transfer);
			if (qt != null && qt >= 0) queueTimes.push(qt);

			const wt = getWaitTime(transfer);
			if (wt != null && wt >= 0) waitTimes.push(wt);

			const dt = getDeliveryTime(transfer);
			if (dt != null && dt >= 0) deliveryTimes.push(dt);
		}

		const duration = this.simConfig?.simulationDuration ?? 1;
		const ohtCount = this.ohts.size;

		const avgLeadTime = computeStats(leadTimes).avg;
		const totalBusyTime = completedCount * avgLeadTime;
		const totalAvailableTime = ohtCount * duration;
		const utilization =
			totalAvailableTime > 0 ? Math.max(0, Math.min(1, totalBusyTime / totalAvailableTime)) : 0;

		const throughput = duration > 0 ? (completedCount / duration) * 3600 : 0;

		return {
			leadTime: computeStats(leadTimes),
			queueTime: computeStats(queueTimes),
			waitTime: computeStats(waitTimes),
			deliveryTime: computeStats(deliveryTimes),
			utilization,
			throughput,
			totalTransfers: this.transfers.size,
			completedTransfers: completedCount,
		};
	}
}

// ─── Statistics Helper ──────────────────────────────────────────

function computeStats(values: number[]): {
	avg: number;
	min: number;
	max: number;
	p95: number;
} {
	if (values.length === 0) {
		return { avg: 0, min: 0, max: 0, p95: 0 };
	}

	const sorted = [...values].sort((a, b) => a - b);
	const sum = sorted.reduce((acc, v) => acc + v, 0);
	const avg = sum / sorted.length;
	const min = sorted[0] ?? 0;
	const max = sorted[sorted.length - 1] ?? 0;
	const p95Index = Math.floor(sorted.length * 0.95);
	const p95 = sorted[Math.min(p95Index, sorted.length - 1)] ?? 0;

	return { avg, min, max, p95 };
}
