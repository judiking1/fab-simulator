import { create } from "zustand";
import type { EntityId } from "@/types/common";

// ─── Camera Modes ────────────────────────────────────────────────

export const CAMERA_MODES = {
	/** Free navigation: WASD/drag movement, free rotation */
	FREE: "free",
	/** Track a specific OHT during playback */
	FOLLOW_OHT: "follow_oht",
	/** Top-down fab-wide view */
	OVERVIEW: "overview",
	/** Zoom into a specific equipment with smooth transition */
	EQUIPMENT_FOCUS: "equipment_focus",
} as const;

export type CameraMode = (typeof CAMERA_MODES)[keyof typeof CAMERA_MODES];

// ─── Camera Store ────────────────────────────────────────────────

interface CameraState {
	mode: CameraMode;
	/** Entity ID being tracked/focused (OHT or equipment). Null in free/overview mode. */
	targetId: EntityId | null;

	setFreeMode: () => void;
	followOht: (ohtId: EntityId) => void;
	setOverview: () => void;
	focusEquipment: (equipmentId: EntityId) => void;
}

export const useCameraStore = create<CameraState>((set) => ({
	mode: CAMERA_MODES.FREE,
	targetId: null,

	setFreeMode: () => set({ mode: CAMERA_MODES.FREE, targetId: null }),
	followOht: (ohtId) => set({ mode: CAMERA_MODES.FOLLOW_OHT, targetId: ohtId }),
	setOverview: () => set({ mode: CAMERA_MODES.OVERVIEW, targetId: null }),
	focusEquipment: (equipmentId) =>
		set({ mode: CAMERA_MODES.EQUIPMENT_FOCUS, targetId: equipmentId }),
}));
