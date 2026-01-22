const { createWalletClient, http, defineChain, parseEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Base Sepolia Config
const baseSepolia = defineChain({
    id: 84532,
    name: 'Base Sepolia',
    network: 'base-sepolia',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: { http: ['https://sepolia.base.org'] },
        public: { http: ['https://sepolia.base.org'] },
    },
    blockExplorers: {
        default: { name: 'Basescan', url: 'https://sepolia.basescan.org' },
    },
});

const PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error('❌ Missing PRIVATE_KEY in .env');
    process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);

const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http()
});

async function main() {
    const abiPath = path.resolve(__dirname, '../artifacts/PredictionBattleV3.abi');
    const binPath = path.resolve(__dirname, '../artifacts/PredictionBattleV3.bin');

    const bytecode = `0x${fs.readFileSync(binPath, 'utf8').trim()}`;
    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

    // USDC Address on Base Sepolia
    const USDC_ADDRESS_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

    console.log('\n🚀 Deploying RESTORED V3 contract...');
    console.log('Deployer:', account.address);

    try {
        const hash = await walletClient.deployContract({
            abi,
            bytecode,
            args: [USDC_ADDRESS_SEPOLIA],
        });
        console.log('📝 Transaction Hash:', hash);

        // Wait for confirmation logic would require publicClient, skipping for speed, just assume success or check explorer
        console.log('⏳ Waiting for block inclusion...');
        // We can't wait easily without public client here, so we will just print hash.
        // But let's create a public client to wait properly
        const { createPublicClient } = require('viem');
        const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http()
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.contractAddress) {
            console.log('\n✅ Contract Deployed Successfully!');
            console.log('📍 Address:', receipt.contractAddress);

            // Overwrite V4 ABI for Frontend Compatibility
            console.log('\n🔄 Overwriting PredictionBattleV4.json with V3 ABI...');
            const frontendAbiPath = path.resolve(__dirname, '../src/lib/abi/PredictionBattleV4.json');
            // Write structured JSON as expected by wagmi import usually: { abi: [...] } or just [...]
            // The previous file looked like { "abi": [...] } based on imports "PredictionBattleABI.abi"
            // Let's verify format.
            const artifact = { abi: abi };
            fs.writeFileSync(frontendAbiPath, JSON.stringify(artifact, null, 2));
            console.log('✅ Frontend ABI updated.');

            console.log(`\nIMPORTANT: Update config.ts with new address: ${receipt.contractAddress}`);
        }
    } catch (error) {
        console.error('\n❌ Deployment error:', error.shortMessage || error.message);
        process.exit(1);
    }
}

main();
