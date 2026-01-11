import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import { CURRENT_CONFIG } from './config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';

// Use MAINNET or TESTNET chain object from viem based on config
const chain = process.env.NEXT_PUBLIC_USE_MAINNET === 'true' ? base : baseSepolia;

export function getOperatorClient() {
    const privateKey = process.env.OPERATOR_PRIVATE_KEY;

    if (!privateKey) {
        throw new Error("OPERATOR_PRIVATE_KEY is missing in env variables");
    }

    // "0x" prefix handling
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    const client = createWalletClient({
        account,
        chain,
        transport: http()
    }).extend(publicActions); // Extend with public actions to read/write

    return client;
}

export async function resolvePredictionOnChain(predictionId: string, result: boolean) {
    const client = getOperatorClient();

    console.log(`[OPERATOR] Resolving bet ${predictionId} on-chain with result: ${result}`);

    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'resolvePrediction',
            args: [predictionId, result],
        });

        console.log(`[OPERATOR] Resolve Tx Hash: ${hash}`);

        // Wait for receipt
        const receipt = await client.waitForTransactionReceipt({ hash });

        if (receipt.status !== 'success') {
            throw new Error(`Transaction reverted: ${hash}`);
        }

        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to resolve on-chain:", error);
        throw error;
    }
}

export async function distributeWinningsOnChain(predictionId: string, batchSize: number = 50) {
    const client = getOperatorClient();

    console.log(`[OPERATOR] Distributing winnings for ${predictionId} (Batch: ${batchSize})`);

    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'distributeWinnings',
            args: [predictionId, BigInt(batchSize)],
        });

        console.log(`[OPERATOR] Payout Tx Hash: ${hash}`);

        const receipt = await client.waitForTransactionReceipt({ hash });

        if (receipt.status !== 'success') {
            throw new Error(`Transaction reverted: ${hash}`);
        }

        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to distribute on-chain:", error);
        throw error;
    }
}
