import { describe, it, expect, beforeEach, vi } from "vitest";
import { getBalance } from "../getBalance";
import { ddb } from "../db";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

// Mock ddb.send
vi.mock("../db", () => {
	return {
		ddb: {
			send: vi.fn(),
		},
	};
});

const ddbSend = ddb.send as unknown as ReturnType<typeof vi.fn>;

describe("getBalance", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns default balance if user not found", async () => {
		ddbSend.mockResolvedValueOnce({ Item: undefined });
		const balance = await getBalance({ userId: "user1" });
		expect(balance).toBe(100);
		expect(ddbSend).toHaveBeenCalledWith(expect.any(GetCommand));
	});

	it("returns user balance if found", async () => {
		ddbSend.mockResolvedValueOnce({ Item: { balance: 250 } });
		const balance = await getBalance({ userId: "user2" });
		expect(balance).toBe(250);
	});

	it("returns default balance if Item exists but balance is undefined", async () => {
		ddbSend.mockResolvedValueOnce({ Item: {} });
		const balance = await getBalance({ userId: "user3" });
		expect(balance).toBe(100);
	});

	it("throws error for invalid userId", async () => {
		await expect(getBalance({ userId: "" })).rejects.toThrow("Invalid userId");
		await expect(getBalance({ userId: " " })).rejects.toThrow("Invalid userId");
		await expect(getBalance({ userId: undefined as any })).rejects.toThrow(
			"Invalid userId",
		);
		await expect(getBalance({ userId: 123 as any })).rejects.toThrow(
			"Invalid userId",
		);
	});

	it("throws error if ddb.send throws", async () => {
		ddbSend.mockRejectedValueOnce(new Error("DDB error"));
		await expect(getBalance({ userId: "user4" })).rejects.toThrow(
			"Could not retrieve user balance",
		);
	});
});
