import {
  GetCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddb } from './db';
import type { TransactInput } from './types';
import { IDEMPOTENCY_TABLE, TRANSACTION_TYPE, USER_TABLE } from './constants';

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

  const { userId, amount, type, idempotentKey } = input;

  const existingTransact = await ddb.send(new GetCommand({
    TableName: IDEMPOTENCY_TABLE,
    Key: { PK: `IDEMPOTENT#${idempotentKey}` }
  }));

  if (existingTransact.Item) {
    // Already processed; return early.
    throw new Error('Transaction already processed');
  }

  const isCredit = type === TRANSACTION_TYPE.CREDIT;

  const userKey = { PK: `USER#${userId}` };
  const idemKey = { PK: `IDEMPOTENT#${idempotentKey}` };

  const updateExpr = isCredit
    ? 'SET balance = if_not_exists(balance, :start) + :amount'
    : 'SET balance = balance - :amount';

  const conditionExpr = isCredit
    ? undefined
    : 'attribute_exists(balance) AND balance >= :amount';

  const transactItems = [
    {
      Update: {
        TableName: USER_TABLE,
        Key: userKey,
        UpdateExpression: updateExpr,
        ConditionExpression: conditionExpr,
        ExpressionAttributeValues: {
          ':amount': amount,
          ':start': 100,
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
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
  ];

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      })
    );
  } catch (err) {
    if (err.name === 'TransactionCanceledException') {
      console.error('💥 Transaction failed:', err)

      const reason = err.message.includes('ConditionalCheckFailed')
        ? 'Idempotent key already exists or insufficient balance'
        : 'Unknown transaction failure'

      throw new Error(`Transaction failed: ${reason}`)
    }

    // Any other AWS SDK errors
    throw new Error(`Unexpected DynamoDB error: ${err.message}`)
  }
}
