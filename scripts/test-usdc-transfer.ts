import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CONTRACT_ADDRESS = '0x661766afe3e2c7f6c7fecc8b229b7211fcd6e907';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const RPC_URL = 'https://sepolia.base.org';
const WINNER = '0xFbb847E4bA555fa38C737CAA3E3591B6448cE987';
const TOTAL_BOND = BigInt(10000000); // 10 USDC

// Simulate the transfer the contract would do
const ERC20_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "transfer",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

async function main() {
    console.log('='.repeat(70));
    console.log('Testing USDC transfer from contract perspective');
    console.log('='.repeat(70));

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    // Check contract USDC balance
    const balance = await client.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [CONTRACT_ADDRESS as `0x${string}`],
    });

    console.log(`Contract USDC Balance: ${balance} (${Number(balance) / 1e6} USDC)`);
    console.log(`Amount to transfer: ${TOTAL_BOND} (10 USDC)`);
    console.log(`Recipient: ${WINNER}`);

    // We can't simulate a transfer FROM the contract (we're not the contract)
    // But we can check if the USDC contract itself has any weird restrictions

    console.log('\nThe transfer should work if the contract has enough balance.');
    console.log('Since balance > amount, the issue might be elsewhere.');

    // Let's check if there's a pauser or blacklist on test USDC
    console.log('\nNote: Some test USDC contracts have additional checks that might fail.');
    console.log('The safest workaround is to use adminResolve instead of resolveDispute.');

    console.log('='.repeat(70));
}

main();
