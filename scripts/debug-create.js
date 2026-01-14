
// Debug script to test createPrediction call
const { createPublicClient, http, parseUnits, encodeFunctionData } = require('viem');
const { baseSepolia } = require('viem/chains');

const CONTRACT_ADDRESS = '0xe28cac61177a3a3e3b2cd94c1596a2f1fca11203';
const ABI = [
    {
        inputs: [
            { name: '_id', type: 'string' },
            { name: '_target', type: 'uint256' },
            { name: '_duration', type: 'uint256' },
            { name: '_seedAmount', type: 'uint256' }
        ],
        name: 'createPrediction',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [{ name: '', type: 'string' }],
        name: 'predictionExists',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function'
    }
];

async function main() {
    const client = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
    });

    // Test parameters (same as frontend would send)
    const testId = 'test-debug-' + Date.now();
    const target = BigInt(0);
    const duration = BigInt(86400);
    const seedAmount = parseUnits('20', 6); // $20 USDC = 20000000 wei

    console.log('Testing createPrediction with:');
    console.log('  ID:', testId);
    console.log('  Target:', target.toString());
    console.log('  Duration:', duration.toString());
    console.log('  SeedAmount (wei):', seedAmount.toString());
    console.log('  SeedAmount % 2:', (seedAmount % BigInt(2)).toString());
    console.log('  SeedAmount > 0:', seedAmount > BigInt(0));

    // Check if this ID already exists
    try {
        const exists = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'predictionExists',
            args: [testId]
        });
        console.log('  Prediction Exists:', exists);
    } catch (e) {
        console.log('Error checking existence:', e.message);
    }

    // Check contract bytecode (verify deployment)
    const code = await client.getCode({ address: CONTRACT_ADDRESS });
    console.log('  Contract deployed:', code && code !== '0x' ? 'YES' : 'NO');
    console.log('  Contract code length:', code ? code.length : 0);
}

main().catch(console.error);
