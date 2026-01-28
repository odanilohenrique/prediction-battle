import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CONTRACT_ADDRESS = '0x661766afe3e2c7f6c7fecc8b229b7211fcd6e907';
const RPC_URL = 'https://sepolia.base.org';

const ABI = [
    {
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "bondBalance",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

async function main() {
    console.log('='.repeat(60));
    console.log('Checking Bond Balances');
    console.log('='.repeat(60));

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    const proposer = '0xFbb847E4bA555fa38C737CAA3E3591B6448cE987';
    const challenger = '0x1cb36C90dd0278906295D6bc890A2A76E4D8f80b';

    const proposerBond = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI,
        functionName: 'bondBalance',
        args: [proposer as `0x${string}`],
    });

    const challengerBond = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI,
        functionName: 'bondBalance',
        args: [challenger as `0x${string}`],
    });

    console.log(`Proposer (${proposer}) bondBalance: ${proposerBond}`);
    console.log(`Challenger (${challenger}) bondBalance: ${challengerBond}`);

    console.log('\nExpected for market bonds:');
    console.log('Proposer Bond in market: 5000000');
    console.log('Challenger Bond in market: 5000000');

    if (proposerBond < BigInt(5000000)) {
        console.log('\n❌ PROBLEM: Proposer bondBalance is LESS than market bondAmount!');
        console.log('This will cause underflow when trying to subtract.');
    }
    if (challengerBond < BigInt(5000000)) {
        console.log('\n❌ PROBLEM: Challenger bondBalance is LESS than market challengeBondAmount!');
        console.log('This will cause underflow when trying to subtract.');
    }

    console.log('='.repeat(60));
}

main();
