import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Dev-only: expose stores for debugging/testing
if (import.meta.env.DEV) {
	import("./stores/mapStore").then((m) => {
		(window as unknown as Record<string, unknown>).__mapStore = m.useMapStore;
	});
	import("./stores/uiStore").then((m) => {
		(window as unknown as Record<string, unknown>).__uiStore = m.useUiStore;
	});
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
