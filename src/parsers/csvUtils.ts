/**
 * csvUtils — Shared CSV parsing helpers for VOS .map file import.
 *
 * Handles comment lines, BOM removal, header normalization, and
 * the VOS-specific "[NODE1 NODE2 ...]" bracket-list format.
 *
 * Pure functions only. No React / Zustand / DOM.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single parsed CSV row as a string-keyed record. */
export type CsvRow = Record<string, string>;

/** Collected warnings during parsing (non-fatal issues). */
export interface ParseWarnings {
	skippedRows: Array<{ line: number; reason: string }>;
}

// ---------------------------------------------------------------------------
// Header / value cleaning
// ---------------------------------------------------------------------------

/** Strip BOM, carriage returns, and surrounding whitespace. */
function cleanHeader(raw: string): string {
	return raw
		.replace(/^\uFEFF/, "")
		.replace(/\r/g, "")
		.trim();
}

function cleanValue(raw: string): string {
	return raw.replace(/\r/g, "").trim();
}

// ---------------------------------------------------------------------------
// Core CSV parser
// ---------------------------------------------------------------------------

/**
 * Parse a VOS-format CSV text into an array of `CsvRow` objects.
 *
 * - Lines starting with `#` or `//` are treated as comments and skipped.
 * - The first non-comment line is the header row.
 * - Empty lines are skipped.
 * - Values are trimmed; BOM is removed from the header.
 *
 * @returns `{ rows, headers, warnings }` where `rows` is an array of objects
 *          keyed by the cleaned header names.
 */
export function parseCsvText(csvText: string): {
	rows: CsvRow[];
	headers: string[];
	warnings: ParseWarnings;
} {
	const warnings: ParseWarnings = { skippedRows: [] };
	const lines = csvText.split("\n");

	let headers: string[] = [];
	let headerFound = false;
	const rows: CsvRow[] = [];

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (raw === undefined) continue;

		const trimmed = raw.trim();

		// Skip empty lines
		if (trimmed === "") continue;

		// Skip comment lines
		if (trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

		// First non-comment, non-empty line is the header
		if (!headerFound) {
			headers = splitCsvLine(trimmed).map(cleanHeader);
			headerFound = true;
			continue;
		}

		// Data rows
		const values = splitCsvLine(trimmed).map(cleanValue);

		if (values.length !== headers.length) {
			warnings.skippedRows.push({
				line: i + 1,
				reason: `Column count mismatch: expected ${headers.length}, got ${values.length}`,
			});
			continue;
		}

		const row: CsvRow = {};
		for (let c = 0; c < headers.length; c++) {
			const header = headers[c];
			const value = values[c];
			if (header !== undefined && value !== undefined) {
				row[header] = value;
			}
		}
		rows.push(row);
	}

	return { rows, headers, warnings };
}

// ---------------------------------------------------------------------------
// CSV line splitting (handles bracket-enclosed fields)
// ---------------------------------------------------------------------------

/**
 * Split a CSV line by comma, but treat `[...]` as a single token.
 *
 * VOS edge.map has a `nodes` column with format `[NODE1 NODE2 ...]`.
 * Standard comma-split works here since brackets don't contain commas,
 * but we preserve the bracket content intact.
 */
function splitCsvLine(line: string): string[] {
	return line.split(",");
}

// ---------------------------------------------------------------------------
// VOS bracket-list parser
// ---------------------------------------------------------------------------

/**
 * Parse VOS `[NODE1 NODE2 ...]` format into a string array.
 *
 * @example
 * parseBracketList("[NODE0001 NODE0002 NODE0003]")
 * // => ["NODE0001", "NODE0002", "NODE0003"]
 *
 * parseBracketList("") // => []
 */
export function parseBracketList(raw: string): string[] {
	const trimmed = raw.trim();
	if (!trimmed || trimmed === "[]") return [];

	// Remove surrounding brackets
	const inner = trimmed.replace(/^\[/, "").replace(/\]$/, "").trim();
	if (inner === "") return [];

	return inner.split(/\s+/).filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Safe numeric parsing
// ---------------------------------------------------------------------------

/**
 * Parse a string to a finite number, returning `fallback` on failure.
 */
export function safeParseFloat(raw: string | undefined, fallback: number): number {
	if (raw === undefined || raw === "") return fallback;
	const n = Number(raw);
	return Number.isFinite(n) ? n : fallback;
}

/**
 * Require a string field from a CSV row.
 * Returns `undefined` if missing or empty (signals row should be skipped).
 */
export function requireField(row: CsvRow, field: string): string | undefined {
	const val = row[field];
	if (val === undefined || val === "") return undefined;
	return val;
}
