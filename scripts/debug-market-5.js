require('dotenv').config({ path: '.env.local' });
const { fetch } = require('undici');
const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');

async function main() {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        console.error("Missing KV credentials");
        return;
    }

    const res = await fetch(`${url}/hgetall/prediction_bets`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    const rawArray = data.result || [];
    const markets = [];
    for (let i = 0; i < rawArray.length; i += 2) {
        markets.push(JSON.parse(rawArray[i + 1]));
    }

    const failedMarket = markets.find(m => m.castText && m.castText.toLowerCase().includes('onchain 5'));

    if (!failedMarket) {
        console.log("Could not find market 5 in DB");
        return;
    }

    console.log("\n--- MARKET 5 DATA ---");
    console.log(JSON.stringify(failedMarket, null, 2));

    // Scan blockchain for the latest MarketCreated event around this address
    console.log("\nScanning blockchain for creator", failedMarket.creatorAddress);
    const client = createPublicClient({ chain: baseSepolia, transport: http() });

    const latest = await client.getBlockNumber();
    const logs = await client.getLogs({
        address: '0xf8623e94364b58246bc6fabea10710563d2db6ae', // Contract
        event: {
            type: 'event',
            name: 'MarketCreated',
            inputs: [
                { type: 'string', name: 'id', indexed: false },
                { type: 'address', name: 'creator', indexed: true },
                { type: 'uint256', name: 'duration', indexed: false },
                { type: 'uint256', name: 'timestamp', indexed: false }
            ]
        },
        fromBlock: latest - 10000n,
        toBlock: latest
    });

    console.log(`Found ${logs.length} MarketCreated logs in the last 10000 blocks`);

    // Show the last 5 logs
    for (let i = Math.max(0, logs.length - 10); i < logs.length; i++) {
        const l = logs[i];
        if (l.args.creator.toLowerCase() !== failedMarket.creatorAddress.toLowerCase()) {

            // Check if it's the Smart Wallet of this user by fetching internal txs or just print it anyway
            // We'll just print them all to see what's happening
            // console.log(`Skipping creator ${l.args.creator}`);
            // continue;
        }

        console.log(`\nLog index ${i}:`);
        console.log(`TxHash: ${l.transactionHash}`);
        console.log(`ID: ${l.args.id}`);
        console.log(`Creator: ${l.args.creator}`);

        try {
            // Also fetch receipt line
            const receipt = await client.getTransactionReceipt({ hash: l.transactionHash });
            console.log(`receipt.from: ${receipt.from}`);

            // Let's decode the block timestamp to manually verify keccak
            const block = await client.getBlock({ blockHash: l.blockHash });
            console.log(`block timestamp: ${block.timestamp}`);
        } catch (e) { console.log(e.message) }
    }
}

main().catch(console.error);
