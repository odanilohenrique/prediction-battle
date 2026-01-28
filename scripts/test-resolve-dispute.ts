import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CONTRACT_ADDRESS = '0x661766afe3e2c7f6c7fecc8b229b7211fcd6e907';
const RPC_URL = 'https://sepolia.base.org';
const MARKET_ID = 'pred_1769624319168_n123orr';

// Winner: Proposer address (MUST match exactly as stored in contract)
const WINNER = '0xFbb847E4bA555fa38C737CAA3E3591B6448cE987'; // Will be checksummed internally
const FINAL_RESULT = true; // Proposer said YES
const SHOULD_REOPEN = false;

const ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "_marketId", "type": "string" },
            { "internalType": "address", "name": "_winnerAddress", "type": "address" },
            { "internalType": "bool", "name": "_finalResult", "type": "bool" },
            { "internalType": "bool", "name": "_shouldReopen", "type": "bool" }
        ],
        "name": "resolveDispute",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

async function main() {
    console.log('='.repeat(60));
    console.log('Testing resolveDispute call');
    console.log('='.repeat(60));
    console.log(`Contract: ${CONTRACT_ADDRESS}`);
    console.log(`Market: ${MARKET_ID}`);
    console.log(`Winner: ${WINNER}`);
    console.log(`Result: ${FINAL_RESULT}`);
    console.log(`Reopen: ${SHOULD_REOPEN}`);
    console.log('='.repeat(60));

    const privateKey = process.env.OPERATOR_PRIVATE_KEY;
    if (!privateKey) {
        console.error('OPERATOR_PRIVATE_KEY not found in .env.local');
        return;
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    console.log(`Calling from wallet: ${account.address}`);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    try {
        // Simulate first to see if it would fail
        console.log('\nSimulating transaction...');
        const { request } = await publicClient.simulateContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'resolveDispute',
            args: [MARKET_ID, WINNER as `0x${string}`, FINAL_RESULT, SHOULD_REOPEN],
            account,
        });

        console.log('✅ Simulation passed! Transaction would succeed.');
        console.log('Simulation result:', request);

        // Uncomment below to actually send the transaction
        // const hash = await walletClient.writeContract(request);
        // console.log('Transaction hash:', hash);

    } catch (error: any) {
        console.error('❌ Simulation FAILED!');
        console.error('Error:', error.message);
        if (error.cause) {
            console.error('Cause:', error.cause.message || error.cause);
        }
    }

    console.log('='.repeat(60));
}

main();
