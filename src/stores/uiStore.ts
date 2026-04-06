/**
 * UI Store — Editor UI state (selection, mode, clipboard).
 *
 * This state is transient and never serialized to .fab.json.
 * Separate from mapStore to keep rendering and editing concerns isolated.
 */

import { create } from "zustand";
import type { ClipboardPayload, EditorMode, EntityKind, EntityRef } from "@/models/editor";
import { EDITOR_MODE } from "@/models/editor";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface UiState {
	// Selection
	selectedEntities: EntityRef[];
	hoveredEntity: EntityRef | null;

	// Editor mode
	editorMode: EditorMode;

	// Clipboard
	clipboard: ClipboardPayload | null;

	// Rubber-band selection (screen-space coords)
	rubberBand: { x0: number; y0: number; x1: number; y1: number } | null;

	// Grid snap
	snapToGrid: boolean;
	gridSize: number;

	// Actions
	select: (ref: EntityRef, additive?: boolean) => void;
	selectMultiple: (refs: EntityRef[]) => void;
	clearSelection: () => void;
	toggleSelection: (ref: EntityRef) => void;
	setHovered: (ref: EntityRef | null) => void;
	setEditorMode: (mode: EditorMode) => void;
	setClipboard: (payload: ClipboardPayload | null) => void;
	setRubberBand: (rect: { x0: number; y0: number; x1: number; y1: number } | null) => void;
	setSnapToGrid: (enabled: boolean) => void;
	setGridSize: (size: number) => void;

	// Derived helpers
	isSelected: (kind: EntityKind, id: string) => boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entityMatch(a: EntityRef, b: EntityRef): boolean {
	return a.kind === b.kind && a.id === b.id;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUiStore = create<UiState>((set, get) => ({
	// Defaults
	selectedEntities: [],
	hoveredEntity: null,
	editorMode: EDITOR_MODE.SELECT,
	clipboard: null,
	rubberBand: null,
	snapToGrid: false,
	gridSize: 0,

	// ── Selection ───────────────────────────────────────────────

	select: (ref, additive = false) => {
		if (additive) {
			set((s) => {
				const already = s.selectedEntities.some((e) => entityMatch(e, ref));
				if (already) return s;
				return { selectedEntities: [...s.selectedEntities, ref] };
			});
		} else {
			set({ selectedEntities: [ref] });
		}
	},

	selectMultiple: (refs) => {
		set({ selectedEntities: refs });
	},

	clearSelection: () => {
		set({ selectedEntities: [], hoveredEntity: null });
	},

	toggleSelection: (ref) => {
		set((s) => {
			const idx = s.selectedEntities.findIndex((e) => entityMatch(e, ref));
			if (idx === -1) {
				return { selectedEntities: [...s.selectedEntities, ref] };
			}
			return {
				selectedEntities: [
					...s.selectedEntities.slice(0, idx),
					...s.selectedEntities.slice(idx + 1),
				],
			};
		});
	},

	setHovered: (ref) => {
		set({ hoveredEntity: ref });
	},

	// ── Editor Mode ─────────────────────────────────────────────

	setEditorMode: (mode) => {
		set({ editorMode: mode });
	},

	// ── Clipboard ───────────────────────────────────────────────

	setClipboard: (payload) => {
		set({ clipboard: payload });
	},

	// ── Rubber-band ─────────────────────────────────────────────

	setRubberBand: (rect) => {
		set({ rubberBand: rect });
	},

	// ── Grid Snap ───────────────────────────────────────────────

	setSnapToGrid: (enabled) => {
		set({ snapToGrid: enabled });
	},

	setGridSize: (size) => {
		set({ gridSize: Math.max(0.1, size) });
	},

	// ── Derived ─────────────────────────────────────────────────

	isSelected: (kind, id) => {
		return get().selectedEntities.some((e) => e.kind === kind && e.id === id);
	},
}));

// ---------------------------------------------------------------------------
// Selectors (React subscription optimization)
// ---------------------------------------------------------------------------

/** Number of currently selected entities */
export const selectSelectedCount = (s: UiState): number => s.selectedEntities.length;

/** Current editor mode */
export const selectEditorMode = (s: UiState): EditorMode => s.editorMode;

/** Whether grid snapping is enabled */
export const selectIsSnapEnabled = (s: UiState): boolean => s.snapToGrid;
