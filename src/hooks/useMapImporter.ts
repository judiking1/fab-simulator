/**
 * useMapImporter — Step-by-step VOS .map file importer.
 *
 * Enforces dependency order: Nodes -> Rails -> Ports.
 * Each step is a separate file input with its own parse function.
 * Intermediate state (barcodeMap, barcodeLookup) is held in refs
 * between steps for port barcode resolution.
 */

import { useCallback, useRef, useState } from "react";
import type { BayData } from "@/models/bay";
import type { FabMapFile } from "@/models/map";
import type { NodeData } from "@/models/node";
import type { PortData } from "@/models/port";
import type { RailData } from "@/models/rail";
import {
	type BarcodeEntry,
	parseVosEdgeMap,
	parseVosNodeMap,
	parseVosStationMap,
} from "@/parsers/vosImportAdapter";
import { useMapStore } from "@/stores/mapStore";

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

	/** Push accumulated data to the map store. */
	const syncToStore = useCallback((): void => {
		const now = new Date().toISOString();
		const map: FabMapFile = {
			version: "1.0.0",
			metadata: {
				name: "VOS Import",
				author: "VOS Import Adapter",
				createdAt: now,
				updatedAt: now,
				description: "Imported from VOS .map CSV files",
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
				const result = parseVosNodeMap(csvText);

				const count = Object.keys(result.nodes).length;
				if (count === 0) {
					throw new Error("No valid nodes found. Check file format (expected header: node_name).");
				}

				// Store intermediate data
				nodesRef.current = result.nodes;
				barcodeMapRef.current = result.barcodeMap;
				barcodeLookupRef.current = result.barcodeLookup;

				// Reset downstream data when re-importing nodes
				railsRef.current = {};
				portsRef.current = {};
				baysRef.current = {};

				if (result.warnings.skippedRows.length > 0) {
					console.warn("[useMapImporter] Node warnings:", result.warnings.skippedRows);
				}

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
				});

				console.log(`[useMapImporter] Nodes imported: ${count}`);
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
				const result = parseVosEdgeMap(csvText, nodesRef.current);

				const railCount = Object.keys(result.rails).length;
				const bayCount = Object.keys(result.bays).length;
				if (railCount === 0) {
					throw new Error("No valid rails found. Check file format (expected header: rail_name).");
				}

				// Store intermediate data
				railsRef.current = result.rails;
				baysRef.current = result.bays;

				// Reset downstream data when re-importing rails
				portsRef.current = {};

				if (result.warnings.skippedRows.length > 0) {
					console.warn("[useMapImporter] Rail warnings:", result.warnings.skippedRows);
				}

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

				console.log(`[useMapImporter] Rails imported: ${railCount}, Bays: ${bayCount}`);
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
				const result = parseVosStationMap(
					csvText,
					railsRef.current,
					barcodeMapRef.current,
					barcodeLookupRef.current,
				);

				const count = Object.keys(result.ports).length;
				if (count === 0) {
					throw new Error(
						"No valid ports found. Check file format (expected header: station_name).",
					);
				}

				portsRef.current = result.ports;

				if (result.warnings.skippedRows.length > 0) {
					console.warn("[useMapImporter] Port warnings:", result.warnings.skippedRows);
				}

				syncToStore();

				setState((prev) => ({
					...prev,
					portsLoaded: true,
					portCount: count,
					isLoading: false,
					error: null,
				}));

				console.log(`[useMapImporter] Ports imported: ${count}`);
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
