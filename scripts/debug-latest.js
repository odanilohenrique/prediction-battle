const { createPublicClient, http, decodeEventLog } = require('viem');
const { baseSepolia } = require('viem/chains');

const abi = require('./src/lib/abi/PredictionBattleV10.json').abi;

async function main() {
    const client = createPublicClient({ chain: baseSepolia, transport: http() });
    const latest = await client.getBlockNumber();

    // contract address
    const contract = '0xF8623E94364b58246BC6FaBeA10710563d2dB6ae';

    const logs = await client.getLogs({
        address: contract,
        event: {
            type: 'event',
            name: 'MarketCreated',
            inputs: [
                { type: 'string', name: 'id', indexed: true },
                { type: 'address', name: 'creator', indexed: true },
                { type: 'uint256', name: 'deadlineTime', indexed: false },
                { type: 'uint256', name: 'seedAmount', indexed: false }
            ]
        },
        fromBlock: latest - 1000n,
        toBlock: latest
    });

    console.log(`Found ${logs.length} markets in the last 1000 blocks`);

    if (logs.length > 0) {
        const lastLog = logs[logs.length - 1];
        console.log('\n--- LATEST MARKET ---');
        console.log(`TxHash: ${lastLog.transactionHash}`);
        console.log(`Creator Topic (from log): ${lastLog.topics[2]}`);
        console.log(`ID Hash Topic (from log): ${lastLog.topics[1]}`);

        const receipt = await client.getTransactionReceipt({ hash: lastLog.transactionHash });
        console.log(`receipt.from: ${receipt.from}`);
        console.log(`receipt.to: ${receipt.to}`);

        const tx = await client.getTransaction({ hash: lastLog.transactionHash });
        // Can we see what tx.from was?
        console.log(`tx.from: ${tx.from}`);
    }
}

main().catch(console.error);
