import { describe, expect, it } from "vitest";
import { PriorityQueue } from "@/core/engine/priorityQueue";
import type { SimEvent } from "@/types/simulation";

function makeEvent(time: number, type = "transfer_created" as const): SimEvent {
	return { time, type, entityId: `e-${time}`, data: {} };
}

describe("PriorityQueue", () => {
	it("should extract events in time order", () => {
		const pq = new PriorityQueue();
		pq.insert(makeEvent(5));
		pq.insert(makeEvent(1));
		pq.insert(makeEvent(3));
		pq.insert(makeEvent(2));
		pq.insert(makeEvent(4));

		const times: number[] = [];
		while (!pq.isEmpty) {
			const e = pq.extractMin();
			if (e) times.push(e.time);
		}

		expect(times).toEqual([1, 2, 3, 4, 5]);
	});

	it("should handle ties (same time) without error", () => {
		const pq = new PriorityQueue();
		pq.insert(makeEvent(1));
		pq.insert(makeEvent(1));
		pq.insert(makeEvent(1));

		expect(pq.size).toBe(3);

		const e1 = pq.extractMin();
		const e2 = pq.extractMin();
		const e3 = pq.extractMin();

		expect(e1?.time).toBe(1);
		expect(e2?.time).toBe(1);
		expect(e3?.time).toBe(1);
		expect(pq.isEmpty).toBe(true);
	});

	it("should return undefined from empty queue", () => {
		const pq = new PriorityQueue();

		expect(pq.extractMin()).toBeUndefined();
		expect(pq.peek()).toBeUndefined();
		expect(pq.isEmpty).toBe(true);
		expect(pq.size).toBe(0);
	});

	it("should peek without removing", () => {
		const pq = new PriorityQueue();
		pq.insert(makeEvent(3));
		pq.insert(makeEvent(1));

		expect(pq.peek()?.time).toBe(1);
		expect(pq.size).toBe(2);
	});

	it("should handle large queue (10000 events) efficiently", () => {
		const pq = new PriorityQueue();
		const count = 10000;

		// Insert in random order
		const times: number[] = [];
		for (let i = 0; i < count; i++) {
			const t = Math.random() * 10000;
			times.push(t);
			pq.insert(makeEvent(t));
		}

		expect(pq.size).toBe(count);

		// Extract and verify sorted order
		let prev = -1;
		let extracted = 0;
		while (!pq.isEmpty) {
			const e = pq.extractMin();
			if (e) {
				expect(e.time).toBeGreaterThanOrEqual(prev);
				prev = e.time;
				extracted++;
			}
		}

		expect(extracted).toBe(count);
	});

	it("should clear the queue", () => {
		const pq = new PriorityQueue();
		pq.insert(makeEvent(1));
		pq.insert(makeEvent(2));
		pq.clear();

		expect(pq.isEmpty).toBe(true);
		expect(pq.size).toBe(0);
	});

	it("should work with interleaved inserts and extracts", () => {
		const pq = new PriorityQueue();
		pq.insert(makeEvent(5));
		pq.insert(makeEvent(3));

		expect(pq.extractMin()?.time).toBe(3);

		pq.insert(makeEvent(1));
		pq.insert(makeEvent(4));

		expect(pq.extractMin()?.time).toBe(1);
		expect(pq.extractMin()?.time).toBe(4);
		expect(pq.extractMin()?.time).toBe(5);
		expect(pq.isEmpty).toBe(true);
	});
});
