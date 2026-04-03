import type { MetricStats } from "@/core/engine/kpiCalculator";
import type { KpiSummary } from "@/types/simulation";

// ─── Formatting Helpers ─────────────────────────────────────────

function formatSeconds(value: number): string {
	return `${value.toFixed(1)}s`;
}

function formatPercent(ratio: number): string {
	return `${(ratio * 100).toFixed(1)}%`;
}

function formatThroughput(value: number): string {
	return `${Math.round(value)} transfers/hr`;
}

// ─── Metric Card ────────────────────────────────────────────────

interface MetricCardProps {
	label: string;
	stats: MetricStats;
}

function MetricCard({ label, stats }: MetricCardProps): React.ReactElement {
	return (
		<div className="rounded border border-gray-200 p-2 dark:border-gray-700">
			<h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
				{label}
			</h4>
			<div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
				<span className="text-gray-400 dark:text-gray-500">avg</span>
				<span className="text-right font-mono">{formatSeconds(stats.avg)}</span>
				<span className="text-gray-400 dark:text-gray-500">min</span>
				<span className="text-right font-mono">{formatSeconds(stats.min)}</span>
				<span className="text-gray-400 dark:text-gray-500">max</span>
				<span className="text-right font-mono">{formatSeconds(stats.max)}</span>
				<span className="text-gray-400 dark:text-gray-500">p95</span>
				<span className="text-right font-mono">{formatSeconds(stats.p95)}</span>
			</div>
		</div>
	);
}

// ─── Main Panel ─────────────────────────────────────────────────

interface KpiSummaryPanelProps {
	kpiSummary: KpiSummary | null;
}

export function KpiSummaryPanel({ kpiSummary }: KpiSummaryPanelProps): React.ReactElement {
	if (kpiSummary == null) {
		return (
			<div className="space-y-2">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
					KPI Summary
				</h3>
				<p className="text-xs text-gray-400 dark:text-gray-500">
					Run a simulation to see KPI results
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
				KPI Summary
			</h3>

			<MetricCard label="Lead Time" stats={kpiSummary.leadTime} />
			<MetricCard label="Queue Time" stats={kpiSummary.queueTime} />
			<MetricCard label="Wait Time" stats={kpiSummary.waitTime} />
			<MetricCard label="Delivery Time" stats={kpiSummary.deliveryTime} />

			{/* Summary row */}
			<div className="space-y-1 border-t border-gray-200 pt-2 dark:border-gray-700">
				<div className="flex items-center justify-between text-xs">
					<span className="text-gray-400 dark:text-gray-500">Utilization</span>
					<span className="font-mono font-semibold">{formatPercent(kpiSummary.utilization)}</span>
				</div>
				<div className="flex items-center justify-between text-xs">
					<span className="text-gray-400 dark:text-gray-500">Throughput</span>
					<span className="font-mono font-semibold">{formatThroughput(kpiSummary.throughput)}</span>
				</div>
				<div className="flex items-center justify-between text-xs">
					<span className="text-gray-400 dark:text-gray-500">Completed</span>
					<span className="font-mono font-semibold">
						{kpiSummary.completedTransfers} / {kpiSummary.totalTransfers}
					</span>
				</div>
			</div>
		</div>
	);
}
