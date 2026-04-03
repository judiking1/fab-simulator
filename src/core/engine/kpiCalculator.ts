import type { TransferCommand } from "@/models/transfer";
import {
	getDeliveryTime,
	getLeadTime,
	getQueueTime,
	getWaitTime,
	TRANSFER_STATUSES,
} from "@/models/transfer";
import type { KpiSummary } from "@/types/simulation";

// ─── KPI Calculator ─────────────────────────────────────────────
// Pure functions for computing KPI metrics from simulation results.
// No React imports — safe for Web Worker context.

/**
 * Calculate percentile value from a **sorted** (ascending) array.
 * Uses linear interpolation between surrounding ranks.
 */
export function calcPercentile(sortedValues: readonly number[], percentile: number): number {
	if (sortedValues.length === 0) return 0;
	if (sortedValues.length === 1) return sortedValues[0] ?? 0;

	const clampedP = Math.max(0, Math.min(100, percentile));
	// Rank position (0-indexed, fractional)
	const rank = (clampedP / 100) * (sortedValues.length - 1);
	const lower = Math.floor(rank);
	const upper = Math.ceil(rank);

	if (lower === upper) return sortedValues[lower] ?? 0;

	const lowerVal = sortedValues[lower] ?? 0;
	const upperVal = sortedValues[upper] ?? 0;
	const fraction = rank - lower;

	return lowerVal + fraction * (upperVal - lowerVal);
}

/** Statistics for a single metric */
export interface MetricStats {
	avg: number;
	min: number;
	max: number;
	p95: number;
}

/**
 * Calculate stats (avg, min, max, p95) for a set of numeric values.
 * Returns zeroes for an empty array.
 */
export function calcMetricStats(values: readonly number[]): MetricStats {
	if (values.length === 0) {
		return { avg: 0, min: 0, max: 0, p95: 0 };
	}

	const sorted = [...values].sort((a, b) => a - b);
	const sum = sorted.reduce((acc, v) => acc + v, 0);

	return {
		avg: sum / sorted.length,
		min: sorted[0] ?? 0,
		max: sorted[sorted.length - 1] ?? 0,
		p95: calcPercentile(sorted, 95),
	};
}

/**
 * Build a full KpiSummary from completed transfer commands.
 *
 * @param transfers - All transfer commands from the simulation
 * @param totalDuration - Total simulation duration in seconds
 * @param ohtCount - Number of OHT vehicles in the simulation
 */
export function calculateKpiSummary(
	transfers: readonly TransferCommand[],
	totalDuration: number,
	ohtCount: number,
): KpiSummary {
	const completed = transfers.filter((t) => t.status === TRANSFER_STATUSES.UNLOAD_DONE);

	const leadTimes: number[] = [];
	const queueTimes: number[] = [];
	const waitTimes: number[] = [];
	const deliveryTimes: number[] = [];

	for (const cmd of completed) {
		const lt = getLeadTime(cmd);
		if (lt != null) leadTimes.push(lt);

		const qt = getQueueTime(cmd);
		if (qt != null) queueTimes.push(qt);

		const wt = getWaitTime(cmd);
		if (wt != null) waitTimes.push(wt);

		const dt = getDeliveryTime(cmd);
		if (dt != null) deliveryTimes.push(dt);
	}

	// Utilization approximation:
	// Sum of lead times across completed transfers / (totalDuration * ohtCount)
	// This estimates what fraction of total OHT-time was spent on active transfers.
	const totalLeadTime = leadTimes.reduce((acc, v) => acc + v, 0);
	const totalOhtCapacity = totalDuration * ohtCount;
	const utilization = totalOhtCapacity > 0 ? Math.min(1, totalLeadTime / totalOhtCapacity) : 0;

	// Throughput: completed transfers per hour
	const durationHours = totalDuration / 3600;
	const throughput = durationHours > 0 ? completed.length / durationHours : 0;

	return {
		leadTime: calcMetricStats(leadTimes),
		queueTime: calcMetricStats(queueTimes),
		waitTime: calcMetricStats(waitTimes),
		deliveryTime: calcMetricStats(deliveryTimes),
		utilization,
		throughput,
		totalTransfers: transfers.length,
		completedTransfers: completed.length,
	};
}
