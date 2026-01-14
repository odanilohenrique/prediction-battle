
// Script para adicionar operador ao contrato
// Deve ser executado com a wallet que fez o deploy (admin)

const { createWalletClient, createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
require('dotenv').config({ path: '.env.local' });

const CONTRACT_ADDRESS = '0xe28cac61177a3a3e3b2cd94c1596a2f1fca11203';
const OPERATOR_ADDRESS = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02';

const ABI = [
    {
        inputs: [
            { name: '_operator', type: 'address' },
            { name: '_status', type: 'bool' }
        ],
        name: 'setOperator',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [{ name: '', type: 'address' }],
        name: 'operators',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'admin',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function'
    }
];

async function main() {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

    if (!privateKey) {
        console.error('ERROR: DEPLOYER_PRIVATE_KEY not set in .env.local');
        console.log('Add this line to your .env.local file:');
        console.log('DEPLOYER_PRIVATE_KEY=0x...');
        process.exit(1);
    }

    const account = privateKeyToAccount(privateKey);
    console.log('Using admin wallet:', account.address);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
    });

    // Check current admin
    const admin = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'admin',
    });
    console.log('Contract admin:', admin);

    if (admin.toLowerCase() !== account.address.toLowerCase()) {
        console.error('ERROR: Your wallet is not the admin of this contract!');
        console.error('Current admin:', admin);
        console.error('Your wallet:', account.address);
        process.exit(1);
    }

    // Check if already operator
    const isOperator = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'operators',
        args: [OPERATOR_ADDRESS],
    });

    if (isOperator) {
        console.log('Wallet is already an operator!');
        return;
    }

    console.log('Adding operator:', OPERATOR_ADDRESS);

    // Add operator
    const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'setOperator',
        args: [OPERATOR_ADDRESS, true],
    });

    console.log('Transaction sent:', hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('Transaction confirmed!');
    console.log('Status:', receipt.status);

    // Verify
    const isNowOperator = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'operators',
        args: [OPERATOR_ADDRESS],
    });

    console.log('Operator status:', isNowOperator ? 'AUTHORIZED ✅' : 'NOT AUTHORIZED ❌');
}

main().catch(console.error);
