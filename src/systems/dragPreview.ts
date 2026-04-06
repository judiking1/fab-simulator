/**
 * Drag Preview — Imperative drag state without Zustand store updates.
 *
 * During drag, node positions are NOT updated in mapStore. Instead, a
 * module-scoped offset is maintained and applied directly to InstancedMesh
 * matrices in useFrame. Only on drag commit does the store get updated.
 *
 * This eliminates the pointermove → Zustand set() → re-render bottleneck.
 */

import type { NodeData } from "@/models/node";

// ---------------------------------------------------------------------------
// State (module-scoped, not reactive)
// ---------------------------------------------------------------------------

interface DragState {
	active: boolean;
	/** Node IDs being dragged */
	nodeIds: Set<string>;
	/** Initial positions before drag (for undo) */
	startPositions: Map<string, { x: number; y: number; z: number }>;
	/** Current world-space offset from drag start */
	offsetX: number;
	offsetZ: number;
}

const state: DragState = {
	active: false,
	nodeIds: new Set(),
	startPositions: new Map(),
	offsetX: 0,
	offsetZ: 0,
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Start a drag operation. Snapshots initial node positions. */
export function startDrag(
	nodes: Record<string, NodeData>,
	nodeIds: string[],
): void {
	state.active = true;
	state.nodeIds = new Set(nodeIds);
	state.startPositions = new Map();
	state.offsetX = 0;
	state.offsetZ = 0;

	for (const id of nodeIds) {
		const node = nodes[id];
		if (node) {
			state.startPositions.set(id, { x: node.x, y: node.y, z: node.z });
		}
	}
}

/** Update drag offset (called from pointermove — no store update!) */
export function updateDragOffset(dx: number, dz: number): void {
	state.offsetX = dx;
	state.offsetZ = dz;
}

/** Check if drag is active */
export function isDragActive(): boolean {
	return state.active;
}

/** Get the current offset */
export function getDragOffset(): { x: number; z: number } {
	return { x: state.offsetX, z: state.offsetZ };
}

/** Get dragged node IDs */
export function getDragNodeIds(): Set<string> {
	return state.nodeIds;
}

/** Get the final position of a dragged node (start + offset) */
export function getDraggedPosition(nodeId: string): { x: number; y: number; z: number } | null {
	const start = state.startPositions.get(nodeId);
	if (!start) return null;
	return {
		x: start.x + state.offsetX,
		y: start.y,
		z: start.z + state.offsetZ,
	};
}

/** Get start positions (for undo command) */
export function getStartPositions(): Map<string, { x: number; y: number; z: number }> {
	return new Map(state.startPositions);
}

/** End drag without committing (cancel) */
export function cancelDrag(): void {
	state.active = false;
	state.nodeIds.clear();
	state.startPositions.clear();
	state.offsetX = 0;
	state.offsetZ = 0;
}

/** End drag — caller should commit to store */
export function endDrag(): {
	startPositions: Map<string, { x: number; y: number; z: number }>;
	offsetX: number;
	offsetZ: number;
} {
	const result = {
		startPositions: new Map(state.startPositions),
		offsetX: state.offsetX,
		offsetZ: state.offsetZ,
	};

	state.active = false;
	state.nodeIds.clear();
	state.startPositions.clear();
	state.offsetX = 0;
	state.offsetZ = 0;

	return result;
}
