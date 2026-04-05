/**
 * useMapImporter — Hook for importing VOS .map CSV files.
 *
 * Handles file selection, content detection (node/edge/station),
 * parsing via importVosMap(), and loading into the map store.
 */

import { useCallback, useRef, useState } from "react";
import { importVosMap } from "@/parsers/vosImportAdapter";
import { useMapStore } from "@/stores/mapStore";

// ---------------------------------------------------------------------------
// File detection — identify which CSV file is which by column headers
// ---------------------------------------------------------------------------

type VosFileType = "node" | "edge" | "station";

/**
 * Detect VOS file type by scanning for the header row.
 * VOS .map files start with comment lines (# ...) before the actual CSV header.
 */
function detectFileType(content: string): VosFileType | null {
	const lines = content.split("\n");

	for (const line of lines) {
		const trimmed = line.trim().toLowerCase();

		// Skip empty lines and comment lines
		if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("//")) {
			continue;
		}

		// First non-comment line is the header.
		// IMPORTANT: Check station_name BEFORE rail_name because
		// station.map headers contain both "station_name" and "rail_name" columns.
		if (trimmed.includes("station_name")) return "station";
		if (trimmed.includes("node_name")) return "node";
		if (trimmed.includes("rail_name")) return "edge";

		// First non-comment line didn't match any known header
		return null;
	}

	return null;
}

// ---------------------------------------------------------------------------
// Hook state
// ---------------------------------------------------------------------------

interface MapImporterState {
	isLoading: boolean;
	error: string | null;
	/** Name of the last successfully loaded map */
	loadedMapName: string | null;
}

interface MapImporterActions {
	/** Ref to attach to a hidden <input type="file"> */
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	/** Trigger the file picker dialog */
	openFilePicker: () => void;
	/** Handle file input change event */
	handleFiles: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
	/** Clear error state */
	clearError: () => void;
}

type UseMapImporterReturn = MapImporterState & MapImporterActions;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMapImporter(): UseMapImporterReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loadedMapName, setLoadedMapName] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const openFilePicker = useCallback((): void => {
		fileInputRef.current?.click();
	}, []);

	const clearError = useCallback((): void => {
		setError(null);
	}, []);

	const handleFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		setIsLoading(true);
		setError(null);

		try {
			console.log(`[useMapImporter] Reading ${files.length} file(s)...`);

			// Read all selected files
			const fileContents = await Promise.all(
				Array.from(files).map(
					(file) =>
						new Promise<{ name: string; content: string }>((resolve, reject) => {
							const reader = new FileReader();
							reader.onload = (): void => {
								resolve({ name: file.name, content: reader.result as string });
							};
							reader.onerror = (): void => {
								reject(new Error(`Failed to read file: ${file.name}`));
							};
							reader.readAsText(file);
						}),
				),
			);

			// Detect file types
			let nodeCsv: string | null = null;
			let edgeCsv: string | null = null;
			let stationCsv: string | null = null;

			const undetected: string[] = [];
			for (const { name, content } of fileContents) {
				const type = detectFileType(content);
				if (type === "node") {
					nodeCsv = content;
				} else if (type === "edge") {
					edgeCsv = content;
				} else if (type === "station") {
					stationCsv = content;
				} else {
					undetected.push(name);
				}
			}

			if (undetected.length > 0) {
				console.warn(
					`[useMapImporter] Could not detect file type for: ${undetected.join(", ")}. ` +
						"Expected VOS .map files with headers containing node_name, rail_name, or station_name.",
				);
			}

			console.log("[useMapImporter] Detection results:", {
				node: nodeCsv ? "found" : "missing",
				edge: edgeCsv ? "found" : "missing",
				station: stationCsv ? "found" : "missing",
				undetected,
			});

			// Validate all three files are present
			if (!nodeCsv || !edgeCsv || !stationCsv) {
				const missing: string[] = [];
				if (!nodeCsv) missing.push("node.map (header: node_name)");
				if (!edgeCsv) missing.push("edge.map (header: rail_name)");
				if (!stationCsv) missing.push("station.map (header: station_name)");
				const msg = `Missing files: ${missing.join(", ")}. Please select all 3 VOS map files.`;
				console.error("[useMapImporter]", msg);
				setError(msg);
				return;
			}

			console.log("[useMapImporter] Parsing VOS map data...");

			// Parse and import
			const result = importVosMap(nodeCsv, edgeCsv, stationCsv);

			// Load into store
			useMapStore.getState().loadMap(result.map);

			// Log stats for debugging
			const nodeCount = Object.keys(result.map.nodes).length;
			const railCount = Object.keys(result.map.rails).length;
			const portCount = Object.keys(result.map.ports).length;
			const bayCount = Object.keys(result.map.bays).length;

			console.log("[useMapImporter] Import complete:", {
				nodes: nodeCount,
				rails: railCount,
				ports: portCount,
				bays: bayCount,
			});

			// Log warnings if any
			const { nodes: nw, edges: ew, stations: sw } = result.warnings;
			if (nw.skippedRows.length > 0) {
				console.warn("[useMapImporter] Node warnings:", nw.skippedRows);
			}
			if (ew.skippedRows.length > 0) {
				console.warn("[useMapImporter] Edge warnings:", ew.skippedRows);
			}
			if (sw.skippedRows.length > 0) {
				console.warn("[useMapImporter] Station warnings:", sw.skippedRows);
			}

			setLoadedMapName(result.map.metadata.name);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Unknown import error";
			console.error("[useMapImporter] Import failed:", err);
			setError(message);
		} finally {
			setIsLoading(false);
			// Reset input so the same files can be re-imported
			if (e.target) {
				e.target.value = "";
			}
		}
	}, []);

	return {
		isLoading,
		error,
		loadedMapName,
		fileInputRef,
		openFilePicker,
		handleFiles,
		clearError,
	};
}
