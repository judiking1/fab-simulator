/** Unique entity identifier (globally unique across all entity types) */
export type EntityId = string;

/** 3D position in world space */
export interface Vector3 {
	x: number;
	y: number;
	z: number;
}

/** Rotation in radians (Euler angles) */
export interface Rotation3 {
	x: number;
	y: number;
	z: number;
}

/** Generates a globally unique entity ID with a type prefix */
export function createEntityId(prefix: string): EntityId {
	return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
