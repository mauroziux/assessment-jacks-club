import { TRANSACTION_TYPE } from './constants';

export interface GetBalanceInput {
  userId: string;
}

type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

type TransactInputBase = {
  idempotentKey: string;
  userId: string;
  type: TransactionType;
};

export type TransactInput = TransactInputBase & {
  amount: number | string;
};

export type ValidatedTransactInput = TransactInputBase & {
  amount: number;
};
