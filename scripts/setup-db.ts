import { CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { USER_TABLE, IDEMPOTENCY_TABLE } from "../src/constants";
import { ddb } from "../src/db";

async function createTables() {
	const client = ddb;

	console.log("Attempting to create DynamoDB tables...");

	// Create UserBalance Table
	try {
		await client.send(
			new CreateTableCommand({
				TableName: USER_TABLE,
				AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
				KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
				ProvisionedThroughput: {
					ReadCapacityUnits: 5,
					WriteCapacityUnits: 5,
				},
			}),
		);
		console.log(`Table ${USER_TABLE} created successfully.`);
	} catch (error: any) {
		if (error.name === "ResourceInUseException") {
			console.log(`Table ${USER_TABLE} already exists.`);
		} else {
			console.error(`Error creating table ${USER_TABLE}:`, error);
		}
	}

	// Create IdempotencyKeys Table
	try {
		await client.send(
			new CreateTableCommand({
				TableName: IDEMPOTENCY_TABLE,
				AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
				KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
				ProvisionedThroughput: {
					ReadCapacityUnits: 5,
					WriteCapacityUnits: 5,
				},
			}),
		);
		console.log(`Table ${IDEMPOTENCY_TABLE} created successfully.`);
	} catch (error: any) {
		if (error.name === "ResourceInUseException") {
			console.log(`Table ${IDEMPOTENCY_TABLE} already exists.`);
		} else {
			console.error(`Error creating table ${IDEMPOTENCY_TABLE}:`, error);
		}
	}
}

createTables().catch((err) => {
	console.error("Failed to create tables:", err);
	process.exit(1);
});
