import { transact } from "./transact";
import { TRANSACTION_TYPE } from "./constants";

async function main() {
	try {
		await transact({
			userId: "1",
			amount: "10",
			type: TRANSACTION_TYPE.CREDIT,
			idempotentKey: "1",
		});
		console.log("Transaction succeeded!");
	} catch (err) {
		console.error("Transaction failed:", err);
	}
}

main();
