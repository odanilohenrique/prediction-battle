import { createPublicClient, http, decodeEventLog } from 'viem';
import { baseSepolia } from 'viem/chains';
import { TESTNET_CONFIG } from './src/lib/config';
import PredictionBattleABI from './src/lib/abi/PredictionBattleV10.json';

const client = createPublicClient({
    chain: baseSepolia,
    transport: http(TESTNET_CONFIG.rpcUrl),
});

async function main() {
    console.log("Fetching latest logs for PredictionBattle V10...");
    const logs = await client.getLogs({
        address: TESTNET_CONFIG.contractAddress as `0x${string}`,
        event: PredictionBattleABI.abi.find(api => api.name === 'MarketCreated') as any,
        fromBlock: 'earliest', // or specify a recent block if needed
        toBlock: 'latest'
    });

    console.log(`Found ${logs.length} MarketCreated events. Showing last 3:`);
    const recentLogs = logs.slice(-3);
    for (const log of recentLogs) {
        console.log(`- Tx: ${log.transactionHash}`);
        console.log(`  ID: ${log.args.id}`);
        console.log(`  Creator: ${log.args.creator}`);
    }
}

main().catch(console.error);
