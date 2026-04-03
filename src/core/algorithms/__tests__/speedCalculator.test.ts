import { describe, expect, it } from "vitest";
import {
	calcSegmentTravelTime,
	calcStoppingDistance,
	calcTravelTime,
} from "@/core/algorithms/speedCalculator";
import type { RailEdge } from "@/models/rail";

describe("speedCalculator", () => {
	describe("calcTravelTime", () => {
		it("should return 0 for zero distance", () => {
			const result = calcTravelTime(0, 5, 1.5, 1.5);
			expect(result.totalTime).toBe(0);
			expect(result.peakSpeed).toBe(0);
		});

		it("should compute trapezoidal profile for long distance", () => {
			const result = calcTravelTime(100, 5, 1.5, 1.5);

			expect(result.isTriangular).toBe(false);
			expect(result.peakSpeed).toBe(5);
			expect(result.totalTime).toBeCloseTo(23.33, 1);
		});

		it("should compute triangular profile for short distance", () => {
			const result = calcTravelTime(10, 5, 1.5, 1.5);

			expect(result.isTriangular).toBe(true);
			expect(result.peakSpeed).toBeLessThan(5);
			expect(result.peakSpeed).toBeGreaterThan(0);
			expect(result.peakSpeed).toBeCloseTo(Math.sqrt(15), 2);
		});

		it("should handle asymmetric accel/decel", () => {
			const result = calcTravelTime(100, 5, 2, 1);

			expect(result.isTriangular).toBe(false);
			expect(result.totalTime).toBeCloseTo(23.75, 2);
		});

		it("should handle negative distance as zero", () => {
			const result = calcTravelTime(-5, 5, 1.5, 1.5);
			expect(result.totalTime).toBe(0);
		});
	});

	describe("calcStoppingDistance", () => {
		it("should compute v^2/(2*decel)", () => {
			expect(calcStoppingDistance(5, 1.5)).toBeCloseTo(25 / 3, 2);
		});

		it("should return 0 for zero speed", () => {
			expect(calcStoppingDistance(0, 1.5)).toBe(0);
		});

		it("should return 0 for zero deceleration", () => {
			expect(calcStoppingDistance(5, 0)).toBe(0);
		});
	});

	describe("calcSegmentTravelTime", () => {
		it("should compute travel time for a rail edge", () => {
			const edge: RailEdge = {
				id: "e1",
				fabId: "F1",
				fromNodeId: "n1",
				toNodeId: "n2",
				distance: 50,
				maxSpeed: 4,
				lineType: "straight",
				isConfluence: false,
				isBranch: false,
				bayId: null,
				density: 0,
				weight: 1.0,
				enabled: true,
				curveRadius: null,
			};

			const time = calcSegmentTravelTime(edge, 5, 1.5, 1.5);
			expect(time).toBeGreaterThan(0);

			const expected = calcTravelTime(50, 4, 1.5, 1.5);
			expect(time).toBeCloseTo(expected.totalTime, 6);
		});
	});
});
