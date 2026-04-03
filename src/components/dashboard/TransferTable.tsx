import { useCallback, useMemo, useState } from "react";
import type { TransferCommand, TransferStatus } from "@/models/transfer";
import { getDeliveryTime, getLeadTime, getQueueTime } from "@/models/transfer";

// ─── Types ──────────────────────────────────────────────────────

type SortKey = "index" | "status" | "source" | "dest" | "leadTime" | "queueTime" | "deliveryTime";
type SortDir = "asc" | "desc";

interface TransferRow {
	index: number;
	id: string;
	status: TransferStatus;
	source: string;
	dest: string;
	leadTime: number | null;
	queueTime: number | null;
	deliveryTime: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────

function formatTime(value: number | null): string {
	if (value == null) return "-";
	return `${value.toFixed(1)}s`;
}

function compareNullable(a: number | null, b: number | null, dir: SortDir): number {
	if (a == null && b == null) return 0;
	if (a == null) return dir === "asc" ? 1 : -1;
	if (b == null) return dir === "asc" ? -1 : 1;
	return dir === "asc" ? a - b : b - a;
}

function compareStrings(a: string, b: string, dir: SortDir): number {
	return dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
}

// ─── Column Header ──────────────────────────────────────────────

interface ColumnHeaderProps {
	label: string;
	sortKey: SortKey;
	currentSort: SortKey;
	currentDir: SortDir;
	onSort: (key: SortKey) => void;
	align?: "left" | "right";
}

function ColumnHeader({
	label,
	sortKey,
	currentSort,
	currentDir,
	onSort,
	align = "left",
}: ColumnHeaderProps): React.ReactElement {
	const isActive = currentSort === sortKey;
	const arrow = isActive ? (currentDir === "asc" ? " ▲" : " ▼") : "";

	const handleClick = useCallback((): void => {
		onSort(sortKey);
	}, [onSort, sortKey]);

	return (
		<th
			className={`cursor-pointer select-none whitespace-nowrap px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200 dark:text-gray-500 dark:hover:text-gray-300 ${
				align === "right" ? "text-right" : "text-left"
			}`}
			onClick={handleClick}
		>
			{label}
			{arrow}
		</th>
	);
}

// ─── Main Component ─────────────────────────────────────────────

interface TransferTableProps {
	transfers: readonly TransferCommand[];
}

export function TransferTable({ transfers }: TransferTableProps): React.ReactElement {
	const [sortKey, setSortKey] = useState<SortKey>("index");
	const [sortDir, setSortDir] = useState<SortDir>("asc");

	const handleSort = useCallback(
		(key: SortKey): void => {
			if (key === sortKey) {
				setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
			} else {
				setSortKey(key);
				setSortDir("asc");
			}
		},
		[sortKey],
	);

	const rows: TransferRow[] = useMemo(
		() =>
			transfers.map((t, i) => ({
				index: i + 1,
				id: t.id,
				status: t.status,
				source: t.sourceEquipmentId,
				dest: t.destEquipmentId,
				leadTime: getLeadTime(t),
				queueTime: getQueueTime(t),
				deliveryTime: getDeliveryTime(t),
			})),
		[transfers],
	);

	const sortedRows = useMemo(() => {
		const sorted = [...rows];
		sorted.sort((a, b) => {
			switch (sortKey) {
				case "index":
					return sortDir === "asc" ? a.index - b.index : b.index - a.index;
				case "status":
					return compareStrings(a.status, b.status, sortDir);
				case "source":
					return compareStrings(a.source, b.source, sortDir);
				case "dest":
					return compareStrings(a.dest, b.dest, sortDir);
				case "leadTime":
					return compareNullable(a.leadTime, b.leadTime, sortDir);
				case "queueTime":
					return compareNullable(a.queueTime, b.queueTime, sortDir);
				case "deliveryTime":
					return compareNullable(a.deliveryTime, b.deliveryTime, sortDir);
				default:
					return 0;
			}
		});
		return sorted;
	}, [rows, sortKey, sortDir]);

	if (transfers.length === 0) {
		return (
			<div className="space-y-2">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
					Transfers
				</h3>
				<p className="text-xs text-gray-400 dark:text-gray-500">No data</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
				Transfers
			</h3>
			<div className="max-h-64 overflow-auto rounded border border-gray-200 dark:border-gray-700">
				<table className="w-full text-xs">
					<thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
						<tr>
							<ColumnHeader
								label="#"
								sortKey="index"
								currentSort={sortKey}
								currentDir={sortDir}
								onSort={handleSort}
							/>
							<ColumnHeader
								label="Status"
								sortKey="status"
								currentSort={sortKey}
								currentDir={sortDir}
								onSort={handleSort}
							/>
							<ColumnHeader
								label="Source"
								sortKey="source"
								currentSort={sortKey}
								currentDir={sortDir}
								onSort={handleSort}
							/>
							<ColumnHeader
								label="Dest"
								sortKey="dest"
								currentSort={sortKey}
								currentDir={sortDir}
								onSort={handleSort}
							/>
							<ColumnHeader
								label="Lead"
								sortKey="leadTime"
								currentSort={sortKey}
								currentDir={sortDir}
								onSort={handleSort}
								align="right"
							/>
							<ColumnHeader
								label="Queue"
								sortKey="queueTime"
								currentSort={sortKey}
								currentDir={sortDir}
								onSort={handleSort}
								align="right"
							/>
							<ColumnHeader
								label="Delivery"
								sortKey="deliveryTime"
								currentSort={sortKey}
								currentDir={sortDir}
								onSort={handleSort}
								align="right"
							/>
						</tr>
					</thead>
					<tbody>
						{sortedRows.map((row) => (
							<tr
								key={row.id}
								className="border-t border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
							>
								<td className="px-2 py-1 font-mono text-gray-400 dark:text-gray-500">
									{row.index}
								</td>
								<td className="px-2 py-1">
									<span className="inline-block rounded bg-gray-200 px-1 py-0.5 text-[10px] dark:bg-gray-700">
										{row.status}
									</span>
								</td>
								<td className="max-w-[80px] truncate px-2 py-1" title={row.source}>
									{row.source}
								</td>
								<td className="max-w-[80px] truncate px-2 py-1" title={row.dest}>
									{row.dest}
								</td>
								<td className="px-2 py-1 text-right font-mono">{formatTime(row.leadTime)}</td>
								<td className="px-2 py-1 text-right font-mono">{formatTime(row.queueTime)}</td>
								<td className="px-2 py-1 text-right font-mono">{formatTime(row.deliveryTime)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
