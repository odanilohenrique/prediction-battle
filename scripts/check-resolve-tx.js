const { createPublicClient, http, parseAbiItem } = require('viem');
const { baseSepolia } = require('viem/chains');

const client = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });
const CONTRACT_ADDRESS = '0xF8623E94364b58246BC6FaBeA10710563d2dB6ae';

async function main() {
    const marketId = '0xb3e3d2a8853d41e93462e2694c1c08c54b57cbffaf5abbae8b4521a42e6632d4';

    let logs = [];
    const CHUNK = 9999n;
    let latestBlock = await client.getBlockNumber();
    for (let currentFrom = latestBlock - 500000n; currentFrom <= latestBlock; currentFrom += CHUNK + 1n) {
        let currentTo = currentFrom + CHUNK;
        if (currentTo > latestBlock) currentTo = latestBlock;
        const chunkLogs = await client.getLogs({
            address: CONTRACT_ADDRESS,
            event: parseAbiItem('event MarketVoided(string indexed id)'),
            args: { id: marketId },
            fromBlock: currentFrom,
            toBlock: currentTo
        });
        logs = logs.concat(chunkLogs);
    }

    if (logs.length === 0) {
        console.log('No MarketVoided event found for this ID.');
        return;
    }

    for (const log of logs) {
        console.log(`Found resolve log in tx: ${log.transactionHash}`);
        const tx = await client.getTransaction({ hash: log.transactionHash });
        console.log(`Function selector (first 4 bytes of data): ${tx.input.slice(0, 10)}`);

        // Known selectors:
        // adminResolve(string,uint8,bool) = 0xsomething
        // voidMarket(string) = ?
        console.log(`Full input data: ${tx.input}`);
    }
}
main().catch(console.error);
