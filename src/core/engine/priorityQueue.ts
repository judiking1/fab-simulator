import type { SimEvent } from "@/types/simulation";

// ─── Min-Heap Priority Queue ────────────────────────────────────
// Time-ordered event queue for DES. Backed by a binary heap array.
// Insert: O(log n), ExtractMin: O(log n), Peek: O(1).
// Handles 1M+ events efficiently.

export class PriorityQueue {
	private heap: SimEvent[] = [];

	get size(): number {
		return this.heap.length;
	}

	get isEmpty(): boolean {
		return this.heap.length === 0;
	}

	/** Insert an event into the queue, maintaining min-heap order by time */
	insert(event: SimEvent): void {
		this.heap.push(event);
		this.bubbleUp(this.heap.length - 1);
	}

	/** Remove and return the earliest event (smallest time) */
	extractMin(): SimEvent | undefined {
		const { heap } = this;
		if (heap.length === 0) return undefined;
		if (heap.length === 1) return heap.pop();

		const min = heap[0];
		// Move last element to root and sift down
		const last = heap.pop();
		if (last === undefined) return min;
		heap[0] = last;
		this.siftDown(0);
		return min;
	}

	/** View the earliest event without removing it */
	peek(): SimEvent | undefined {
		return this.heap[0];
	}

	/** Remove all events from the queue */
	clear(): void {
		this.heap = [];
	}

	// ─── Heap Operations ──────────────────────────────────────────

	private bubbleUp(index: number): void {
		const { heap } = this;
		while (index > 0) {
			const parentIdx = (index - 1) >> 1;
			const parent = heap[parentIdx];
			const current = heap[index];
			if (parent === undefined || current === undefined) break;
			if (current.time >= parent.time) break;
			// Swap
			heap[parentIdx] = current;
			heap[index] = parent;
			index = parentIdx;
		}
	}

	private siftDown(index: number): void {
		const { heap } = this;
		const length = heap.length;

		while (true) {
			let smallest = index;
			const left = 2 * index + 1;
			const right = 2 * index + 2;

			const smallestEvent = heap[smallest];
			const leftEvent = left < length ? heap[left] : undefined;
			const rightEvent = right < length ? heap[right] : undefined;

			if (smallestEvent === undefined) break;

			if (leftEvent !== undefined && leftEvent.time < smallestEvent.time) {
				smallest = left;
			}

			const currentSmallest = heap[smallest];
			if (
				currentSmallest !== undefined &&
				rightEvent !== undefined &&
				rightEvent.time < currentSmallest.time
			) {
				smallest = right;
			}

			if (smallest === index) break;

			// Swap
			const temp = heap[index];
			const swapTarget = heap[smallest];
			if (temp === undefined || swapTarget === undefined) break;
			heap[index] = swapTarget;
			heap[smallest] = temp;
			index = smallest;
		}
	}
}
