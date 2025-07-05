import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from './db';
import type { GetBalanceInput } from './types';
import { USER_TABLE } from './constants';

export async function getBalance({ userId }: GetBalanceInput): Promise<number> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }
  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: USER_TABLE,
        Key: { PK: `USER#${userId}` },
      })
    );

    if (!result.Item) {
      // Return default balance if not found
      return 100;
    }

    return result.Item.balance ?? 100;
  } catch (err) {
    console.error('❌ Failed to retrieve user balance:', err);
    throw new Error('Could not retrieve user balance');
  }
}
