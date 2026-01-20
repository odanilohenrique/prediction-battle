
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { CURRENT_CONFIG } from '../src/lib/config';
import PredictionBattleABI from '../src/lib/abi/PredictionBattle.json';
import * as dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function main() {
    const marketId = process.argv[2];
    if (!marketId) {
        console.error("Please provide a market ID");
        return;
    }

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'),
    });

    const CONTRACT_ADDRESS = CURRENT_CONFIG.contractAddress as `0x${string}`;
    console.log(`Checking Market ID: ${marketId} on ${CONTRACT_ADDRESS}`);

    try {
        // Check marketExists mapping if exposed, or try getMarketInfo and check for validity
        // The error said "Market does not exist", which usually comes from:
        // require(marketExists[_marketId], ...)

        // Since `marketExists` (mapping) might be public, let's try reading it.
        // ABI might generate it as a function.
        try {
            const exists = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: PredictionBattleABI.abi,
                functionName: 'marketExists',
                args: [marketId]
            });
            console.log(`marketExists check: ${exists}`);
        } catch (e) {
            console.log("Could not read 'marketExists' directly (might not be in ABI or public). Trying getMarketInfo...");
        }

        // Try getMarketInfo
        const info = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'getMarketInfo',
            args: [marketId]
        }) as any;

        console.log("Market Info:", info);
        // [creator, deadline, state, ...]
        // If creator is 0x0... it doesn't exist.
        if (info[0] === '0x0000000000000000000000000000000000000000') {
            console.log("❌ Market creator is 0x0. Market definitely does not exist on this contract.");
        } else {
            console.log("✅ Market found!");
        }

    } catch (e: any) {
        console.error("Error reading contract:", e.message);
    }
}

main().catch(console.error);
