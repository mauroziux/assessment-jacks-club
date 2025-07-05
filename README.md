# assessment-jacks-club

## Overview

This project implements two core functions for a user balance system using AWS DynamoDB:
- **getBalance**: Retrieve the current balance for a user, with a default of 100 if not found.
- **transact**: Process credit or debit transactions, ensuring idempotency and atomicity.

---

## Setup

### 1. Install dependencies

```sh
npm install
# or
bun install
```

### 2. DynamoDB Setup

You need access to a DynamoDB instance (local or AWS).
For local development, you can run DynamoDB locally using Docker:

```sh
docker run -p 8000:8000 amazon/dynamodb-local
```

Set the environment variable for local DynamoDB (optional):

```sh
export DYNAMODB_ENDPOINT=http://localhost:8000
```

### 3. Build the project

To compile the TypeScript code to JavaScript, run:

```sh
npm run build
# or
bun run build
```

This will create a `dist` directory with the compiled code.

---

## Usage

### Run a Transaction

You can create a script like `src/runTransact.ts`:

```ts
import { transact } from './transact';
import { TRANSACTION_TYPE } from './constants';

async function main() {
  try {
    await transact({
      userId: '1',
      amount: 10,
      type: TRANSACTION_TYPE.CREDIT,
      idempotentKey: 'unique-key-123',
    });
    console.log('Transaction succeeded!');
  } catch (err) {
    console.error('Transaction failed:', err);
  }
}

main();
```

Run it with:

```sh
npm run run:transact
# or
bun run src/runTransact.ts
```

### Get a User Balance

You can create a script like `src/runGetBalance.ts`:

```ts
import { getBalance } from './getBalance';

async function main() {
  const balance = await getBalance({ userId: '1' });
  console.log('User balance:', balance);
}

main();
```

Run it with:

```sh
npm run run:get-balance
# or
bun run src/runGetBalance.ts
```

---

## Testing

### Unit Tests

Run all unit tests with:

```sh
npm test
# or
bunx run test
```

Test files are located in `src/__tests__/`.

---

## Code Formatting and Linting

This project uses [Biome](https://biomejs.dev/) for code formatting and linting to ensure consistent code style and catch potential issues.

### Format Code

To automatically format the codebase, run:

```sh
bun run format
```

### Lint Code

To lint the codebase and identify potential errors or style violations, run:

```sh
bun run lint
```

---

## Error Handling

The `transact` function includes detailed error handling:
- **Idempotency**: If a transaction with the same `idempotentKey` is submitted more than once, the function will throw a `Transaction already processed` error.
- **Insufficient Funds**: If a debit transaction is attempted and the user has insufficient funds, the transaction will fail with a `Conditional check failed` error.
- **Input Validation**: Both `transact` and `getBalance` perform input validation to ensure data integrity.

---

## Project Structure

- `src/getBalance.ts` - Get user balance logic
- `src/transact.ts` - Transaction logic (credit/debit)
- `src/constants.ts` - Table names and transaction type constants
- `src/types.ts` - TypeScript types and interfaces
- `src/db.ts` - DynamoDB client setup
- `src/__tests__/` - Unit tests

---

## Notes

- Make sure your DynamoDB tables (`UserBalance`, `IdempotencyKeys`) exist before running the scripts.
- For local testing, set the `DYNAMODB_ENDPOINT` environment variable.
- Use a unique `idempotentKey` for each transaction to ensure idempotency.
