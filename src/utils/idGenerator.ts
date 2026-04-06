/**
 * ID generation utility for map entities.
 * Produces collision-resistant IDs with entity-type prefixes.
 *
 * Format: "{PREFIX}_{8 hex chars}"
 * Example: "N_a1b2c3d4" for nodes, "R_e5f6g7h8" for rails
 */

import type { EquipmentData } from "@/models/equipment";
import type { NodeData } from "@/models/node";
import type { PortData } from "@/models/port";
import type { RailData } from "@/models/rail";

let counter = 0;

/**
 * Generate a prefixed unique ID.
 * Uses crypto.getRandomValues for randomness + monotonic counter for uniqueness.
 *
 * @param prefix - Entity type prefix (e.g. "N" for node, "R" for rail)
 * @returns A unique ID string like "N_a1b2c3d4"
 */
export function generateId(prefix: string): string {
	const buf = new Uint32Array(1);
	crypto.getRandomValues(buf);
	// Mix random value with counter to guarantee uniqueness within session
	const mixed = ((buf[0] ?? 0) ^ (counter++ * 0x9e3779b9)) >>> 0;
	const hex = mixed.toString(16).padStart(8, "0");
	return `${prefix}_${hex}`;
}

// ---------------------------------------------------------------------------
// Deep Clone with ID Remap
// ---------------------------------------------------------------------------

/**
 * Input for deep clone operation — arrays of entities to clone.
 */
export interface CloneInput {
	nodes: NodeData[];
	rails: RailData[];
	ports: PortData[];
	equipment: EquipmentData[];
}

/**
 * Result of a deep clone — cloned entities with fresh IDs + the mapping.
 */
export interface CloneResult {
	nodes: NodeData[];
	rails: RailData[];
	ports: PortData[];
	equipment: EquipmentData[];
	/** Maps every old entity ID to its new generated ID */
	idMap: Record<string, string>;
}

/**
 * Deep clone a set of map entities, generating fresh IDs for every entity
 * and remapping all internal references (fromNodeId, toNodeId, railId, etc.).
 *
 * This is the SINGLE SOURCE OF TRUTH for all clone/copy operations.
 * Every clone path in the app MUST use this function to ensure ID safety.
 */
export function deepCloneWithIdRemap(input: CloneInput): CloneResult {
	const idMap: Record<string, string> = {};

	// 1. Build idMap: generate a new ID for every entity
	for (const node of input.nodes) {
		idMap[node.id] = generateId("N");
	}
	for (const rail of input.rails) {
		idMap[rail.id] = generateId("R");
	}
	for (const port of input.ports) {
		idMap[port.id] = generateId("P");
	}
	for (const eq of input.equipment) {
		idMap[eq.id] = generateId("EQ");
	}

	// Helper: remap an ID through the map, falling back to the original
	// if it references an entity outside the clone set (e.g. a shared bayId).
	const remap = (oldId: string): string => idMap[oldId] ?? oldId;

	// 2. Clone and remap each entity type

	const nodes: NodeData[] = input.nodes.map((n) => ({
		...n,
		id: remap(n.id),
	}));

	const rails: RailData[] = input.rails.map((r) => ({
		...r,
		id: remap(r.id),
		fromNodeId: remap(r.fromNodeId),
		toNodeId: remap(r.toNodeId),
		curveNodeIds: r.curveNodeIds.map(remap),
		// Deep copy nullable objects to prevent shared references
		originFrom: r.originFrom ? { ...r.originFrom } : null,
		originTo: r.originTo ? { ...r.originTo } : null,
	}));

	const ports: PortData[] = input.ports.map((p) => ({
		...p,
		id: remap(p.id),
		railId: remap(p.railId),
		equipmentId: remap(p.equipmentId),
	}));

	const equipment: EquipmentData[] = input.equipment.map((eq) => ({
		...eq,
		id: remap(eq.id),
		railId: remap(eq.railId),
		portIds: eq.portIds.map(remap),
	}));

	return { nodes, rails, ports, equipment, idMap };
}

// ---------------------------------------------------------------------------
// ID Collision Check
// ---------------------------------------------------------------------------

/**
 * Verify that none of the given IDs exist in the provided entity records.
 * Throws if any collision is found.
 *
 * Use this after cloning or importing to ensure no duplicate IDs
 * would be introduced into the store.
 */
export function assertNoIdCollisions(
	ids: string[],
	existingRecords: Record<string, unknown>[],
): void {
	const collisions: string[] = [];

	for (const id of ids) {
		for (const record of existingRecords) {
			if (id in record) {
				collisions.push(id);
				break;
			}
		}
	}

	if (collisions.length > 0) {
		throw new Error(
			`ID collision detected: ${collisions.join(", ")}. ` +
				`${collisions.length} ID(s) already exist in the target store.`,
		);
	}
}
