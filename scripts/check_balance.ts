
import { createPublicClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkBalance() {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) {
        console.error("Missing NEXT_PUBLIC_RPC_URL");
        process.exit(1);
    }

    const privateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
        console.error("Missing PRIVATE_KEY");
        process.exit(1);
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(rpcUrl)
    });

    try {
        const balance = await client.getBalance({ address: account.address });
        console.log(`Address: ${account.address}`);
        console.log(`Balance: ${formatEther(balance)} ETH`);
    } catch (error) {
        console.error("Error fetching balance:", error);
    }
}

checkBalance();
