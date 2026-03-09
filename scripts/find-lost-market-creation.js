const { createPublicClient, http, keccak256, toHex } = require('viem');
const { baseSepolia } = require('viem/chains');

const client = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });
const CONTRACT_ADDRESS = '0xF8623E94364b58246BC6FaBeA10710563d2dB6ae'; // The Base Sepolia contract address

async function main() {
    let latestBlock = await client.getBlockNumber();
    console.log(`Current Base Sepolia block: ${latestBlock}`);

    // We scan the last 20k blocks which is around 11 hours
    const CHUNK = 5000n;
    const TOPIC = keccak256(toHex('MarketCreated(string,address,uint256,uint256)'));
    console.log(`Looking for topic: ${TOPIC}`);

    for (let currentFrom = latestBlock - 20000n; currentFrom <= latestBlock; currentFrom += CHUNK + 1n) {
        let currentTo = currentFrom + CHUNK;
        if (currentTo > latestBlock) currentTo = latestBlock;

        console.log(`Scanning chunks: ${currentFrom} to ${currentTo}`);
        const logs = await client.getLogs({
            address: CONTRACT_ADDRESS,
            fromBlock: currentFrom,
            toBlock: currentTo
        });

        for (const log of logs) {
            if (log.topics[0] === TOPIC) {
                console.log('MARKET CREATED FOUND!');
                console.log(`Tx: ${log.transactionHash}`);
                // The actual ID string hash is in topic[1] usually
                console.log(`Data / Topics: ${log.topics}`);
            }
        }
    }
}
main().catch(console.error);
