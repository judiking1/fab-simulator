/**
 * History Store — Undo/redo via Command pattern.
 *
 * Each UndoableCommand captures execute/undo closures that call mapStore CRUD.
 * Since mapStore CRUD triggers dirty flags, the 3-Layer rendering pipeline
 * updates automatically with zero additional wiring.
 *
 * Memory budget: max 100 commands, ~20MB worst case.
 */

import { create } from "zustand";

// ---------------------------------------------------------------------------
// Command interface
// ---------------------------------------------------------------------------

/** Undoable command — captures execute/undo closures */
export interface UndoableCommand {
	/** Human-readable label for the command (e.g. "Add Node") */
	label: string;
	/** Forward execution — called on push() and redo() */
	execute: () => void;
	/** Reverse execution — called on undo() */
	undo: () => void;
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface HistoryState {
	undoStack: UndoableCommand[];
	redoStack: UndoableCommand[];
	maxSize: number;

	// Derived
	canUndo: boolean;
	canRedo: boolean;

	// Actions
	push: (command: UndoableCommand) => void;
	/** Record a command without executing it (for already-applied changes like drag) */
	record: (command: UndoableCommand) => void;
	undo: () => void;
	redo: () => void;
	clear: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useHistoryStore = create<HistoryState>((set, get) => ({
	undoStack: [],
	redoStack: [],
	maxSize: 100,
	canUndo: false,
	canRedo: false,

	// ── Push (execute + record) ─────────────────────────────────

	push: (command) => {
		command.execute();
		set((s) => {
			const newStack = [...s.undoStack, command];
			if (newStack.length > s.maxSize) {
				newStack.splice(0, newStack.length - s.maxSize);
			}
			return {
				undoStack: newStack,
				redoStack: [],
				canUndo: true,
				canRedo: false,
			};
		});
	},

	// ── Record (already executed — just add to undo stack) ──────

	record: (command) => {
		set((s) => {
			const newStack = [...s.undoStack, command];
			if (newStack.length > s.maxSize) {
				newStack.splice(0, newStack.length - s.maxSize);
			}
			return {
				undoStack: newStack,
				redoStack: [],
				canUndo: true,
				canRedo: false,
			};
		});
	},

	// ── Undo ────────────────────────────────────────────────────

	undo: () => {
		const state = get();
		if (state.undoStack.length === 0) return;

		const command = state.undoStack[state.undoStack.length - 1];
		if (!command) return;

		command.undo();

		set((s) => {
			const newUndoStack = s.undoStack.slice(0, -1);
			const newRedoStack = [...s.redoStack, command];
			return {
				undoStack: newUndoStack,
				redoStack: newRedoStack,
				canUndo: newUndoStack.length > 0,
				canRedo: true,
			};
		});
	},

	// ── Redo ────────────────────────────────────────────────────

	redo: () => {
		const state = get();
		if (state.redoStack.length === 0) return;

		const command = state.redoStack[state.redoStack.length - 1];
		if (!command) return;

		command.execute();

		set((s) => {
			const newRedoStack = s.redoStack.slice(0, -1);
			const newUndoStack = [...s.undoStack, command];
			return {
				undoStack: newUndoStack,
				redoStack: newRedoStack,
				canUndo: true,
				canRedo: newRedoStack.length > 0,
			};
		});
	},

	// ── Clear ───────────────────────────────────────────────────

	clear: () => {
		set({
			undoStack: [],
			redoStack: [],
			canUndo: false,
			canRedo: false,
		});
	},
}));

// ---------------------------------------------------------------------------
// Selectors (React subscription optimization)
// ---------------------------------------------------------------------------

/** Whether undo is available */
export const selectCanUndo = (s: HistoryState): boolean => s.undoStack.length > 0;

/** Whether redo is available */
export const selectCanRedo = (s: HistoryState): boolean => s.redoStack.length > 0;
