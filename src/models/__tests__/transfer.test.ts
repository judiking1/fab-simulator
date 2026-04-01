import { describe, expect, it } from "vitest";
import {
	createTransferCommand,
	getDepositTravelTime,
	getPickTravelTime,
	getTotalTransferTime,
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
		expect(cmd.timestamps.deposit_done).toBeNull();
		expect(cmd.pickRoute).toEqual([]);
		expect(cmd.depositRoute).toEqual([]);
	});

	it("TRANSFER_LIFECYCLE has correct order and length", () => {
		expect(TRANSFER_LIFECYCLE).toHaveLength(10);
		expect(TRANSFER_LIFECYCLE[0]).toBe(TRANSFER_STATUSES.CREATED);
		expect(TRANSFER_LIFECYCLE[9]).toBe(TRANSFER_STATUSES.DEPOSIT_DONE);
	});
});

describe("Transfer KPI helpers", () => {
	it("returns null for incomplete transfers", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 0);
		expect(getTotalTransferTime(cmd)).toBeNull();
		expect(getWaitTime(cmd)).toBeNull();
	});

	it("computes total transfer time", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 100);
		cmd.timestamps.deposit_done = 500;
		expect(getTotalTransferTime(cmd)).toBe(400);
	});

	it("computes wait time (created → assigned)", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 100);
		cmd.timestamps.assigned = 150;
		expect(getWaitTime(cmd)).toBe(50);
	});

	it("computes pick travel time", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 0);
		cmd.timestamps.move_to_pick = 200;
		cmd.timestamps.arrive_at_pick = 350;
		expect(getPickTravelTime(cmd)).toBe(150);
	});

	it("computes deposit travel time", () => {
		const cmd = createTransferCommand("T1", "F1", "EQ1", "P1", "EQ2", "P2", 0);
		cmd.timestamps.move_to_deposit = 400;
		cmd.timestamps.arrive_at_deposit = 600;
		expect(getDepositTravelTime(cmd)).toBe(200);
	});
});
