import { createPublicClient, http, decodeErrorResult, parseAbi } from 'viem';
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

const STATE_NAMES: { [key: number]: string } = {
    0: 'OPEN',
    1: 'LOCKED',
    2: 'PROPOSED',
    3: 'DISPUTED',
    4: 'RESOLVED',
};

async function main() {
    console.log('='.repeat(70));
    console.log('DETAILED Debug for resolveDispute');
    console.log('='.repeat(70));

    const privateKey = process.env.OPERATOR_PRIVATE_KEY;
    if (!privateKey) {
        console.error('OPERATOR_PRIVATE_KEY not found');
        return;
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    console.log(`Caller: ${account.address}`);

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    // 1. Read current market state
    console.log('\n📊 Reading Market State...');
    const data = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI,
        functionName: 'markets',
        args: [MARKET_ID],
    });

    const state = Number(data[6]);
    const proposer = data[9] as string;
    const challenger = data[14] as string;
    const proposedResult = data[10] as boolean;
    const bondAmount = BigInt(data[12]);
    const challengeBondAmount = BigInt(data[15]);

    console.log(`State: ${state} (${STATE_NAMES[state]})`);
    console.log(`Proposer: ${proposer}`);
    console.log(`Challenger: ${challenger}`);
    console.log(`Proposed Result: ${proposedResult}`);
    console.log(`Proposer Bond: ${bondAmount}`);
    console.log(`Challenger Bond: ${challengeBondAmount}`);

    // Checks
    console.log('\n🔍 Pre-Flight Checks:');

    if (state !== 3) {
        console.log(`❌ Market is NOT in DISPUTED state (current: ${STATE_NAMES[state]})`);
        return;
    }
    console.log('✅ Market is in DISPUTED state');

    // Test with proposer as winner
    console.log('\n📤 Testing resolveDispute with PROPOSER as winner...');
    const winnerAddress = proposer;
    const finalResult = proposedResult;
    const shouldReopen = false;

    console.log(`Args: [${MARKET_ID}, ${winnerAddress}, ${finalResult}, ${shouldReopen}]`);

    try {
        const { request } = await client.simulateContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'resolveDispute',
            args: [MARKET_ID, winnerAddress as `0x${string}`, finalResult, shouldReopen],
            account,
        });
        console.log('✅ Simulation PASSED!');
    } catch (error: any) {
        console.log('❌ Simulation FAILED');
        console.log('Error message:', error.message);

        // Try to decode error
        if (error.cause?.data) {
            console.log('Error data:', error.cause.data);
        }

        // Check specific conditions
        console.log('\n🔎 Possible reasons:');
        console.log(`- Is caller admin? ${account.address} should equal 0xFA278...`);
        console.log(`- Is winnerAddress valid? ${winnerAddress} should be proposer or challenger`);
        console.log(`- Are bonds > 0? Proposer: ${bondAmount}, Challenger: ${challengeBondAmount}`);
    }

    console.log('='.repeat(70));
}

main();
