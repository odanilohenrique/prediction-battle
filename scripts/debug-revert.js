
const { createPublicClient, http, formatUnits } = require('viem');
const { baseSepolia } = require('viem/chains');
const PredictionBattleABI = require('../src/lib/abi/PredictionBattle.json');

// OLD Contract (Contract in question)
const CONTRACT_ADDRESS = '0x1e57a200b5aa90e44701e4bba0b70a02c7d074c4';
const USER_ADDRESS = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02';
const PRED_ID = 'pred_1768150964280_g5xqdn9';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const ERC20ABI = [
    { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }
];

async function main() {
    console.log("----------------------------------------");
    console.log("DEBUGGER: Simulating Resolution Revert");
    console.log("----------------------------------------");

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http()
    });

    // 1. Check Balance
    try {
        const balance = await client.readContract({
            address: USDC_ADDRESS,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [CONTRACT_ADDRESS]
        });
        console.log(`[1] Contract USDC Balance: ${formatUnits(balance, 6)} USDC`); // USDC has 6 decimals

        if (balance === 0n) {
            console.log("    CRITICAL: Balance is ZERO. Cannot payout fees/winnings.");
        }
    } catch (e) {
        console.error("Failed to read balance:", e.message);
    }

    // 2. Check Operator Role
    try {
        const isOp = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'operators',
            args: [USER_ADDRESS]
        });
        const admin = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'admin',
        });

        console.log(`[2] Permissions:`);
        console.log(`    User: ${USER_ADDRESS}`);
        console.log(`    Admin: ${admin}`);
        console.log(`    Is user Operator? ${isOp}`);
        console.log(`    Is user Admin? ${admin.toLowerCase() === USER_ADDRESS.toLowerCase()}`);

        if (!isOp && admin.toLowerCase() !== USER_ADDRESS.toLowerCase()) {
            console.log("    CRITICAL: User has NO permission (Not Admin, Not Operator).");
        }
    } catch (e) {
        console.error("Failed to read permissions:", e.message);
    }

    // 3. Simulate The Call
    console.log(`[3] Simulating resolvePrediction('${PRED_ID}', true)...`);
    try {
        const { result } = await client.simulateContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'resolvePrediction',
            args: [PRED_ID, true],
            account: USER_ADDRESS, // Simulate as the user
        });
        console.log("    SUCCESS! Simulation passed. Transaction should work.");
        console.log("    Result:", result);
    } catch (e) {
        console.log("    FAILURE! Simulation reverted.");
        console.log("    Revert Reason:", e.shortMessage || e.message);

        if (e.message.includes("transfer failed")) {
            console.log("    Analysis: Contract tried to move USDC but failed (Insolvency).");
        }
        if (e.message.includes("Already resolved")) {
            console.log("    Analysis: Prediction is already resolved.");
        }
        if (e.message.includes("Not authorized")) { // Assuming custom error or default revert
            console.log("    Analysis: Permissions issue.");
        }
    }
}

main();
