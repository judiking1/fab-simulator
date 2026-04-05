/**
 * ID generation utility for map entities.
 * Produces collision-resistant IDs with entity-type prefixes.
 *
 * Format: "{PREFIX}_{8 hex chars}"
 * Example: "N_a1b2c3d4" for nodes, "R_e5f6g7h8" for rails
 */

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
