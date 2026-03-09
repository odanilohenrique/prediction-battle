const { createPublicClient, http, parseAbi, keccak256, toHex } = require('viem');
const { baseSepolia } = require('viem/chains');

const CONTRACT_ADDRESS = '0xF8623E94364b58246BC6FaBeA10710563d2dB6ae';
const client = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });

const abi = parseAbi([
    'event MarketStateChanged(string indexed marketId, uint8 oldState, uint8 newState)',
    'event MarketResolved(string indexed id, bool result, uint256 winnerPool)',
    'event MarketVoided(string indexed id)',
    'event AdminResolveNoWinners(string indexed marketId, uint8 originalOutcome, uint8 forcedOutcome)',
    'event SeedConfiscated(string indexed marketId, address indexed creator, address indexed treasury, uint256 amount)'
]);

async function main() {
    let latestBlock = await client.getBlockNumber();
    const CHUNK = 999n;
    console.log(`Scanning up to 50k blocks back for ANY event on this contract...`);

    const marketId = '0xb3e3d2a8853d41e93462e2694c1c08c54b57cbffaf5abbae8b4521a42e6632d4';
    const hashedId = keccak256(toHex(marketId));

    // We will just fetch all logs for the contract and manually parse them
    for (let currentFrom = latestBlock - 50000n; currentFrom <= latestBlock; currentFrom += CHUNK + 1n) {
        let currentTo = currentFrom + CHUNK;
        if (currentTo > latestBlock) currentTo = latestBlock;

        const logs = await client.getLogs({
            address: CONTRACT_ADDRESS,
            fromBlock: currentFrom,
            toBlock: currentTo
        });

        for (const log of logs) {
            try {
                // Try to find ANY event related to our market
                if (log.topics.length > 1) {
                    // Viem hashes string topics
                    if (log.topics[1] === hashedId) {
                        console.log(`Found matching event at tx ${log.transactionHash}`);
                        const tx = await client.getTransaction({ hash: log.transactionHash });
                        console.log(`Input Selector: ${tx.input.slice(0, 10)}`);
                        // Also print the topic0 to identify the event
                        console.log(`Topic0: ${log.topics[0]}`);
                    }
                }
            } catch (e) { }
        }
    }
}
main().catch(console.error);
