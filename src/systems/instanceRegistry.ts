/**
 * Instance Registry — Maps InstancedMesh instance indices to entity IDs.
 *
 * When Three.js raycasts against an InstancedMesh, it returns `instanceId`
 * (the index). This registry resolves that index to an EntityRef.
 *
 * Module-scoped Map — not a Zustand store because it's only accessed
 * imperatively during raycasting and never triggers React renders.
 */

import type { EntityKind } from "@/models/editor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeshRegistration {
	kind: EntityKind;
	/** Maps instance index → entity ID */
	indexToId: string[];
}

// ---------------------------------------------------------------------------
// Registry (module-scoped singleton)
// ---------------------------------------------------------------------------

const registry = new Map<string, MeshRegistration>();

/**
 * Register an InstancedMesh's mapping from instance indices to entity IDs.
 * Called by renderers after rebuilding their instance arrays.
 *
 * @param meshUuid - The Three.js Object3D.uuid of the InstancedMesh
 * @param kind - The entity kind this mesh renders
 * @param indexToId - Array mapping instance index → entity ID
 */
export function registerMesh(
	meshUuid: string,
	kind: EntityKind,
	indexToId: string[],
): void {
	registry.set(meshUuid, { kind, indexToId });
}

/**
 * Unregister an InstancedMesh (e.g. on component unmount).
 */
export function unregisterMesh(meshUuid: string): void {
	registry.delete(meshUuid);
}

/**
 * Resolve a raycast hit on an InstancedMesh to an EntityRef.
 *
 * @param meshUuid - The uuid of the intersected mesh
 * @param instanceId - The instance index from intersection.instanceId
 * @returns EntityRef or null if the mesh/index is not registered
 */
export function resolveInstance(
	meshUuid: string,
	instanceId: number,
): { kind: EntityKind; id: string } | null {
	const reg = registry.get(meshUuid);
	if (!reg) return null;

	const id = reg.indexToId[instanceId];
	if (!id) return null;

	return { kind: reg.kind, id };
}

/**
 * Clear all registrations (e.g. on map clear).
 */
export function clearRegistry(): void {
	registry.clear();
}
