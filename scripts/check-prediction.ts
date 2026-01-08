
import fs from 'fs';
import path from 'path';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const CONFIG_PATH = path.resolve(process.cwd(), 'src/lib/config.ts');
// Quick hack to read address from config file since we can't import TS easily
const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
const match = configContent.match(/contractAddress:.*?['"](0x[a-fA-F0-9]{40})['"]/);
const CONTRACT_ADDRESS = match ? match[1] : null;

// Load ABI safely
const abiPath = path.resolve(process.cwd(), 'src/lib/abi/PredictionBattle.json');
const PredictionBattleABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
});

async function main() {
    if (!CONTRACT_ADDRESS) throw new Error('Could not find contract address in config.ts');

    // Get ID from args
    const predictionId = process.argv[2];
    if (!predictionId) {
        console.error('Usage: npx ts-node scripts/check-prediction.ts <PREDICTION_ID>');
        process.exit(1);
    }

    console.log(`Checking Prediction "${predictionId}" on contract ${CONTRACT_ADDRESS}...`);

    try {
        const exists = await client.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'predictionExists',
            args: [predictionId],
        });
        console.log(`Exists on-chain: ${exists}`);

        if (exists) {
            const data = await client.readContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'predictions',
                args: [predictionId],
            }) as any[];

            console.log('--- Prediction Data ---');
            console.log('ID:', data[0]);
            console.log('Target:', data[1].toString());
            console.log('Deadline:', new Date(Number(data[2]) * 1000).toLocaleString());
            console.log('Resolved:', data[3]);
            console.log('Result:', data[4] ? 'YES' : 'NO');
            console.log('Total YES:', data[5].toString());
            console.log('Total NO:', data[6].toString());
            console.log('Void:', data[9]); // Adjust index based on struct
            console.log('Paid Out:', data[11]);
        }

    } catch (e: any) {
        console.error('Error reading contract:', e.message);
    }
}

main().catch(console.error);
