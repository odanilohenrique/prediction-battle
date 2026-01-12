// Script to grant operator role on the new contract
// Run with: node scripts/grant-operator-new.js

const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
function loadEnv() {
    try {
        const envPath = path.join(__dirname, '..', '.env.local');
        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                let value = valueParts.join('=').trim();
                // Remove quotes
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                process.env[key.trim()] = value;
            }
        }
    } catch (e) {
        console.log('Could not load .env.local:', e.message);
    }
}

loadEnv();

// Contract details
const CONTRACT_ADDRESS = '0x7a4128f643e1D023c498B7a616F7243Ef9Aa6eBc';
const OPERATOR_ADDRESS = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02';

const ABI = [
    {
        name: 'setOperator',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: '_operator', type: 'address' },
            { name: '_status', type: 'bool' }
        ],
        outputs: []
    },
    {
        name: 'operators',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }]
    },
    {
        name: 'admin',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }]
    }
];

async function main() {
    const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

    if (!PRIVATE_KEY) {
        console.error('❌ No private key found. Set DEPLOYER_PRIVATE_KEY or PRIVATE_KEY in .env.local');
        process.exit(1);
    }

    console.log('🔧 Grant Operator Script');
    console.log('========================');
    console.log('Contract:', CONTRACT_ADDRESS);
    console.log('Operator to grant:', OPERATOR_ADDRESS);

    const account = privateKeyToAccount(`0x${PRIVATE_KEY.replace('0x', '')}`);
    console.log('Signing with:', account.address);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org')
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http('https://sepolia.base.org')
    });

    // Check current admin
    const currentAdmin = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'admin'
    });
    console.log('Contract Admin:', currentAdmin);

    if (currentAdmin.toLowerCase() !== account.address.toLowerCase()) {
        console.error('❌ Your wallet is not the admin! Only admin can grant operators.');
        process.exit(1);
    }

    // Check if already operator
    const isAlreadyOperator = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'operators',
        args: [OPERATOR_ADDRESS]
    });

    if (isAlreadyOperator) {
        console.log('✅ Address is already an operator! No action needed.');
        return;
    }

    // Grant operator
    console.log('📝 Granting operator role...');

    const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'setOperator',
        args: [OPERATOR_ADDRESS, true]
    });

    console.log('Tx Hash:', hash);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
        console.log('✅ Operator granted successfully!');
    } else {
        console.log('❌ Transaction failed');
    }
}

main().catch(console.error);
