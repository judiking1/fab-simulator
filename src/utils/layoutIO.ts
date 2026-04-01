import { useLayoutStore } from "@/stores/layoutStore";
import type { LayoutFile } from "@/utils/layoutSchema";
import { layoutFileSchema } from "@/utils/layoutSchema";

// ─── Import ──────────────────────────────────────────────────────

interface ImportResult {
	success: boolean;
	error?: string;
}

/** Parse and validate a JSON string, then hydrate the LayoutStore */
export function importLayout(jsonString: string): ImportResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonString);
	} catch {
		return { success: false, error: "Invalid JSON format" };
	}

	const result = layoutFileSchema.safeParse(parsed);
	if (!result.success) {
		const issues = result.error.issues;
		const firstIssue = issues[0];
		const path = firstIssue?.path?.join(".") ?? "unknown";
		const message = firstIssue?.message ?? "Validation failed";
		return { success: false, error: `Schema error at "${path}": ${message}` };
	}

	const data = result.data;
	useLayoutStore.getState().loadEntities({
		entities: data.entities,
		children: data.children,
	});

	return { success: true };
}

/** Import a layout from a File object (e.g., from <input type="file">) */
export async function importLayoutFromFile(file: File): Promise<ImportResult> {
	const text = await file.text();
	return importLayout(text);
}

// ─── Export ──────────────────────────────────────────────────────

/** Serialize the current LayoutStore state to a LayoutFile object */
export function exportLayoutData(): LayoutFile {
	const state = useLayoutStore.getState();
	return {
		version: 1,
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
	};
}

/** Export current layout as a JSON file download */
export function downloadLayoutAsJson(filename = "fab-layout.json"): void {
	const data = exportLayoutData();
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();

	URL.revokeObjectURL(url);
}
