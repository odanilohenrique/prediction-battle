import { createWalletClient, http, publicActions, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const CONTRACT_NAME = 'PredictionBattle';
const ABI_PATH = path.resolve(process.cwd(), `src/lib/abi/${CONTRACT_NAME}.json`);

// YOU MUST SET THIS AFTER DEPLOYMENT
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

async function main() {
    const args = process.argv.slice(2);
    const predictionId = args[0];
    const batchSize = args[1] ? parseInt(args[1]) : 50;

    if (!predictionId) {
        console.error('Usage: npx tsx scripts/distribute-payouts.ts <prediction-id> [batch-size]');
        process.exit(1);
    }

    if (!CONTRACT_ADDRESS) {
        console.error('Error: NEXT_PUBLIC_CONTRACT_ADDRESS not found in environment.');
        process.exit(1);
    }

    // Load ABI
    if (!fs.existsSync(ABI_PATH)) {
        console.error('Error: ABI not found. Compile first.');
        process.exit(1);
    }
    const { abi } = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('PRIVATE_KEY not found in .env');
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
    }).extend(publicActions);

    console.log(`Distributing payouts for Prediction "${predictionId}"...`);
    console.log(`Acting as Admin: ${account.address}`);
    console.log(`Batch Size: ${batchSize}`);

    try {
        const { request } = await client.simulateContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi,
            functionName: 'distributeWinnings',
            args: [predictionId, BigInt(batchSize)],
            account,
        });

        const hash = await client.writeContract(request);
        console.log(`Transaction sent: ${hash}`);

        const receipt = await client.waitForTransactionReceipt({ hash });
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    } catch (error) {
        console.error('Distribution failed:', error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
