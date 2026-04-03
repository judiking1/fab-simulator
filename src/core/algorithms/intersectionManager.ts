import type { EntityId } from "@/types/common";

// ─── Intersection Manager ───────────────────────────────────────
// FIFO reservation system for rail intersection points (confluence/branch).
// Prevents collisions at merge/split points by queuing vehicle access.
// Includes configurable timeout-based deadlock prevention.

interface ReservationEntry {
	vehicleId: EntityId;
	reservedAt: number; // simulation time
}

export class IntersectionManager {
	/** pointId → ordered queue of vehicle reservations (first = granted) */
	private reservations = new Map<EntityId, ReservationEntry[]>();
	/** Deadlock timeout in simulation seconds */
	private readonly timeout: number;

	constructor(timeoutSeconds = 30) {
		this.timeout = timeoutSeconds;
	}

	/**
	 * Request reservation at an intersection point.
	 * @returns 'granted' if the vehicle gets immediate access, 'queued' if it must wait
	 */
	reserve(vehicleId: EntityId, pointId: EntityId, simTime: number): "granted" | "queued" {
		let queue = this.reservations.get(pointId);
		if (!queue) {
			queue = [];
			this.reservations.set(pointId, queue);
		}

		// Check if already in queue
		const existing = queue.find((e) => e.vehicleId === vehicleId);
		if (existing) {
			return queue[0]?.vehicleId === vehicleId ? "granted" : "queued";
		}

		// Clean up timed-out reservations before adding
		this.cleanupTimeouts(pointId, simTime);

		queue.push({ vehicleId, reservedAt: simTime });

		return queue.length === 1 ? "granted" : "queued";
	}

	/**
	 * Release a vehicle's reservation at an intersection point.
	 */
	release(vehicleId: EntityId, pointId: EntityId): void {
		const queue = this.reservations.get(pointId);
		if (!queue) return;

		const index = queue.findIndex((e) => e.vehicleId === vehicleId);
		if (index !== -1) {
			queue.splice(index, 1);
		}

		// Clean up empty queues
		if (queue.length === 0) {
			this.reservations.delete(pointId);
		}
	}

	/**
	 * Get the vehicle's position in the queue (0 = granted, -1 = not in queue).
	 */
	getQueuePosition(vehicleId: EntityId, pointId: EntityId): number {
		const queue = this.reservations.get(pointId);
		if (!queue) return -1;
		return queue.findIndex((e) => e.vehicleId === vehicleId);
	}

	/**
	 * Check if a point currently has any reservation.
	 */
	isReserved(pointId: EntityId): boolean {
		const queue = this.reservations.get(pointId);
		return queue !== undefined && queue.length > 0;
	}

	/**
	 * Get the vehicle currently holding the reservation (first in queue).
	 */
	getCurrentHolder(pointId: EntityId): EntityId | null {
		const queue = this.reservations.get(pointId);
		return queue?.[0]?.vehicleId ?? null;
	}

	/**
	 * Get the next vehicle in queue after release (if any).
	 */
	getNextInQueue(pointId: EntityId): EntityId | null {
		const queue = this.reservations.get(pointId);
		return queue?.[0]?.vehicleId ?? null;
	}

	/** Reset all reservations */
	clear(): void {
		this.reservations.clear();
	}

	/**
	 * Remove timed-out reservations to prevent deadlocks.
	 * Vehicles holding a reservation longer than `timeout` seconds are evicted.
	 */
	private cleanupTimeouts(pointId: EntityId, currentTime: number): void {
		const queue = this.reservations.get(pointId);
		if (!queue) return;

		const validEntries = queue.filter((entry) => currentTime - entry.reservedAt < this.timeout);

		if (validEntries.length !== queue.length) {
			this.reservations.set(pointId, validEntries);
		}
	}
}
