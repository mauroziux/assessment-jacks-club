import { getBalance } from "./getBalance";

async function main() {
  try {
    const balance = await getBalance({ userId: "test-user" });
    console.log(`Current balance for test-user: ${balance}`);
  } catch (err) {
    console.error("❌ Failed to get balance:", err);
  }
}

main();
