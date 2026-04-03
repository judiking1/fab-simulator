import { describe, expect, it } from "vitest";
import { findPath } from "@/core/algorithms/router";
import type { RailEdge, RailNode } from "@/models/rail";
import type { EntityId } from "@/types/common";

function makeNode(id: string, x: number, z: number): RailNode {
	return { id, fabId: "F1", type: "waypoint", position: { x, y: 0, z }, equipmentId: null };
}

function makeEdge(id: string, from: string, to: string, distance: number, maxSpeed = 5): RailEdge {
	return {
		id,
		fabId: "F1",
		fromNodeId: from,
		toNodeId: to,
		distance,
		maxSpeed,
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

function buildGraph(nodeList: RailNode[], edgeList: RailEdge[]) {
	const nodes = new Map<EntityId, RailNode>();
	const edges = new Map<EntityId, RailEdge>();
	const adjacency = new Map<EntityId, EntityId[]>();

	for (const n of nodeList) {
		nodes.set(n.id, n);
		adjacency.set(n.id, []);
	}
	for (const e of edgeList) {
		edges.set(e.id, e);
		adjacency.get(e.fromNodeId)?.push(e.id);
	}
	return { nodes, edges, adjacency };
}

describe("router (A*)", () => {
	it("should find a simple path A->B->C", () => {
		const nodes = [makeNode("A", 0, 0), makeNode("B", 10, 0), makeNode("C", 20, 0)];
		const edges = [makeEdge("e1", "A", "B", 10), makeEdge("e2", "B", "C", 10)];
		const { nodes: nm, edges: em, adjacency } = buildGraph(nodes, edges);

		const result = findPath(adjacency, nm, em, "A", "C");

		expect(result.found).toBe(true);
		expect(result.path).toEqual(["A", "B", "C"]);
		expect(result.edgeIds).toEqual(["e1", "e2"]);
		expect(result.cost).toBeGreaterThan(0);
	});

	it("should return not found for disconnected graph", () => {
		const nodes = [makeNode("A", 0, 0), makeNode("B", 10, 0), makeNode("C", 20, 0)];
		const edges = [makeEdge("e1", "A", "B", 10)];
		const { nodes: nm, edges: em, adjacency } = buildGraph(nodes, edges);

		const result = findPath(adjacency, nm, em, "A", "C");

		expect(result.found).toBe(false);
		expect(result.path).toEqual([]);
	});

	it("should prefer faster edges (lower cost = distance/maxSpeed)", () => {
		const nodes = [
			makeNode("A", 0, 0),
			makeNode("B", 5, 0),
			makeNode("C", 5, 10),
			makeNode("D", 10, 0),
		];
		const edges = [
			makeEdge("e1", "A", "B", 5, 1), // slow: cost = 5
			makeEdge("e2", "B", "D", 5, 1), // slow: cost = 5
			makeEdge("e3", "A", "C", 12, 10), // fast: cost = 1.2
			makeEdge("e4", "C", "D", 12, 10), // fast: cost = 1.2
		];
		const { nodes: nm, edges: em, adjacency } = buildGraph(nodes, edges);

		const result = findPath(adjacency, nm, em, "A", "D");

		expect(result.found).toBe(true);
		expect(result.path).toEqual(["A", "C", "D"]);
	});

	it("should handle same source and target", () => {
		const nodes = [makeNode("A", 0, 0)];
		const { nodes: nm, edges: em, adjacency } = buildGraph(nodes, []);

		const result = findPath(adjacency, nm, em, "A", "A");

		expect(result.found).toBe(true);
		expect(result.path).toEqual(["A"]);
		expect(result.edgeIds).toEqual([]);
		expect(result.cost).toBe(0);
	});

	it("should find shortest time path among multiple options", () => {
		const nodes = [makeNode("A", 0, 0), makeNode("B", 10, 0), makeNode("C", 0, 5)];
		const edges = [
			makeEdge("e1", "A", "B", 10, 10), // cost = 1
			makeEdge("e2", "A", "C", 5, 1), // cost = 5
			makeEdge("e3", "C", "B", 12, 1), // cost = 12
		];
		const { nodes: nm, edges: em, adjacency } = buildGraph(nodes, edges);

		const result = findPath(adjacency, nm, em, "A", "B");

		expect(result.found).toBe(true);
		expect(result.path).toEqual(["A", "B"]);
	});
});
