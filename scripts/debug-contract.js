
const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();
const PredictionBattleABI = require('../src/lib/abi/PredictionBattle.json');

const CONTRACT_ADDRESS = '0x1e57a200b5aa90e44701e4bba0b70a02c7d074c4';
const USER_ADDRESS = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02';
const PRED_ID = 'pred_1768150964280_g5xqdn9';

async function main() {
    console.log("Checking contract state (JS)...");

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http()
    });

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
        console.log("Failed to read admin:", e.message);
    }

    try {
        const isOp = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'operators',
            args: [USER_ADDRESS]
        });
        console.log(`Is User Operator? ${isOp}`);
    } catch (e) {
        console.log("Failed to read operator:", e.message);
    }

    try {
        const pred = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'predictions',
            args: [PRED_ID]
        });
        // Result is likely an array or object depending on viem version
        console.log("Prediction State:", pred);
        // [id, target, deadline, resolved, result, processedIndex, paidOut, isVoid...]
        // Just dump it
    } catch (e) {
        console.log("Failed to read prediction:", e.message);
    }
}

main();
