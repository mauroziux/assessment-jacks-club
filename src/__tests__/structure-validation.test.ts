import { describe, it, expect, beforeEach, vi } from "vitest";
import { transact } from "../transact";
import { TRANSACTION_TYPE } from "../constants";
import { ddb } from "../db";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

// Mock ddb.send
vi.mock("../db", () => {
	return {
		ddb: {
			send: vi.fn(),
		},
	};
});

const ddbSend = ddb.send as unknown as ReturnType<typeof vi.fn>;

describe("transact - DynamoDB Command Structure Validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function mockIdempotencyNotFound() {
		// First call to ddb.send is GetCommand for idempotency check
		ddbSend.mockResolvedValueOnce({ Item: undefined });
	}

	it("should only include :start parameter in credit transactions", async () => {
		mockIdempotencyNotFound();
		ddbSend.mockResolvedValueOnce({}); // TransactWriteCommand success

		await transact({
			userId: "user1",
			amount: 50,
			type: TRANSACTION_TYPE.CREDIT,
			idempotentKey: "credit-key",
		});

		// Get the second call (TransactWriteCommand)
		const transactWriteCall = ddbSend.mock.calls[1];
		const transactWriteCommand = transactWriteCall[0] as TransactWriteCommand;
		const transactItems = transactWriteCommand.input.TransactItems;

		// Get the Update item (first item in the array)
		const updateItem = transactItems?.[0];

		expect(updateItem).toBeDefined();
		expect(updateItem?.Update?.ExpressionAttributeValues).toEqual({
			":amount": 50,
			":start": 100,
		});
	});

	it("should NOT include :start parameter in debit transactions", async () => {
		mockIdempotencyNotFound();
		ddbSend.mockResolvedValueOnce({}); // TransactWriteCommand success

		await transact({
			userId: "user1",
			amount: 30,
			type: TRANSACTION_TYPE.DEBIT,
			idempotentKey: "debit-key",
		});

		// Get the second call (TransactWriteCommand)
		const transactWriteCall = ddbSend.mock.calls[1];
		const transactWriteCommand = transactWriteCall[0] as TransactWriteCommand;
		const transactItems = transactWriteCommand.input.TransactItems;

		// Get the Update item (first item in the array)
		const updateItem = transactItems?.[0];

		expect(updateItem).toBeDefined();
		expect(updateItem?.Update?.ExpressionAttributeValues).toEqual({
			":amount": 30,
			// :start should NOT be present for debit transactions
		});

		// Explicitly check that :start is not included
		expect(updateItem?.Update?.ExpressionAttributeValues).not.toHaveProperty(
			":start",
		);
	});

	it("should have correct UpdateExpression for credit transactions", async () => {
		mockIdempotencyNotFound();
		ddbSend.mockResolvedValueOnce({});

		await transact({
			userId: "user1",
			amount: 25,
			type: TRANSACTION_TYPE.CREDIT,
			idempotentKey: "credit-expr-key",
		});

		const transactWriteCall = ddbSend.mock.calls[1];
		const transactWriteCommand = transactWriteCall[0] as TransactWriteCommand;
		const transactItems = transactWriteCommand.input.TransactItems;
		const updateItem = transactItems?.[0];

		expect(updateItem?.Update?.UpdateExpression).toBe(
			"SET balance = if_not_exists(balance, :start) + :amount",
		);
	});

	it("should have correct UpdateExpression for debit transactions", async () => {
		mockIdempotencyNotFound();
		ddbSend.mockResolvedValueOnce({});

		await transact({
			userId: "user1",
			amount: 15,
			type: TRANSACTION_TYPE.DEBIT,
			idempotentKey: "debit-expr-key",
		});

		const transactWriteCall = ddbSend.mock.calls[1];
		const transactWriteCommand = transactWriteCall[0] as TransactWriteCommand;
		const transactItems = transactWriteCommand.input.TransactItems;
		const updateItem = transactItems?.[0];

		expect(updateItem?.Update?.UpdateExpression).toBe(
			"SET balance = balance - :amount",
		);
	});

	it("should validate that all ExpressionAttributeValues are used in UpdateExpression", async () => {
		mockIdempotencyNotFound();
		ddbSend.mockResolvedValueOnce({});

		await transact({
			userId: "user1",
			amount: 20,
			type: TRANSACTION_TYPE.DEBIT,
			idempotentKey: "validation-key",
		});

		const transactWriteCall = ddbSend.mock.calls[1];
		const transactWriteCommand = transactWriteCall[0] as TransactWriteCommand;
		const transactItems = transactWriteCommand.input.TransactItems;
		const updateItem = transactItems?.[0];

		const updateExpression = updateItem?.Update?.UpdateExpression || "";
		const expressionAttributeValues =
			updateItem?.Update?.ExpressionAttributeValues || {};

		// Check that every attribute value is actually used in the expression
		Object.keys(expressionAttributeValues).forEach((key) => {
			expect(updateExpression).toContain(key);
		});
	});

	it("should validate credit transaction uses both :amount and :start parameters", async () => {
		mockIdempotencyNotFound();
		ddbSend.mockResolvedValueOnce({});

		await transact({
			userId: "user1",
			amount: 40,
			type: TRANSACTION_TYPE.CREDIT,
			idempotentKey: "credit-validation-key",
		});

		const transactWriteCall = ddbSend.mock.calls[1];
		const transactWriteCommand = transactWriteCall[0] as TransactWriteCommand;
		const transactItems = transactWriteCommand.input.TransactItems;
		const updateItem = transactItems?.[0];

		const updateExpression = updateItem?.Update?.UpdateExpression || "";
		const expressionAttributeValues =
			updateItem?.Update?.ExpressionAttributeValues || {};

		// Check that both parameters are present
		expect(expressionAttributeValues).toHaveProperty(":amount");
		expect(expressionAttributeValues).toHaveProperty(":start");

		// Check that both are used in the expression
		expect(updateExpression).toContain(":amount");
		expect(updateExpression).toContain(":start");
	});
});
