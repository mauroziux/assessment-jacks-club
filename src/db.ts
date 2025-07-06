import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
	endpoint: process.env.DYNAMODB_ENDPOINT || "http://localhost:8000",
	region: process.env.DYNAMODB_ENDPOINT ? "local" : undefined,
	credentials: process.env.DYNAMODB_ENDPOINT
		? {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "dummy",
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "dummy",
			}
		: undefined,
});

export const ddb = DynamoDBDocumentClient.from(client);
