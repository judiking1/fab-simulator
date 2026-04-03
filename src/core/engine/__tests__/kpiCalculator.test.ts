import { describe, expect, it } from "vitest";
import { calcMetricStats, calcPercentile, calculateKpiSummary } from "@/core/engine/kpiCalculator";
import type { TransferCommand } from "@/models/transfer";
import { createTransferCommand, TRANSFER_STATUSES } from "@/models/transfer";

// ─── Helper: build a completed transfer with known timestamps ───

function makeCompletedTransfer(
	id: string,
	timestamps: {
		created: number;
		assigned: number;
		move_to_load: number;
		arrive_at_source: number;
		loading: number;
		load_done: number;
		move_to_unload: number;
		arrive_at_dest: number;
		unloading: number;
		unload_done: number;
	},
): TransferCommand {
	const cmd = createTransferCommand(
		id,
		`F_${id}`,
		"EQ_SRC",
		"P_SRC",
		"EQ_DST",
		"P_DST",
		timestamps.created,
	);
	cmd.status = TRANSFER_STATUSES.UNLOAD_DONE;
	cmd.timestamps.created = timestamps.created;
	cmd.timestamps.assigned = timestamps.assigned;
	cmd.timestamps.move_to_load = timestamps.move_to_load;
	cmd.timestamps.arrive_at_source = timestamps.arrive_at_source;
	cmd.timestamps.loading = timestamps.loading;
	cmd.timestamps.load_done = timestamps.load_done;
	cmd.timestamps.move_to_unload = timestamps.move_to_unload;
	cmd.timestamps.arrive_at_dest = timestamps.arrive_at_dest;
	cmd.timestamps.unloading = timestamps.unloading;
	cmd.timestamps.unload_done = timestamps.unload_done;
	return cmd;
}

// ─── calcPercentile ─────────────────────────────────────────────

describe("calcPercentile", () => {
	it("returns 0 for empty array", () => {
		expect(calcPercentile([], 50)).toBe(0);
	});

	it("returns the single value for single-element array", () => {
		expect(calcPercentile([42], 0)).toBe(42);
		expect(calcPercentile([42], 50)).toBe(42);
		expect(calcPercentile([42], 100)).toBe(42);
	});

	it("returns min at 0th percentile", () => {
		expect(calcPercentile([1, 2, 3, 4, 5], 0)).toBe(1);
	});

	it("returns max at 100th percentile", () => {
		expect(calcPercentile([1, 2, 3, 4, 5], 100)).toBe(5);
	});

	it("returns median at 50th percentile for odd-length sorted array", () => {
		expect(calcPercentile([1, 2, 3, 4, 5], 50)).toBe(3);
	});

	it("interpolates at 50th percentile for even-length sorted array", () => {
		expect(calcPercentile([1, 2, 3, 4], 50)).toBe(2.5);
	});

	it("calculates p95 correctly", () => {
		// 20 elements: 1..20
		const values = Array.from({ length: 20 }, (_, i) => i + 1);
		const p95 = calcPercentile(values, 95);
		// rank = 0.95 * 19 = 18.05 → lerp(19, 20, 0.05) = 19.05
		expect(p95).toBeCloseTo(19.05, 5);
	});

	it("clamps percentile above 100 to 100", () => {
		expect(calcPercentile([1, 2, 3], 150)).toBe(3);
	});

	it("clamps percentile below 0 to 0", () => {
		expect(calcPercentile([1, 2, 3], -10)).toBe(1);
	});
});

// ─── calcMetricStats ────────────────────────────────────────────

describe("calcMetricStats", () => {
	it("returns zeroes for empty array", () => {
		const stats = calcMetricStats([]);
		expect(stats).toEqual({ avg: 0, min: 0, max: 0, p95: 0 });
	});

	it("handles single value", () => {
		const stats = calcMetricStats([10]);
		expect(stats.avg).toBe(10);
		expect(stats.min).toBe(10);
		expect(stats.max).toBe(10);
		expect(stats.p95).toBe(10);
	});

	it("handles all same values", () => {
		const stats = calcMetricStats([5, 5, 5, 5, 5]);
		expect(stats.avg).toBe(5);
		expect(stats.min).toBe(5);
		expect(stats.max).toBe(5);
		expect(stats.p95).toBe(5);
	});

	it("calculates correct stats for known values", () => {
		const stats = calcMetricStats([10, 20, 30, 40, 50]);
		expect(stats.avg).toBe(30);
		expect(stats.min).toBe(10);
		expect(stats.max).toBe(50);
		// p95: rank = 0.95 * 4 = 3.8 → lerp(40, 50, 0.8) = 48
		expect(stats.p95).toBeCloseTo(48, 5);
	});

	it("sorts unsorted input correctly", () => {
		const stats = calcMetricStats([50, 10, 30, 40, 20]);
		expect(stats.min).toBe(10);
		expect(stats.max).toBe(50);
		expect(stats.avg).toBe(30);
	});
});

// ─── calculateKpiSummary ────────────────────────────────────────

describe("calculateKpiSummary", () => {
	it("returns zeroes for empty transfer list", () => {
		const kpi = calculateKpiSummary([], 3600, 10);
		expect(kpi.completedTransfers).toBe(0);
		expect(kpi.totalTransfers).toBe(0);
		expect(kpi.utilization).toBe(0);
		expect(kpi.throughput).toBe(0);
		expect(kpi.leadTime.avg).toBe(0);
	});

	it("ignores non-completed transfers", () => {
		const pending = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 0);
		// status remains CREATED
		const kpi = calculateKpiSummary([pending], 3600, 1);
		expect(kpi.completedTransfers).toBe(0);
		expect(kpi.totalTransfers).toBe(1);
	});

	it("computes KPIs for a single completed transfer", () => {
		const t = makeCompletedTransfer("T1", {
			created: 0,
			assigned: 5,
			move_to_load: 6,
			arrive_at_source: 16,
			loading: 16,
			load_done: 20,
			move_to_unload: 21,
			arrive_at_dest: 36,
			unloading: 36,
			unload_done: 40,
		});

		const kpi = calculateKpiSummary([t], 3600, 10);

		// lead time: 40 - 0 = 40
		expect(kpi.leadTime.avg).toBe(40);
		// queue time: 5 - 0 = 5
		expect(kpi.queueTime.avg).toBe(5);
		// wait time: 20 - 0 = 20
		expect(kpi.waitTime.avg).toBe(20);
		// delivery time: 40 - 21 = 19
		expect(kpi.deliveryTime.avg).toBe(19);

		expect(kpi.completedTransfers).toBe(1);
		expect(kpi.totalTransfers).toBe(1);

		// utilization: 40 / (3600 * 10) = 0.001111...
		expect(kpi.utilization).toBeCloseTo(40 / 36000, 5);
		// throughput: 1 / 1 = 1 transfer/hr
		expect(kpi.throughput).toBe(1);
	});

	it("computes KPIs for multiple completed transfers", () => {
		const t1 = makeCompletedTransfer("T1", {
			created: 0,
			assigned: 10,
			move_to_load: 11,
			arrive_at_source: 21,
			loading: 21,
			load_done: 25,
			move_to_unload: 26,
			arrive_at_dest: 46,
			unloading: 46,
			unload_done: 50,
		});
		const t2 = makeCompletedTransfer("T2", {
			created: 100,
			assigned: 105,
			move_to_load: 106,
			arrive_at_source: 116,
			loading: 116,
			load_done: 120,
			move_to_unload: 121,
			arrive_at_dest: 141,
			unloading: 141,
			unload_done: 150,
		});

		const kpi = calculateKpiSummary([t1, t2], 3600, 2);

		// lead times: 50, 50 → avg = 50
		expect(kpi.leadTime.avg).toBe(50);
		// queue times: 10, 5 → avg = 7.5
		expect(kpi.queueTime.avg).toBe(7.5);
		expect(kpi.completedTransfers).toBe(2);
		expect(kpi.totalTransfers).toBe(2);

		// throughput: 2 / 1 = 2
		expect(kpi.throughput).toBe(2);
	});

	it("caps utilization at 1.0", () => {
		// Create many transfers with long lead times in a short duration
		const transfers: TransferCommand[] = [];
		for (let i = 0; i < 100; i++) {
			transfers.push(
				makeCompletedTransfer(`T${i}`, {
					created: 0,
					assigned: 1,
					move_to_load: 2,
					arrive_at_source: 10,
					loading: 10,
					load_done: 15,
					move_to_unload: 16,
					arrive_at_dest: 80,
					unloading: 80,
					unload_done: 100,
				}),
			);
		}

		// 100 transfers * 100s lead time = 10000s total, capacity = 100 * 1 = 100s
		const kpi = calculateKpiSummary(transfers, 100, 1);
		expect(kpi.utilization).toBe(1);
	});
});
