import {
  GetCommand,
  TransactWriteCommand, type TransactWriteCommandInput
} from '@aws-sdk/lib-dynamodb';
import { ddb } from './db';
import type { TransactInput, ValidatedTransactInput } from './types';
import { IDEMPOTENCY_TABLE, TRANSACTION_TYPE, USER_TABLE } from './constants';
import type { CancellationReason } from '@aws-sdk/client-dynamodb';

// optional for validation we might implement Zod
function validateTransactInput(input: TransactInput): void {

  const { idempotentKey, userId, amount, type } = input

  if (!idempotentKey || typeof idempotentKey !== 'string') {
    throw new Error('Invalid idempotentKey')
  }

  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId')
  }

  const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount

  if (typeof parsedAmount !== 'number' || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Invalid amount: must be a positive number')
  }

  if (type !== TRANSACTION_TYPE.CREDIT && type !== TRANSACTION_TYPE.DEBIT) {
    throw new Error('Invalid type: must be either "credit" or "debit"')
  }

  // Mutate validated value for downstream use
  input.amount = parsedAmount
}

export async function transact(input: TransactInput): Promise<void> {
  validateTransactInput(input)

  const { idempotentKey } = input;

  const existingTransact = await ddb.send(new GetCommand({
    TableName: IDEMPOTENCY_TABLE,
    Key: { PK: `IDEMPOTENT#${idempotentKey}` }
  }));

  if (existingTransact.Item) {
    // Already processed; return early.
    throw new Error('Transaction already processed');
  }

  const transactItems = buildTransactionItems(input as ValidatedTransactInput);

  await executeTransaction(transactItems);
}

function buildTransactionItems(input: ValidatedTransactInput) {
  const { userId, amount, type, idempotentKey } = input;
  const isCredit = type === TRANSACTION_TYPE.CREDIT;
  const userKey = { PK: `USER#${userId}` };
  const idemKey = { PK: `IDEMPOTENT#${idempotentKey}` };

  const updateExpr = isCredit
    ? "SET balance = if_not_exists(balance, :start) + :amount"
    : "SET balance = balance - :amount";

  const conditionExpr = isCredit
    ? undefined
    : "attribute_exists(balance) AND balance >= :amount";

  return [
    {
      Update: {
        TableName: USER_TABLE,
        Key: userKey,
        UpdateExpression: updateExpr,
        ConditionExpression: conditionExpr,
        ExpressionAttributeValues: {
          ":amount": amount,
          ":start": 100,
        },
      },
    },
    {
      Put: {
        TableName: IDEMPOTENCY_TABLE,
        Item: {
          ...idemKey,
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(PK)",
      },
    },
  ];
}

async function executeTransaction(transactItems: TransactWriteCommandInput['TransactItems']) {
  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      })
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "TransactionCanceledException") {
      // Handle transaction cancellation
      const cancellationReasons = (err as any).CancellationReasons || [];
      const reason = cancellationReasons.map((r: CancellationReason) => {
        if (r.Code === 'ConditionalCheckFailed') {
          return 'Conditional check failed';
        }
        return r.Message || 'Unknown reason';
      }).join(', ');

      throw new Error(`Transaction failed: ${reason}`);
    }

    // Re-throw unexpected errors
    if (err instanceof Error) {
      throw new Error(`Unexpected DynamoDB error: ${err.message}`);
    }
    throw new Error('An unexpected error occurred');
  }
}
