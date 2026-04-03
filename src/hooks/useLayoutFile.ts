import { useCallback, useState } from "react";
import { downloadLayoutAsJson, importLayoutFromFile } from "@/utils/layoutIO";

// ─── Hook Return Type ───────────────────────────────────────────

interface UseLayoutFileReturn {
	/** Triggers a browser download of the current layout as JSON */
	exportLayout: () => void;
	/** Import a layout from a File object, returns success/error */
	importLayout: (file: File) => Promise<{ success: boolean; error?: string }>;
	/** Whether an import operation is currently in progress */
	isImporting: boolean;
}

// ─── Hook ───────────────────────────────────────────────────────

/** Hook for layout file save/load operations */
export function useLayoutFile(): UseLayoutFileReturn {
	const [isImporting, setIsImporting] = useState(false);

	const exportLayout = useCallback((): void => {
		downloadLayoutAsJson();
	}, []);

	const importLayout = useCallback(
		async (file: File): Promise<{ success: boolean; error?: string }> => {
			setIsImporting(true);
			try {
				const result = await importLayoutFromFile(file);
				return result;
			} finally {
				setIsImporting(false);
			}
		},
		[],
	);

	return { exportLayout, importLayout, isImporting };
}
