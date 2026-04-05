/**
 * useMapImporter — Step-by-step map file importer with format auto-detection.
 *
 * Supports two CSV formats:
 *   1. VOS format — headers like node_name, rail_name, station_name
 *   2. Our custom format — headers like id, fromNodeId, railId
 *
 * Format is detected by inspecting the first header of each file.
 * Enforces dependency order: Nodes -> Rails -> Ports.
 */

import { useCallback, useRef, useState } from "react";
import type { BayData } from "@/models/bay";
import type { FabMapFile } from "@/models/map";
import type { NodeData } from "@/models/node";
import type { PortData } from "@/models/port";
import type { RailData } from "@/models/rail";
import { parseNodesCSV, parsePortsCSV, parseRailsCSV } from "@/parsers/csvParser";
import {
	type BarcodeEntry,
	parseVosEdgeMap,
	parseVosNodeMap,
	parseVosStationMap,
} from "@/parsers/vosImportAdapter";
import { useMapStore } from "@/stores/mapStore";

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

type CsvFormat = "vos" | "custom";

/** Detect format by peeking at the first non-comment, non-empty line (header). */
function detectFormat(csvText: string): CsvFormat {
	const lines = csvText.split("\n");
	for (const raw of lines) {
		const trimmed = raw.trim();
		if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

		// VOS node.map starts with "node_name", edge.map with "rail_name", station.map with "station_name"
		// Our format starts with "id"
		if (
			trimmed.startsWith("node_name,") ||
			trimmed.startsWith("rail_name,") ||
			trimmed.startsWith("station_name,")
		) {
			return "vos";
		}
		return "custom";
	}
	return "custom";
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface ImportStepState {
	nodesLoaded: boolean;
	railsLoaded: boolean;
	portsLoaded: boolean;
	nodeCount: number;
	railCount: number;
	portCount: number;
	bayCount: number;
	isLoading: boolean;
	error: string | null;
	/** Detected format of the most recent import */
	format: CsvFormat | null;
}

interface ImportActions {
	importNodes: (file: File) => Promise<void>;
	importRails: (file: File) => Promise<void>;
	importPorts: (file: File) => Promise<void>;
	clearImport: () => void;
	clearError: () => void;
}

export type UseMapImporterReturn = ImportStepState & ImportActions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (): void => {
			resolve(reader.result as string);
		};
		reader.onerror = (): void => {
			reject(new Error(`Failed to read file: ${file.name}`));
		};
		reader.readAsText(file);
	});
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const INITIAL_STATE: ImportStepState = {
	nodesLoaded: false,
	railsLoaded: false,
	portsLoaded: false,
	nodeCount: 0,
	railCount: 0,
	portCount: 0,
	bayCount: 0,
	isLoading: false,
	error: null,
	format: null,
};

export function useMapImporter(): UseMapImporterReturn {
	const [state, setState] = useState<ImportStepState>(INITIAL_STATE);

	// Intermediate data held between steps (not in React state — no re-render needed)
	const nodesRef = useRef<Record<string, NodeData>>({});
	const railsRef = useRef<Record<string, RailData>>({});
	const portsRef = useRef<Record<string, PortData>>({});
	const baysRef = useRef<Record<string, BayData>>({});
	const barcodeMapRef = useRef<BarcodeEntry[]>([]);
	const barcodeLookupRef = useRef<Record<string, number>>({});
	const formatRef = useRef<CsvFormat | null>(null);

	/** Push accumulated data to the map store. */
	const syncToStore = useCallback((): void => {
		const now = new Date().toISOString();
		const map: FabMapFile = {
			version: "1.0.0",
			metadata: {
				name: formatRef.current === "vos" ? "VOS Import" : "CSV Import",
				author: formatRef.current === "vos" ? "VOS Import Adapter" : "CSV Parser",
				createdAt: now,
				updatedAt: now,
				description:
					formatRef.current === "vos"
						? "Imported from VOS .map CSV files"
						: "Imported from custom CSV files",
			},
			nodes: nodesRef.current,
			rails: railsRef.current,
			ports: portsRef.current,
			bays: baysRef.current,
		};
		useMapStore.getState().loadMap(map);
	}, []);

	// -----------------------------------------------------------------------
	// Step 1: Import Nodes
	// -----------------------------------------------------------------------

	const importNodes = useCallback(
		async (file: File): Promise<void> => {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			try {
				const csvText = await readFileAsText(file);
				const format = detectFormat(csvText);
				formatRef.current = format;

				let nodes: Record<string, NodeData>;

				if (format === "vos") {
					const result = parseVosNodeMap(csvText);
					nodes = result.nodes;
					barcodeMapRef.current = result.barcodeMap;
					barcodeLookupRef.current = result.barcodeLookup;

					if (result.warnings.skippedRows.length > 0) {
						console.warn("[useMapImporter] Node warnings:", result.warnings.skippedRows);
					}
				} else {
					nodes = parseNodesCSV(csvText);
					// Custom format has no barcodes
					barcodeMapRef.current = [];
					barcodeLookupRef.current = {};
				}

				const count = Object.keys(nodes).length;
				if (count === 0) {
					throw new Error(
						`No valid nodes found. Check file format (detected: ${format}).`,
					);
				}

				nodesRef.current = nodes;
				// Reset downstream data when re-importing nodes
				railsRef.current = {};
				portsRef.current = {};
				baysRef.current = {};

				syncToStore();

				setState({
					nodesLoaded: true,
					railsLoaded: false,
					portsLoaded: false,
					nodeCount: count,
					railCount: 0,
					portCount: 0,
					bayCount: 0,
					isLoading: false,
					error: null,
					format,
				});

				console.log(`[useMapImporter] Nodes imported (${format}): ${count}`);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : "Unknown error importing nodes";
				console.error("[useMapImporter] Node import failed:", err);
				setState((prev) => ({ ...prev, isLoading: false, error: message }));
			}
		},
		[syncToStore],
	);

	// -----------------------------------------------------------------------
	// Step 2: Import Rails
	// -----------------------------------------------------------------------

	const importRails = useCallback(
		async (file: File): Promise<void> => {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			try {
				const csvText = await readFileAsText(file);
				const format = detectFormat(csvText);

				let rails: Record<string, RailData>;
				let bays: Record<string, BayData> = {};

				if (format === "vos") {
					const result = parseVosEdgeMap(csvText, nodesRef.current);
					rails = result.rails;
					bays = result.bays;

					if (result.warnings.skippedRows.length > 0) {
						console.warn("[useMapImporter] Rail warnings:", result.warnings.skippedRows);
					}
				} else {
					rails = parseRailsCSV(csvText);
					// Build bays from rail bayId grouping
					const bayRailIds = new Map<string, string[]>();
					const bayFabIds = new Map<string, string>();
					for (const rail of Object.values(rails)) {
						if (rail.bayId) {
							let list = bayRailIds.get(rail.bayId);
							if (!list) {
								list = [];
								bayRailIds.set(rail.bayId, list);
							}
							list.push(rail.id);
							if (!bayFabIds.has(rail.bayId)) {
								bayFabIds.set(rail.bayId, rail.fabId);
							}
						}
					}
					for (const [bayId, railIds] of bayRailIds) {
						bays[bayId] = {
							id: bayId,
							fabId: bayFabIds.get(bayId) ?? "",
							railIds,
							loopDirection: "ccw",
						};
					}
				}

				const railCount = Object.keys(rails).length;
				const bayCount = Object.keys(bays).length;
				if (railCount === 0) {
					throw new Error(
						`No valid rails found. Check file format (detected: ${format}).`,
					);
				}

				railsRef.current = rails;
				baysRef.current = bays;
				// Reset downstream data when re-importing rails
				portsRef.current = {};

				syncToStore();

				setState((prev) => ({
					...prev,
					railsLoaded: true,
					portsLoaded: false,
					railCount,
					bayCount,
					portCount: 0,
					isLoading: false,
					error: null,
				}));

				console.log(`[useMapImporter] Rails imported (${format}): ${railCount}, Bays: ${bayCount}`);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : "Unknown error importing rails";
				console.error("[useMapImporter] Rail import failed:", err);
				setState((prev) => ({ ...prev, isLoading: false, error: message }));
			}
		},
		[syncToStore],
	);

	// -----------------------------------------------------------------------
	// Step 3: Import Ports
	// -----------------------------------------------------------------------

	const importPorts = useCallback(
		async (file: File): Promise<void> => {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			try {
				const csvText = await readFileAsText(file);
				const format = detectFormat(csvText);

				let ports: Record<string, PortData>;

				if (format === "vos") {
					const result = parseVosStationMap(
						csvText,
						railsRef.current,
						barcodeMapRef.current,
						barcodeLookupRef.current,
					);
					ports = result.ports;

					if (result.warnings.skippedRows.length > 0) {
						console.warn("[useMapImporter] Port warnings:", result.warnings.skippedRows);
					}
				} else {
					ports = parsePortsCSV(csvText);
				}

				const count = Object.keys(ports).length;
				if (count === 0) {
					throw new Error(
						`No valid ports found. Check file format (detected: ${format}).`,
					);
				}

				portsRef.current = ports;

				syncToStore();

				setState((prev) => ({
					...prev,
					portsLoaded: true,
					portCount: count,
					isLoading: false,
					error: null,
				}));

				console.log(`[useMapImporter] Ports imported (${format}): ${count}`);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : "Unknown error importing ports";
				console.error("[useMapImporter] Port import failed:", err);
				setState((prev) => ({ ...prev, isLoading: false, error: message }));
			}
		},
		[syncToStore],
	);

	// -----------------------------------------------------------------------
	// Clear all
	// -----------------------------------------------------------------------

	const clearImport = useCallback((): void => {
		nodesRef.current = {};
		railsRef.current = {};
		portsRef.current = {};
		baysRef.current = {};
		barcodeMapRef.current = [];
		barcodeLookupRef.current = {};
		formatRef.current = null;
		useMapStore.getState().clearMap();
		setState(INITIAL_STATE);
	}, []);

	const clearError = useCallback((): void => {
		setState((prev) => ({ ...prev, error: null }));
	}, []);

	return {
		...state,
		importNodes,
		importRails,
		importPorts,
		clearImport,
		clearError,
	};
}
