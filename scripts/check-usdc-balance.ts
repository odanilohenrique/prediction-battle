import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CONTRACT_ADDRESS = '0x661766afe3e2c7f6c7fecc8b229b7211fcd6e907';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const RPC_URL = 'https://sepolia.base.org';

const ERC20_ABI = [
    {
        "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

async function main() {
    console.log('='.repeat(60));
    console.log('Checking Contract USDC Balance');
    console.log('='.repeat(60));

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    const balance = await client.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [CONTRACT_ADDRESS as `0x${string}`],
    });

    console.log(`Contract USDC Balance: ${balance} (${Number(balance) / 1e6} USDC)`);

    // Total bond to transfer is 10 USDC (5 + 5)
    const totalBondToTransfer = BigInt(10000000);
    console.log(`Required for resolveDispute: ${totalBondToTransfer} (10 USDC)`);

    if (balance < totalBondToTransfer) {
        console.log('\n❌ INSUFFICIENT BALANCE!');
        console.log('The contract cannot transfer the bond reward because it has less USDC than needed.');
    } else {
        console.log('\n✅ Balance is sufficient');
    }

    console.log('='.repeat(60));
}

main();
