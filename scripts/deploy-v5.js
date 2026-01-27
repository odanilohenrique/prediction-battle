const { createWalletClient, http, defineChain } = require('viem');
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

const PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY; // Using Operator key (make sure it has ETH) or fallback to PRIVATE_KEY
const DEPLOYER_KEY = PRIVATE_KEY || process.env.PRIVATE_KEY;

if (!DEPLOYER_KEY) {
    console.error('❌ Missing PRIVATE_KEY in .env');
    process.exit(1);
}

const account = privateKeyToAccount(DEPLOYER_KEY);

const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http()
});

async function main() {
    const abiPath = path.resolve(__dirname, '../artifacts/PredictionBattleV5.abi');
    const binPath = path.resolve(__dirname, '../artifacts/PredictionBattleV5.bin');

    if (!fs.existsSync(abiPath) || !fs.existsSync(binPath)) {
        console.error('❌ Artifacts not found. Run compile-v5.js first.');
        process.exit(1);
    }

    const bytecode = `0x${fs.readFileSync(binPath, 'utf8').trim()}`;
    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

    // USDC Address on Base Sepolia
    const USDC_ADDRESS_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
    // const USDC_ADDRESS_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

    // Check Env
    const IS_MAINNET = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
    if (IS_MAINNET) {
        console.error('❌ This script defaults to Sepolia. Modify script to enable Mainnet deployment if intended.');
        // process.exit(1); 
    }

    console.log('\n🚀 Deploying V5 (User Disputes + 10m Window)...');
    console.log('Deployer:', account.address);

    try {
        const hash = await walletClient.deployContract({
            abi,
            bytecode,
            args: [USDC_ADDRESS_SEPOLIA],
        });
        console.log('📝 Transaction Hash:', hash);

        // Simple wait (assume success after reasonable time or use public client)
        // Creating public client to wait properly
        const { createPublicClient } = require('viem');
        const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http()
        });

        console.log('⏳ Waiting for confirmation...');
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.contractAddress) {
            console.log('\n✅ V5 Deployed Successfully!');
            console.log('📍 Address:', receipt.contractAddress);

            // Note: Gas Used
            // console.log('Gas Used:', receipt.gasUsed.toString());

            // Update Frontend JSON
            const frontendAbiPath = path.resolve(__dirname, '../src/lib/abi/PredictionBattle.json');
            // Wrap in { abi: [...] } format used by wagmi codegen usually, OR checking existing file
            // Current file likely imports directly.
            // Let's create { abi: ... } object to be safe as previously seen.
            const artifact = { abi: abi };
            fs.writeFileSync(frontendAbiPath, JSON.stringify(artifact, null, 2));
            console.log('✅ Updated src/lib/abi/PredictionBattle.json');

            // Also update V5 specific json just in case
            fs.writeFileSync(path.resolve(__dirname, '../src/lib/abi/PredictionBattleV5.json'), JSON.stringify(artifact, null, 2));

            console.log(`\nIMPORTANT: Update config.ts with new address: ${receipt.contractAddress}`);
        }
    } catch (error) {
        console.error('\n❌ Deployment error:', error.shortMessage || error.message);
        process.exit(1);
    }
}

main();
