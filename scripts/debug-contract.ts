
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import PredictionBattleABI from '../src/lib/abi/PredictionBattle.json';

dotenv.config();

const CONTRACT_ADDRESS = '0x1e57a200b5aa90e44701e4bba0b70a02c7d074c4'; // From error logs
const USER_ADDRESS = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02'; // User from error logs
const PRED_ID = 'pred_1768150964280_g5xqdn9';

async function main() {
    console.log("Checking contract state...");

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http()
    });

    // 1. Check Admin
    try {
        const admin = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'admin',
        });
        console.log(`Contract Admin: ${admin}`);
        console.log(`User Address : ${USER_ADDRESS}`);
        console.log(`Is User Admin? ${String(admin).toLowerCase() === USER_ADDRESS.toLowerCase()}`);
    } catch (e) {
        console.error("Failed to read admin:", e);
    }

    // 2. Check Operator
    try {
        const isOp = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'operators',
            args: [USER_ADDRESS]
        });
        console.log(`Is User Operator? ${isOp}`);
    } catch (e) {
        console.error("Failed to read operator status:", e);
    }

    // 3. Check Prediction
    try {
        const pred: any = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'predictions',
            args: [PRED_ID]
        });

        // Struct: id, target, deadline, resolved, result, totalYes, totalNo, ...
        // Depending on ABI order, checking generic output
        console.log("Prediction State:", pred);

        if (pred) {
            // Assuming ABI structure order, typical:
            // string id, uint target, uint deadline, bool resolved, bool result...
            // Or struct object if viem parses it

            // Check existence logic (usually ID is not empty)
            console.log(`Prediction Exists? ${pred[0] !== ''}`);
            console.log(`Resolved? ${pred[3]}`); // Assuming index 3 is resolved based on code
        }
    } catch (e) {
        console.error("Failed to read prediction:", e);
    }

    // 4. Check Creator Fee Base (to verify if this is the UPDATED contract)
    try {
        const fee = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'creatorFeeBps',
        });
        console.log(`Creator Fee BPS: ${fee} (Expected: 500)`);
    } catch (e) {
        console.log("Could not read 'creatorFeeBps'. Contract might be OLD version.");
    }
}

main();
