import { createPublicClient, createWalletClient, http, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CONTRACT_ADDRESS = '0x661766afe3e2c7f6c7fecc8b229b7211fcd6e907';
const RPC_URL = 'https://sepolia.base.org';
const MARKET_ID = 'pred_1769624319168_n123orr';

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
    },
    {
        "inputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "name": "markets",
        "outputs": [
            { "name": "id", "type": "string" },
            { "name": "creator", "type": "address" },
            { "name": "question", "type": "string" },
            { "name": "creationTime", "type": "uint256" },
            { "name": "bonusDuration", "type": "uint256" },
            { "name": "deadline", "type": "uint256" },
            { "name": "state", "type": "uint8" },
            { "name": "result", "type": "bool" },
            { "name": "isVoid", "type": "bool" },
            { "name": "proposer", "type": "address" },
            { "name": "proposedResult", "type": "bool" },
            { "name": "proposalTime", "type": "uint256" },
            { "name": "bondAmount", "type": "uint256" },
            { "name": "evidenceUrl", "type": "string" },
            { "name": "challenger", "type": "address" },
            { "name": "challengeBondAmount", "type": "uint256" },
            { "name": "challengeEvidenceUrl", "type": "string" },
            { "name": "challengeTime", "type": "uint256" },
            { "name": "totalYes", "type": "uint256" },
            { "name": "totalNo", "type": "uint256" },
            { "name": "seedYes", "type": "uint256" },
            { "name": "seedNo", "type": "uint256" },
            { "name": "totalSharesYes", "type": "uint256" },
            { "name": "totalSharesNo", "type": "uint256" },
            { "name": "processedIndex", "type": "uint256" },
            { "name": "paidOut", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

async function main() {
    console.log('='.repeat(70));
    console.log('EXECUTING resolveDispute Transaction');
    console.log('='.repeat(70));

    const privateKey = process.env.OPERATOR_PRIVATE_KEY;
    if (!privateKey) {
        console.error('OPERATOR_PRIVATE_KEY not found');
        return;
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    console.log(`Sending from: ${account.address}`);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    // Get market data
    const data = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI,
        functionName: 'markets',
        args: [MARKET_ID],
    });

    const proposer = data[9] as `0x${string}`;
    const proposedResult = data[10] as boolean;

    console.log(`Winner (Proposer): ${proposer}`);
    console.log(`Final Result: ${proposedResult}`);
    console.log(`Should Reopen: false`);

    console.log('\n📤 Sending transaction...');

    try {
        const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'resolveDispute',
            args: [MARKET_ID, proposer, proposedResult, false],
        });

        console.log(`✅ Transaction sent! Hash: ${hash}`);
        console.log(`View on BaseScan: https://sepolia.basescan.org/tx/${hash}`);

        console.log('\n⏳ Waiting for confirmation...');
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === 'success') {
            console.log('✅ Transaction CONFIRMED!');
        } else {
            console.log('❌ Transaction REVERTED on-chain');
        }
    } catch (error: any) {
        console.error('\n❌ Transaction FAILED');
        console.error('Error:', error.message);
        if (error.shortMessage) {
            console.error('Short message:', error.shortMessage);
        }
    }

    console.log('='.repeat(70));
}

main();
