import { createPublicClient, http, encodeFunctionData, decodeFunctionResult } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CONTRACT_ADDRESS = '0x661766afe3e2c7f6c7fecc8b229b7211fcd6e907';
const RPC_URL = 'https://sepolia.base.org';
const MARKET_ID = 'pred_1769624319168_n123orr';

async function main() {
    console.log('='.repeat(70));
    console.log('DEEP DEBUG: Tracing resolveDispute Call');
    console.log('='.repeat(70));

    const privateKey = process.env.OPERATOR_PRIVATE_KEY;
    if (!privateKey) {
        console.error('OPERATOR_PRIVATE_KEY not found');
        return;
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    // Manual call to get raw error data
    const callData = encodeFunctionData({
        abi: [{
            "inputs": [
                { "name": "_marketId", "type": "string" },
                { "name": "_winnerAddress", "type": "address" },
                { "name": "_finalResult", "type": "bool" },
                { "name": "_shouldReopen", "type": "bool" }
            ],
            "name": "resolveDispute",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }],
        functionName: 'resolveDispute',
        args: [
            MARKET_ID,
            '0xFbb847E4bA555fa38C737CAA3E3591B6448cE987' as `0x${string}`, // proposer
            true,
            false
        ],
    });

    console.log('Encoded calldata:', callData);
    console.log('');

    try {
        const result = await client.call({
            account: account.address,
            to: CONTRACT_ADDRESS as `0x${string}`,
            data: callData,
        });
        console.log('Call result:', result);
    } catch (error: any) {
        console.log('Call failed with error:');
        console.log('Message:', error.message);

        // Try to extract revert reason
        if (error.cause) {
            console.log('\nCause:', JSON.stringify(error.cause, null, 2));
        }

        // Check for specific error patterns
        const errorStr = error.message || '';

        if (errorStr.includes('Not authorized')) {
            console.log('\n❌ DIAGNOSIS: Caller is not admin or operator');
        } else if (errorStr.includes('No market')) {
            console.log('\n❌ DIAGNOSIS: Market does not exist');
        } else if (errorStr.includes('Not in dispute')) {
            console.log('\n❌ DIAGNOSIS: Market not in DISPUTED state');
        } else if (errorStr.includes('Invalid winner')) {
            console.log('\n❌ DIAGNOSIS: Winner address is not proposer or challenger');
        } else if (errorStr.includes('Bond reward failed')) {
            console.log('\n❌ DIAGNOSIS: USDC transfer to winner failed');
        } else if (errorStr.includes('underflow') || errorStr.includes('overflow')) {
            console.log('\n❌ DIAGNOSIS: Arithmetic underflow/overflow in bond subtraction');
        } else {
            console.log('\n⚠️  Could not determine specific error. May need to check contract bytecode.');
        }
    }

    // Check if resolveDispute function exists with correct signature
    console.log('\n📋 Checking function selectors...');

    // resolveDispute(string,address,bool,bool) should be: 0x...
    const selector = callData.slice(0, 10);
    console.log('resolveDispute selector:', selector);

    // Try calling with eth_call to get trace
    console.log('\n📡 Attempting eth_call trace...');

    try {
        const traceResult = await client.request({
            method: 'eth_call' as any,
            params: [{
                from: account.address,
                to: CONTRACT_ADDRESS,
                data: callData,
            }, 'latest'],
        });
        console.log('Trace result:', traceResult);
    } catch (e: any) {
        console.log('Trace error:', e.message?.slice(0, 200));

        // Try to extract revert data
        if (e.details) {
            console.log('Details:', e.details);
        }
    }

    console.log('='.repeat(70));
}

main();
