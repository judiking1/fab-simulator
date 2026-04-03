import { describe, expect, it } from "vitest";
import {
	createTransferCommand,
	getDeliveryTime,
	getLeadTime,
	getLoadTravelTime,
	getQueueTime,
	getUnloadTravelTime,
	getWaitTime,
	TRANSFER_LIFECYCLE,
	TRANSFER_STATUSES,
} from "@/models/transfer";

describe("TransferCommand", () => {
	it("creates a command in CREATED state with timestamp", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 1000);

		expect(cmd.id).toBe("T1");
		expect(cmd.status).toBe(TRANSFER_STATUSES.CREATED);
		expect(cmd.foupId).toBe("F1");
		expect(cmd.ohtId).toBeNull();
		expect(cmd.timestamps.created).toBe(1000);
		expect(cmd.timestamps.assigned).toBeNull();
		expect(cmd.timestamps.unload_done).toBeNull();
		expect(cmd.loadRoute).toEqual([]);
		expect(cmd.unloadRoute).toEqual([]);
	});

	it("TRANSFER_LIFECYCLE has correct order and length", () => {
		expect(TRANSFER_LIFECYCLE).toHaveLength(10);
		expect(TRANSFER_LIFECYCLE[0]).toBe(TRANSFER_STATUSES.CREATED);
		expect(TRANSFER_LIFECYCLE[9]).toBe(TRANSFER_STATUSES.UNLOAD_DONE);
	});
});

describe("Transfer KPI helpers", () => {
	it("returns null for incomplete transfers", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 0);
		expect(getLeadTime(cmd)).toBeNull();
		expect(getQueueTime(cmd)).toBeNull();
		expect(getWaitTime(cmd)).toBeNull();
		expect(getDeliveryTime(cmd)).toBeNull();
	});

	it("computes lead time (created → unload_done)", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 100);
		cmd.timestamps.unload_done = 500;
		expect(getLeadTime(cmd)).toBe(400);
	});

	it("computes queue time (created → assigned)", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 100);
		cmd.timestamps.assigned = 150;
		expect(getQueueTime(cmd)).toBe(50);
	});

	it("computes wait time (created → load_done)", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 100);
		cmd.timestamps.load_done = 300;
		expect(getWaitTime(cmd)).toBe(200);
	});

	it("computes delivery time (move_to_unload → unload_done)", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 0);
		cmd.timestamps.move_to_unload = 300;
		cmd.timestamps.unload_done = 500;
		expect(getDeliveryTime(cmd)).toBe(200);
	});

	it("computes load travel time", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 0);
		cmd.timestamps.move_to_load = 200;
		cmd.timestamps.arrive_at_source = 350;
		expect(getLoadTravelTime(cmd)).toBe(150);
	});

	it("computes unload travel time", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 0);
		cmd.timestamps.move_to_unload = 400;
		cmd.timestamps.arrive_at_dest = 600;
		expect(getUnloadTravelTime(cmd)).toBe(200);
	});
});
