
const { createPublicClient, http, formatUnits } = require('viem');
const { baseSepolia } = require('viem/chains');
const PredictionBattleABI = require('../src/lib/abi/PredictionBattle.json');

// From Error Logs
const CONTRACT_ADDRESS = '0x1e57a200b5aa90e44701e4bba0b70a02c7d074c4';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const PRED_ID = 'pred_1768150964280_g5xqdn9';

const ERC20ABI = [
    { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
    { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }
];

async function main() {
    console.log("----------------------------------------");
    console.log("Checking Contract Insolvency");
    console.log("----------------------------------------");

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http()
    });

    try {
        // 1. Check Contract USDC Balance
        const balance = await client.readContract({
            address: USDC_ADDRESS,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [CONTRACT_ADDRESS]
        });
        const fmtBal = formatUnits(balance, 6);
        console.log(`Contract USDC Balance: $${fmtBal}`);

        // 2. Check Prediction Pot
        const pred = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'predictions',
            args: [PRED_ID]
        });

        // Manual array mapping based on inspection
        // [id, target, deadline, resolved, result, totalYes, totalNo, ...]
        const totalYes = pred[5];
        const totalNo = pred[6];
        const totalPool = totalYes + totalNo;
        const fmtPool = formatUnits(totalPool, 6);

        console.log(`Prediction Pot: $${fmtPool} (Yes: ${formatUnits(totalYes, 6)}, No: ${formatUnits(totalNo, 6)})`);

        if (balance < totalPool) {
            console.log("\n!!! CRITICAL ERROR: INSOLVENCY DETECTED !!!");
            console.log(`Contract holds $${fmtBal} but owes $${fmtPool} for this prediction.`);
            console.log("Reason: Funds likely not transferred during placeBet or drained.");
        } else {
            console.log("\nSolvency Check: OK (Contract has enough funds)");
            // Check implicit allowance? No contract doesn't need allowance for itself.
            // Check Admin Balance?
            const admin = await client.readContract({
                address: CONTRACT_ADDRESS,
                abi: PredictionBattleABI.abi,
                functionName: 'admin',
            });
            console.log(`Admin Address: ${admin}`);

            const adminBal = await client.readContract({
                address: USDC_ADDRESS,
                abi: ERC20ABI,
                functionName: 'balanceOf',
                args: [admin]
            });
            console.log(`Admin USDC Balance: $${formatUnits(adminBal, 6)}`);
        }

    } catch (e) {
        console.error("Check failed:", e.message);
    }
}

main();
