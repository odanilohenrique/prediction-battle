import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CONTRACT_ADDRESS = '0x661766afe3e2c7f6c7fecc8b229b7211fcd6e907';
const RPC_URL = 'https://sepolia.base.org';
const MARKET_ID = 'pred_1769624319168_n123orr';

// adminResolve just needs marketId and result (no winner address or reopen)
const ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "_marketId", "type": "string" },
            { "internalType": "bool", "name": "_result", "type": "bool" }
        ],
        "name": "adminResolve",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

async function main() {
    console.log('='.repeat(70));
    console.log('Testing adminResolve (Emergency Function)');
    console.log('='.repeat(70));

    const privateKey = process.env.OPERATOR_PRIVATE_KEY;
    if (!privateKey) {
        console.error('OPERATOR_PRIVATE_KEY not found');
        return;
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    console.log(`Caller: ${account.address}`);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    console.log(`\nTrying adminResolve(${MARKET_ID}, true)...`);

    try {
        // First simulate
        const { request } = await publicClient.simulateContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'adminResolve',
            args: [MARKET_ID, true], // Resolve as YES
            account,
        });

        console.log('✅ Simulation PASSED! adminResolve would succeed.');
        console.log('Do you want to execute? The script will NOT auto-execute.');

        // Uncomment to actually execute:
        // const hash = await walletClient.writeContract(request);
        // console.log('Tx hash:', hash);

    } catch (error: any) {
        console.log('❌ adminResolve Simulation FAILED!');
        console.log('Error:', error.message);
    }

    console.log('='.repeat(70));
}

main();
