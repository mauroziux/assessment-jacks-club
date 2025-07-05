import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transact } from '../transact';
import { TRANSACTION_TYPE } from '../constants';
import { ddb } from '../db';
import { TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// Mock ddb.send
vi.mock('../db', () => {
  return {
    ddb: {
      send: vi.fn(),
    },
  };
});

const ddbSend = (ddb.send as unknown as ReturnType<typeof vi.fn>);

describe('transact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockIdempotencyNotFound() {
    // First call to ddb.send is GetCommand for idempotency check
    ddbSend.mockResolvedValueOnce({ Item: undefined });
  }

  function mockIdempotencyFound() {
    ddbSend.mockResolvedValueOnce({ Item: { PK: 'IDEMPOTENT#key1' } });
  }

  it('throws error for missing idempotentKey', async () => {
    await expect(
      transact({ userId: 'u', amount: 10, type: TRANSACTION_TYPE.CREDIT, idempotentKey: '' })
    ).rejects.toThrow('Invalid idempotentKey');
  });

  it('throws error for missing userId', async () => {
    await expect(
      transact({ userId: '', amount: 10, type: TRANSACTION_TYPE.CREDIT, idempotentKey: 'key' })
    ).rejects.toThrow('Invalid userId');
  });

  it('throws error for invalid amount (zero, negative, NaN, not a number)', async () => {
    await expect(
      transact({ userId: 'u', amount: 0, type: TRANSACTION_TYPE.CREDIT, idempotentKey: 'key' })
    ).rejects.toThrow('Invalid amount');
    await expect(
      transact({ userId: 'u', amount: -5, type: TRANSACTION_TYPE.CREDIT, idempotentKey: 'key' })
    ).rejects.toThrow('Invalid amount');
    await expect(
      transact({ userId: 'u', amount: 'notanumber', type: TRANSACTION_TYPE.CREDIT, idempotentKey: 'key' })
    ).rejects.toThrow('Invalid amount');
    await expect(
      transact({ userId: 'u', amount: NaN, type: TRANSACTION_TYPE.CREDIT, idempotentKey: 'key' })
    ).rejects.toThrow('Invalid amount');
  });

  it('throws error for invalid type', async () => {
    await expect(
      transact({ userId: 'u', amount: 10, type: 'invalid' as any, idempotentKey: 'key' })
    ).rejects.toThrow('Invalid type');
  });

  it('throws error if idempotency key already exists', async () => {
    mockIdempotencyFound();
    await expect(
      transact({ userId: 'u', amount: 10, type: TRANSACTION_TYPE.CREDIT, idempotentKey: 'key1' })
    ).rejects.toThrow('Transaction already processed');
  });

  it('processes a credit transaction successfully', async () => {
    mockIdempotencyNotFound();
    ddbSend.mockResolvedValueOnce({}); // TransactWriteCommand
    await expect(
      transact({ userId: '1', amount: '10', type: TRANSACTION_TYPE.CREDIT, idempotentKey: '1' })
    ).resolves.toBeUndefined();
    expect(ddbSend).toHaveBeenCalledWith(expect.any(TransactWriteCommand));
  });

  it('processes a debit transaction successfully', async () => {
    mockIdempotencyNotFound();
    ddbSend.mockResolvedValueOnce({}); // TransactWriteCommand
    await expect(
      transact({ userId: 'u', amount: 10, type: TRANSACTION_TYPE.DEBIT, idempotentKey: 'key3' })
    ).resolves.toBeUndefined();
    expect(ddbSend).toHaveBeenCalledWith(expect.any(TransactWriteCommand));
  });

  it('throws error if TransactWriteCommand fails with TransactionCanceledException and ConditionalCheckFailed', async () => {
    mockIdempotencyNotFound();
    const err = new Error('ConditionalCheckFailed');
    (err as any).name = 'TransactionCanceledException';
    ddbSend.mockRejectedValueOnce(err);
    await expect(
      transact({ userId: 'u', amount: 999, type: TRANSACTION_TYPE.DEBIT, idempotentKey: 'key4' })
    ).rejects.toThrow(/Idempotent key already exists or insufficient balance/);
  });

  it('throws error if TransactWriteCommand fails with TransactionCanceledException and unknown reason', async () => {
    mockIdempotencyNotFound();
    const err = new Error('Some other failure');
    (err as any).name = 'TransactionCanceledException';
    ddbSend.mockRejectedValueOnce(err);
    await expect(
      transact({ userId: 'u', amount: 10, type: TRANSACTION_TYPE.DEBIT, idempotentKey: 'key5' })
    ).rejects.toThrow(/Unknown transaction failure/);
  });

  it('throws error if TransactWriteCommand fails with other AWS SDK error', async () => {
    mockIdempotencyNotFound();
    const err = new Error('Some AWS error');
    (err as any).name = 'SomeOtherException';
    ddbSend.mockRejectedValueOnce(err);
    await expect(
      transact({ userId: 'u', amount: 10, type: TRANSACTION_TYPE.DEBIT, idempotentKey: 'key6' })
    ).rejects.toThrow(/Unexpected DynamoDB error/);
  });

  it('parses amount if given as string', async () => {
    mockIdempotencyNotFound();
    ddbSend.mockResolvedValueOnce({}); // TransactWriteCommand
    await expect(
      transact({ userId: 'u', amount: '15', type: TRANSACTION_TYPE.CREDIT, idempotentKey: 'key7' })
    ).resolves.toBeUndefined();
    expect(ddbSend).toHaveBeenCalledWith(expect.any(TransactWriteCommand));
  });
});
