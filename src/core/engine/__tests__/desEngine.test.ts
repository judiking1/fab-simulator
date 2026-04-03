import { describe, expect, it } from "vitest";
import type { LayoutData, SimConfig } from "@/core/engine/desEngine";
import { DesEngine } from "@/core/engine/desEngine";
import type { Equipment } from "@/models/equipment";
import type { RailEdge, RailNode } from "@/models/rail";
import type { EntityId } from "@/types/common";

// ─── Test Helpers ───────────────────────────────────────────────

function makeNode(id: string, x: number, z: number, overrides: Partial<RailNode> = {}): RailNode {
	return {
		id,
		fabId: "F1",
		type: "waypoint",
		position: { x, y: 0, z },
		equipmentId: null,
		...overrides,
	};
}

function makeEdge(id: string, from: string, to: string, distance: number): RailEdge {
	return {
		id,
		fabId: "F1",
		fromNodeId: from,
		toNodeId: to,
		distance,
		maxSpeed: 5,
		lineType: "straight",
		isConfluence: false,
		isBranch: false,
		bayId: null,
		density: 0,
		weight: 1.0,
		enabled: true,
		curveRadius: null,
	};
}

function makeEquipment(id: string, portId: string): Equipment {
	return {
		id,
		moduleId: "mod-1",
		name: `Equipment ${id}`,
		type: "process",
		processTime: 60,
		position: { x: 0, y: 0, z: 0 },
		ports: [
			{
				id: portId,
				railNodeId: null,
				hasFoup: true,
				foupId: null,
				position: { x: 0, y: 0, z: 0 },
				portType: "bidirectional",
			},
		],
	};
}

/**
 * Mini test scenario:
 * - 5 nodes forming a loop: N1 -> N2 -> N3 -> N4 -> N5 -> N1
 * - 2 port nodes (N2, N4) attached to equipment
 * - 2 equipment with ports
 */
function buildMiniScenario(): { layout: LayoutData; simConfig: SimConfig } {
	const railNodes: Record<EntityId, RailNode> = {
		N1: makeNode("N1", 0, 0),
		N2: makeNode("N2", 10, 0, { type: "port", equipmentId: "EQ1" }),
		N3: makeNode("N3", 20, 0),
		N4: makeNode("N4", 20, 10, { type: "port", equipmentId: "EQ2" }),
		N5: makeNode("N5", 0, 10),
	};

	const railEdges: Record<EntityId, RailEdge> = {
		E1: makeEdge("E1", "N1", "N2", 10),
		E2: makeEdge("E2", "N2", "N3", 10),
		E3: makeEdge("E3", "N3", "N4", 10),
		E4: makeEdge("E4", "N4", "N5", 20),
		E5: makeEdge("E5", "N5", "N1", 10),
	};

	const equipment: Record<EntityId, Equipment> = {
		EQ1: makeEquipment("EQ1", "P1"),
		EQ2: makeEquipment("EQ2", "P2"),
	};

	const layout: LayoutData = {
		equipment,
		railNodes,
		railEdges,
		foups: {},
	};

	const simConfig: SimConfig = {
		ohtCount: 2,
		ohtSpeed: 5,
		loadDuration: 5,
		unloadDuration: 5,
		dispatchingAlgorithm: "fifo",
		simulationDuration: 120,
		seed: 42,
		acceleration: 1.5,
		deceleration: 1.5,
	};

	return { layout, simConfig };
}

describe("DesEngine", () => {
	it("should initialize without errors", () => {
		const engine = new DesEngine();
		const { layout, simConfig } = buildMiniScenario();

		expect(() => engine.initialize(layout, simConfig)).not.toThrow();
	});

	it("should run a mini simulation to completion", () => {
		const engine = new DesEngine({ snapshotInterval: 1 });
		const { layout, simConfig } = buildMiniScenario();

		engine.initialize(layout, simConfig);
		const result = engine.run();

		expect(result.events.length).toBeGreaterThan(0);
		expect(result.snapshots.length).toBeGreaterThan(0);
		expect(result.duration).toBeLessThanOrEqual(simConfig.simulationDuration);
		expect(result.duration).toBeGreaterThanOrEqual(0);
		expect(result.kpiSummary.totalTransfers).toBeGreaterThan(0);
	});

	it("should complete some transfers in a sufficient duration", () => {
		const engine = new DesEngine({ snapshotInterval: 10 });
		const { layout, simConfig } = buildMiniScenario();
		simConfig.simulationDuration = 300;

		engine.initialize(layout, simConfig);
		const result = engine.run();

		// Should have generated transfers
		expect(result.kpiSummary.totalTransfers).toBeGreaterThan(0);

		// Should have produced events
		expect(result.events.length).toBeGreaterThan(0);

		// Throughput and utilization should be non-negative
		expect(result.kpiSummary.throughput).toBeGreaterThanOrEqual(0);
		expect(result.kpiSummary.utilization).toBeGreaterThanOrEqual(0);
		expect(result.kpiSummary.utilization).toBeLessThanOrEqual(1);
	});

	it("should record snapshots at the configured interval", () => {
		const engine = new DesEngine({ snapshotInterval: 5 });
		const { layout, simConfig } = buildMiniScenario();
		simConfig.simulationDuration = 60;

		engine.initialize(layout, simConfig);
		const result = engine.run();

		expect(result.snapshots.length).toBeGreaterThanOrEqual(2);
		expect(result.snapshots[0]?.time).toBe(0);

		for (let i = 1; i < result.snapshots.length; i++) {
			const prev = result.snapshots[i - 1];
			const curr = result.snapshots[i];
			if (prev && curr) {
				expect(curr.time).toBeGreaterThanOrEqual(prev.time);
			}
		}
	});

	it("should call progress callback during simulation", () => {
		const progressCalls: Array<{ progress: number; events: number; time: number }> = [];

		const engine = new DesEngine({
			snapshotInterval: 10,
			progressInterval: 5,
			progressCallback: (progress, events, time) => {
				progressCalls.push({ progress, events, time });
			},
		});

		const { layout, simConfig } = buildMiniScenario();
		engine.initialize(layout, simConfig);
		engine.run();

		expect(progressCalls.length).toBeGreaterThan(0);

		const last = progressCalls[progressCalls.length - 1];
		expect(last?.progress).toBe(100);
	});

	it("should throw if run() called without initialize()", () => {
		const engine = new DesEngine();
		expect(() => engine.run()).toThrow("Engine not initialized");
	});

	it("should respect maxEvents safety limit", () => {
		const engine = new DesEngine({ maxEvents: 50, snapshotInterval: 100 });
		const { layout, simConfig } = buildMiniScenario();

		engine.initialize(layout, simConfig);
		const result = engine.run();

		expect(result.events.length).toBeLessThanOrEqual(200);
	});
});
