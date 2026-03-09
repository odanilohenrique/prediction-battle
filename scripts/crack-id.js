const { createPublicClient, http, keccak256, encodePacked, stringToBytes } = require('viem');
const { baseSepolia } = require('viem/chains');

const client = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });

async function main() {
    const txHash = '0x86e04a55c1fc0e19e2d3c7691fcd96bacf4e36a1c6917c73a82479670e541468';
    const targetTopicHash = '0xe498f92d0ab9ba0c19af1da5cf4f90b8b2c07e304f5a95bcf2b4979e6f80c15a';

    // We get the transaction receipt to get the block number
    const tx = await client.getTransactionReceipt({ hash: txHash });
    const block = await client.getBlock({ blockNumber: tx.blockNumber });
    const blockTimestamp = block.timestamp;

    const address = '0x8c451adc05efdde2b8cb2f0ba9d7a2223212becb';
    const question = 'slash slash slash slash slash';

    // The contract nonce is at 29 right now, so it was probably a bit less back then
    const maxNonce = 35;

    console.log(`Starting crack. Base Timestamp: ${blockTimestamp}. Address: ${address}`);

    for (let nonce = 0; nonce <= maxNonce; nonce++) {
        for (let offset = -20; offset <= 20; offset++) {
            const ts = blockTimestamp + BigInt(offset);

            const candidateId = keccak256(encodePacked(
                ['address', 'string', 'uint256', 'uint256'],
                [address, question, ts, BigInt(nonce)]
            ));

            const candidateTopicHash = keccak256(stringToBytes(candidateId));

            if (candidateTopicHash === targetTopicHash) {
                console.log(`\n🎉 BINGO! MATCH FOUND!`);
                console.log(`REAL MARKET ID: ${candidateId}`);
                console.log(`Nonce used: ${nonce}`);
                console.log(`Timestamp offset: ${offset}`);
                return;
            }
        }
    }

    console.log('\n❌ Could not crack the ID. Something is different.');
}

main().catch(console.error);
