import { transact } from "./transact";
import { TRANSACTION_TYPE } from "./constants";

async function main() {
  const timestamp = Date.now();

  try {
    await transact({
      userId: "test-user",
      amount: "25",
      type: TRANSACTION_TYPE.CREDIT,
      idempotentKey: `credit-${timestamp}`,
    });
    console.log("Credit transaction succeeded!");
  } catch (err) {
    console.error("❌ Credit transaction failed:", err);
  }

  try {
    await transact({
      userId: "test-user",
      amount: "15",
      type: TRANSACTION_TYPE.DEBIT,
      idempotentKey: `debit-${timestamp}`,
    });
    console.log("Debit transaction succeeded!");
  } catch (err) {
    console.error("❌ Debit transaction failed:", err);
  }

  // Test debit transaction that should fail (insufficient funds)
  try {
    await transact({
      userId: "test-user",
      amount: "200",
      type: TRANSACTION_TYPE.DEBIT,
      idempotentKey: `debit-fail-${timestamp}`,
    });
    console.log("❌ Large debit transaction should have failed!");
  } catch (err) {
    console.log("Large debit transaction correctly failed:", err.message);
  }

  // Test idempotency (should fail with "already processed")
  try {
    await transact({
      userId: "test-user",
      amount: "10",
      type: TRANSACTION_TYPE.CREDIT,
      idempotentKey: `credit-${timestamp}`, // Same key as first transaction
    });
    console.log("❌ Duplicate transaction should have failed!");
  } catch (err) {
    console.log("Duplicate transaction correctly failed:", err.message);
  }
}

main();
