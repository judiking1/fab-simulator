import { useLayoutStore } from "@/stores/layoutStore";
import type { LayoutFile } from "@/utils/layoutSchema";
import { layoutFileLegacySchema, layoutFileSchema } from "@/utils/layoutSchema";

// ─── Serialization ──────────────────────────────────────────────

interface EntityCounts {
	fabs: number;
	bays: number;
	areas: number;
	modules: number;
	equipment: number;
	railNodes: number;
	railEdges: number;
	foups: number;
}

/** Compute entity counts from the current layout store state */
function computeEntityCounts(): EntityCounts {
	const state = useLayoutStore.getState();
	return {
		fabs: Object.keys(state.fabs).length,
		bays: Object.keys(state.bays).length,
		areas: Object.keys(state.areas).length,
		modules: Object.keys(state.modules).length,
		equipment: Object.keys(state.equipment).length,
		railNodes: Object.keys(state.railNodes).length,
		railEdges: Object.keys(state.railEdges).length,
		foups: Object.keys(state.foups).length,
	};
}

/** Serialize the current LayoutStore state to a LayoutFile object */
export function serializeLayout(): LayoutFile {
	const state = useLayoutStore.getState();
	return {
		version: "1.0",
		entities: {
			fabs: state.fabs,
			bays: state.bays,
			areas: state.areas,
			modules: state.modules,
			equipment: state.equipment,
			railNodes: state.railNodes,
			railEdges: state.railEdges,
			foups: state.foups,
		},
		children: {
			fabBays: state.fabBays,
			bayAreas: state.bayAreas,
			areaModules: state.areaModules,
			moduleEquipment: state.moduleEquipment,
		},
		metadata: {
			exportedAt: new Date().toISOString(),
			entityCounts: computeEntityCounts(),
		},
	};
}

/** Serialize layout to a pretty-printed JSON string */
export function serializeLayoutToJson(): string {
	return JSON.stringify(serializeLayout(), null, 2);
}

// ─── Deserialization ────────────────────────────────────────────

interface DeserializeResult {
	success: boolean;
	data?: { entities: LayoutFile["entities"]; children: LayoutFile["children"] };
	error?: string;
}

/** Parse and validate a JSON string into layout data */
export function deserializeLayout(jsonString: string): DeserializeResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonString);
	} catch {
		return { success: false, error: "Invalid JSON format" };
	}

	// Try current schema first
	const result = layoutFileSchema.safeParse(parsed);
	if (result.success) {
		return {
			success: true,
			data: { entities: result.data.entities, children: result.data.children },
		};
	}

	// Try legacy schema (version: 1 as number)
	const legacyResult = layoutFileLegacySchema.safeParse(parsed);
	if (legacyResult.success) {
		return {
			success: true,
			data: { entities: legacyResult.data.entities, children: legacyResult.data.children },
		};
	}

	// Both failed — report the current schema error
	const issues = result.error.issues;
	const firstIssue = issues[0];
	const path = firstIssue?.path?.join(".") ?? "unknown";
	const message = firstIssue?.message ?? "Validation failed";
	return { success: false, error: `Schema error at "${path}": ${message}` };
}

// ─── Import ──────────────────────────────────────────────────────

interface ImportResult {
	success: boolean;
	error?: string;
}

/** Parse and validate a JSON string, then hydrate the LayoutStore */
export function importLayout(jsonString: string): ImportResult {
	const result = deserializeLayout(jsonString);
	if (!result.success || !result.data) {
		return { success: false, error: result.error };
	}

	useLayoutStore.getState().loadEntities(result.data);
	return { success: true };
}

/** Import a layout from a File object (e.g., from <input type="file">) */
export async function importLayoutFromFile(file: File): Promise<ImportResult> {
	const text = await file.text();
	return importLayout(text);
}

// ─── Export ──────────────────────────────────────────────────────

/** @deprecated Use serializeLayout() instead */
export function exportLayoutData(): LayoutFile {
	return serializeLayout();
}

/** Export current layout as a JSON file download */
export function downloadLayoutAsJson(filename = "fab-layout.json"): void {
	const json = serializeLayoutToJson();
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();

	URL.revokeObjectURL(url);
}
