
// Check specific transaction status
const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');

async function main() {
    const client = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
    });

    // User's original transaction that timed out
    const txHash = '0xe304b66b5676b3a75c30483de3d55dfcb3f685ea7f249c8585ba80d86eded581';

    console.log('Checking transaction:', txHash);

    try {
        const receipt = await client.getTransactionReceipt({ hash: txHash });
        console.log('Transaction found!');
        console.log('  Status:', receipt.status); // 'success' or 'reverted'
        console.log('  Block:', receipt.blockNumber);
        console.log('  Gas Used:', receipt.gasUsed);

        if (receipt.logs && receipt.logs.length > 0) {
            console.log('  Events emitted:', receipt.logs.length);
        }
    } catch (e) {
        console.log('Transaction not found or error:', e.message);
    }
}

main().catch(console.error);
