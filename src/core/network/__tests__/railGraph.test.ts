import { describe, expect, it } from "vitest";
import {
	buildRailGraph,
	findShortestPath,
	getConnectedComponents,
	isGraphConnected,
} from "@/core/network/railGraph";
import type { RailEdge, RailNode } from "@/models/rail";

function makeNode(id: string, x: number, z: number): RailNode {
	return { id, fabId: "F1", type: "waypoint", position: { x, y: 0, z }, equipmentId: null };
}

function makeEdge(id: string, from: string, to: string, distance: number): RailEdge {
	return { id, fabId: "F1", fromNodeId: from, toNodeId: to, distance, maxSpeed: 5 };
}

describe("buildRailGraph", () => {
	it("builds adjacency from nodes and edges", () => {
		const nodes = { A: makeNode("A", 0, 0), B: makeNode("B", 10, 0) };
		const edges = { E1: makeEdge("E1", "A", "B", 10) };

		const graph = buildRailGraph(nodes, edges);

		expect(graph.nodes.size).toBe(2);
		expect(graph.edges.size).toBe(1);
		expect(graph.adjacency.get("A")).toEqual(["E1"]);
		expect(graph.adjacency.get("B")).toEqual([]);
		expect(graph.reverseAdjacency.get("B")).toEqual(["E1"]);
	});
});

describe("connectivity", () => {
	it("detects connected graph", () => {
		const nodes = {
			A: makeNode("A", 0, 0),
			B: makeNode("B", 10, 0),
			C: makeNode("C", 20, 0),
		};
		const edges = {
			E1: makeEdge("E1", "A", "B", 10),
			E2: makeEdge("E2", "B", "C", 10),
		};
		const graph = buildRailGraph(nodes, edges);

		expect(isGraphConnected(graph)).toBe(true);
		expect(getConnectedComponents(graph)).toHaveLength(1);
	});

	it("detects disconnected graph", () => {
		const nodes = {
			A: makeNode("A", 0, 0),
			B: makeNode("B", 10, 0),
			C: makeNode("C", 100, 0),
		};
		const edges = {
			E1: makeEdge("E1", "A", "B", 10),
		};
		const graph = buildRailGraph(nodes, edges);

		expect(isGraphConnected(graph)).toBe(false);
		expect(getConnectedComponents(graph)).toHaveLength(2);
	});

	it("empty graph is connected", () => {
		const graph = buildRailGraph({}, {});
		expect(isGraphConnected(graph)).toBe(true);
	});
});

describe("findShortestPath", () => {
	it("finds direct path", () => {
		const nodes = { A: makeNode("A", 0, 0), B: makeNode("B", 10, 0) };
		const edges = { E1: makeEdge("E1", "A", "B", 10) };
		const graph = buildRailGraph(nodes, edges);

		const path = findShortestPath(graph, "A", "B");
		expect(path).not.toBeNull();
		expect(path?.nodeIds).toEqual(["A", "B"]);
		expect(path?.edgeIds).toEqual(["E1"]);
		expect(path?.totalDistance).toBe(10);
	});

	it("finds shortest among multiple paths", () => {
		const nodes = {
			A: makeNode("A", 0, 0),
			B: makeNode("B", 5, 0),
			C: makeNode("C", 10, 0),
		};
		const edges = {
			direct: makeEdge("direct", "A", "C", 100), // long direct
			AB: makeEdge("AB", "A", "B", 5),
			BC: makeEdge("BC", "B", "C", 5),
		};
		const graph = buildRailGraph(nodes, edges);

		const path = findShortestPath(graph, "A", "C");
		expect(path?.totalDistance).toBe(10);
		expect(path?.nodeIds).toEqual(["A", "B", "C"]);
	});

	it("returns null for unreachable target", () => {
		const nodes = { A: makeNode("A", 0, 0), B: makeNode("B", 10, 0) };
		// Edge goes B→A, not A→B (directed!)
		const edges = { E1: makeEdge("E1", "B", "A", 10) };
		const graph = buildRailGraph(nodes, edges);

		const path = findShortestPath(graph, "A", "B");
		expect(path).toBeNull();
	});

	it("returns same-node path for source === target", () => {
		const nodes = { A: makeNode("A", 0, 0) };
		const graph = buildRailGraph(nodes, {});

		const path = findShortestPath(graph, "A", "A");
		expect(path?.nodeIds).toEqual(["A"]);
		expect(path?.totalDistance).toBe(0);
	});

	it("returns null for non-existent node", () => {
		const graph = buildRailGraph({}, {});
		expect(findShortestPath(graph, "X", "Y")).toBeNull();
	});
});
