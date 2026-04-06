/**
 * useViewportInteraction — Redesigned pointer event state machine.
 *
 * Key improvements over v1:
 *   - Drag uses dragPreview (no store updates during drag → no lag)
 *   - Drag plane matches node Y height (not fixed Y=0)
 *   - Rubber-band coordinates relative to Canvas rect
 *   - InstancedMesh list cached (no scene.traverse per raycast)
 *   - Cursor feedback (grab/grabbing/crosshair)
 */

import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import {
	type InstancedMesh,
	Plane,
	Raycaster,
	Vector2,
	Vector3,
} from "three";
import type { EntityRef } from "@/models/editor";
import { ENTITY_KIND } from "@/models/editor";
import { useHistoryStore } from "@/stores/historyStore";
import { useMapStore } from "@/stores/mapStore";
import { useUiStore } from "@/stores/uiStore";
import {
	endDrag,
	getDragOffset,
	getStartPositions,
	startDrag,
	updateDragOffset,
} from "@/systems/dragPreview";
import { resolveInstance } from "@/systems/instanceRegistry";

// ---------------------------------------------------------------------------
// Module-scoped temporaries
// ---------------------------------------------------------------------------

const _mouse = new Vector2();
const _raycaster = new Raycaster();
const _intersectPoint = new Vector3();
const _dragStartWorld = new Vector3();
const _dragCurrentWorld = new Vector3();
const _dragPlane = new Plane(new Vector3(0, 1, 0), 0);

type InteractionState = "IDLE" | "PENDING" | "DRAGGING" | "RUBBER_BAND";

interface PendingInfo {
	screenX: number;
	screenY: number;
	hitRef: EntityRef | null;
	shiftKey: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useViewportInteraction(): void {
	const { camera, scene, gl } = useThree();
	const stateRef = useRef<InteractionState>("IDLE");
	const pendingRef = useRef<PendingInfo | null>(null);
	const meshCacheRef = useRef<InstancedMesh[]>([]);
	const meshCacheDirtyRef = useRef(true);

	useEffect(() => {
		const domElement = gl.domElement;

		// Mark mesh cache dirty when scene changes
		const interval = setInterval(() => {
			meshCacheDirtyRef.current = true;
		}, 2000);

		function getInstancedMeshes(): InstancedMesh[] {
			if (meshCacheDirtyRef.current) {
				const meshes: InstancedMesh[] = [];
				scene.traverse((obj) => {
					if ((obj as InstancedMesh).isInstancedMesh) {
						meshes.push(obj as InstancedMesh);
					}
				});
				meshCacheRef.current = meshes;
				meshCacheDirtyRef.current = false;
			}
			return meshCacheRef.current;
		}

		function screenToNDC(clientX: number, clientY: number): void {
			const rect = domElement.getBoundingClientRect();
			_mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
			_mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		}

		function raycastEntities(clientX: number, clientY: number): EntityRef | null {
			screenToNDC(clientX, clientY);
			_raycaster.setFromCamera(_mouse, camera);

			const meshes = getInstancedMeshes();
			const intersections = _raycaster.intersectObjects(meshes, false);
			for (const hit of intersections) {
				if (hit.instanceId === undefined) continue;
				const resolved = resolveInstance(hit.object.uuid, hit.instanceId);
				if (resolved) return resolved;
			}
			return null;
		}

		function screenToWorldOnPlane(clientX: number, clientY: number, plane: Plane): Vector3 | null {
			screenToNDC(clientX, clientY);
			_raycaster.setFromCamera(_mouse, camera);
			const hit = _raycaster.ray.intersectPlane(plane, _intersectPoint);
			return hit ? _intersectPoint.clone() : null;
		}

		function canvasLocalCoords(clientX: number, clientY: number): { x: number; y: number } {
			const rect = domElement.getBoundingClientRect();
			return { x: clientX - rect.left, y: clientY - rect.top };
		}

		function setCursor(cursor: string): void {
			domElement.style.cursor = cursor;
		}

		// -------------------------------------------------------------------
		// Pointer Down
		// -------------------------------------------------------------------
		function handlePointerDown(e: PointerEvent): void {
			if (e.button !== 0) return;
			if (stateRef.current !== "IDLE") return;

			const editorMode = useUiStore.getState().editorMode;
			if (editorMode !== "select") return;

			const hitRef = raycastEntities(e.clientX, e.clientY);

			pendingRef.current = {
				screenX: e.clientX,
				screenY: e.clientY,
				hitRef,
				shiftKey: e.shiftKey,
			};
			stateRef.current = "PENDING";
		}

		// -------------------------------------------------------------------
		// Pointer Move
		// -------------------------------------------------------------------
		function handlePointerMove(e: PointerEvent): void {
			const state = stateRef.current;
			const pending = pendingRef.current;

			// Hover cursor feedback when idle
			if (state === "IDLE") {
				const hit = raycastEntities(e.clientX, e.clientY);
				setCursor(hit ? "grab" : "default");
				return;
			}

			if (state === "PENDING" && pending) {
				const dx = e.clientX - pending.screenX;
				const dy = e.clientY - pending.screenY;
				if (Math.sqrt(dx * dx + dy * dy) <= 4) return; // Below threshold

				if (pending.hitRef) {
					// --- Start DRAGGING ---
					const uiState = useUiStore.getState();
					if (!uiState.isSelected(pending.hitRef.kind, pending.hitRef.id)) {
						uiState.select(pending.hitRef);
					}

					// Collect all node IDs to drag
					const mapState = useMapStore.getState();
					const nodeIds: string[] = [];
					for (const ref of useUiStore.getState().selectedEntities) {
						if (ref.kind === ENTITY_KIND.NODE) {
							nodeIds.push(ref.id);
						} else if (ref.kind === ENTITY_KIND.RAIL) {
							const rail = mapState.rails[ref.id];
							if (rail) {
								if (!nodeIds.includes(rail.fromNodeId)) nodeIds.push(rail.fromNodeId);
								if (!nodeIds.includes(rail.toNodeId)) nodeIds.push(rail.toNodeId);
							}
						}
					}

					if (nodeIds.length === 0) {
						stateRef.current = "IDLE";
						pendingRef.current = null;
						return;
					}

					// Set drag plane at average Y of selected nodes
					let avgY = 0;
					for (const id of nodeIds) {
						const node = mapState.nodes[id];
						if (node) avgY += node.y;
					}
					avgY /= nodeIds.length;
					_dragPlane.set(new Vector3(0, 1, 0), -avgY);

					// Start drag preview
					startDrag(mapState.nodes, nodeIds);

					const worldPos = screenToWorldOnPlane(e.clientX, e.clientY, _dragPlane);
					if (worldPos) _dragStartWorld.copy(worldPos);

					setCursor("grabbing");
					stateRef.current = "DRAGGING";
				} else {
					// --- Start RUBBER BAND ---
					const start = canvasLocalCoords(pending.screenX, pending.screenY);
					const current = canvasLocalCoords(e.clientX, e.clientY);
					useUiStore.getState().setRubberBand({
						x0: start.x, y0: start.y,
						x1: current.x, y1: current.y,
					});
					setCursor("crosshair");
					stateRef.current = "RUBBER_BAND";
				}
			} else if (state === "DRAGGING") {
				const worldPos = screenToWorldOnPlane(e.clientX, e.clientY, _dragPlane);
				if (!worldPos) return;
				_dragCurrentWorld.copy(worldPos);

				const dx = _dragCurrentWorld.x - _dragStartWorld.x;
				const dz = _dragCurrentWorld.z - _dragStartWorld.z;

				// Update drag preview offset (NO store update — imperative only)
				updateDragOffset(dx, dz);
			} else if (state === "RUBBER_BAND" && pending) {
				const start = canvasLocalCoords(pending.screenX, pending.screenY);
				const current = canvasLocalCoords(e.clientX, e.clientY);
				useUiStore.getState().setRubberBand({
					x0: start.x, y0: start.y,
					x1: current.x, y1: current.y,
				});
			}
		}

		// -------------------------------------------------------------------
		// Pointer Up
		// -------------------------------------------------------------------
		function handlePointerUp(_e: PointerEvent): void {
			const state = stateRef.current;
			const pending = pendingRef.current;

			if (state === "PENDING" && pending) {
				// Click select
				const uiState = useUiStore.getState();
				if (pending.hitRef) {
					if (pending.shiftKey) {
						uiState.toggleSelection(pending.hitRef);
					} else {
						uiState.select(pending.hitRef);
					}
				} else {
					uiState.clearSelection();
				}
			} else if (state === "DRAGGING") {
				// Commit drag: apply store FIRST, then end drag preview
				// (prevents ghost frame where both dragPreview and store are stale)
				const startPositions = getStartPositions();
				const { x: offsetX, z: offsetZ } = getDragOffset();

				if (startPositions.size > 0 && (Math.abs(offsetX) > 0.001 || Math.abs(offsetZ) > 0.001)) {
					const before = new Map<string, { x: number; z: number }>();
					const after = new Map<string, { x: number; z: number }>();
					for (const [id, pos] of startPositions) {
						before.set(id, { x: pos.x, z: pos.z });
						after.set(id, { x: pos.x + offsetX, z: pos.z + offsetZ });
					}

					// Apply to store FIRST
					const updates = [...after].map(([id, pos]) => ({
						id,
						changes: { x: pos.x, z: pos.z },
					}));
					useMapStore.getState().batchUpdate({ nodes: updates });

					// Record for undo (already applied)
					useHistoryStore.getState().record({
						label: `Move ${before.size} node(s)`,
						execute: () => {
							const fwd = [...after].map(([id, pos]) => ({
								id,
								changes: { x: pos.x, z: pos.z },
							}));
							useMapStore.getState().batchUpdate({ nodes: fwd });
						},
						undo: () => {
							const rev = [...before].map(([id, pos]) => ({
								id,
								changes: { x: pos.x, z: pos.z },
							}));
							useMapStore.getState().batchUpdate({ nodes: rev });
						},
					});
				}

				// End drag preview AFTER store is updated
				endDrag();
				setCursor("default");
			} else if (state === "RUBBER_BAND") {
				const rubberBand = useUiStore.getState().rubberBand;
				if (rubberBand) {
					const refs = computeRubberBandSelection(rubberBand, camera, domElement);
					useUiStore.getState().selectMultiple(refs);
				}
				useUiStore.getState().setRubberBand(null);
				setCursor("default");
			}

			stateRef.current = "IDLE";
			pendingRef.current = null;
		}

		domElement.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);

		return () => {
			domElement.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
			clearInterval(interval);
		};
	}, [camera, scene, gl]);
}

// ---------------------------------------------------------------------------
// Rubber-band selection
// ---------------------------------------------------------------------------

function computeRubberBandSelection(
	rect: { x0: number; y0: number; x1: number; y1: number },
	camera: import("three").Camera,
	domElement: HTMLCanvasElement,
): EntityRef[] {
	const { nodes, rails, equipment } = useMapStore.getState();
	const refs: EntityRef[] = [];

	const canvasRect = domElement.getBoundingClientRect();
	const minX = Math.min(rect.x0, rect.x1);
	const maxX = Math.max(rect.x0, rect.x1);
	const minY = Math.min(rect.y0, rect.y1);
	const maxY = Math.max(rect.y0, rect.y1);

	const _proj = new Vector3();

	function isInRect(wx: number, wy: number, wz: number): boolean {
		_proj.set(wx, wy, wz).project(camera);
		// NDC → canvas-local coords (not client coords!)
		const sx = ((1 + _proj.x) / 2) * canvasRect.width;
		const sy = ((1 - _proj.y) / 2) * canvasRect.height;
		return sx >= minX && sx <= maxX && sy >= minY && sy <= maxY;
	}

	for (const node of Object.values(nodes)) {
		if (isInRect(node.x, node.y, node.z)) {
			refs.push({ kind: ENTITY_KIND.NODE, id: node.id });
		}
	}

	for (const rail of Object.values(rails)) {
		const fn = nodes[rail.fromNodeId];
		const tn = nodes[rail.toNodeId];
		if (!fn || !tn) continue;
		if (isInRect((fn.x + tn.x) / 2, (fn.y + tn.y) / 2, (fn.z + tn.z) / 2)) {
			refs.push({ kind: ENTITY_KIND.RAIL, id: rail.id });
		}
	}

	for (const eq of Object.values(equipment)) {
		const rail = rails[eq.railId];
		if (!rail) continue;
		const fn = nodes[rail.fromNodeId];
		const tn = nodes[rail.toNodeId];
		if (!fn || !tn) continue;
		if (isInRect(
			fn.x + (tn.x - fn.x) * eq.ratio,
			fn.y + (tn.y - fn.y) * eq.ratio,
			fn.z + (tn.z - fn.z) * eq.ratio,
		)) {
			refs.push({ kind: ENTITY_KIND.EQUIPMENT, id: eq.id });
		}
	}

	return refs;
}
