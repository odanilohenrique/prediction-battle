import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CONTRACT_ADDRESS = '0x661766afe3e2c7f6c7fecc8b229b7211fcd6e907';
const RPC_URL = 'https://sepolia.base.org';

const ABI = [
    {
        "inputs": [],
        "name": "admin",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "operators",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

async function main() {
    console.log('='.repeat(60));
    console.log('Checking Contract Admin & Operators');
    console.log('='.repeat(60));

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    // Get admin
    const admin = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI,
        functionName: 'admin',
    });
    console.log(`Admin: ${admin}`);

    // Check operators
    const operatorsToCheck = [
        '0xFbb847E4bA555fa38C737CAA3E3591B6448cE987', // User's admin wallet
        '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02', // Operator wallet
    ];

    for (const addr of operatorsToCheck) {
        const isOp = await client.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'operators',
            args: [addr as `0x${string}`],
        });
        console.log(`${addr} is operator: ${isOp}`);
    }

    console.log('='.repeat(60));
}

main();
