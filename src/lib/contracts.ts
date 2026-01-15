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

// Check if prediction is resolved on-chain (V2: getMarketInfo)
export async function isPredictionResolved(predictionId: string): Promise<boolean> {
    const client = getOperatorClient();
    try {
        // V2: getMarketInfo returns (creator, deadline, resolved, result, totalYes, totalNo, totalSharesYes, totalSharesNo)
        const data = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'getMarketInfo',
            args: [predictionId],
        }) as any[];

        // V2 struct order: [creator, deadline, resolved, result, totalYes, totalNo, ...]
        // Index 2 is 'resolved' (boolean)
        if (Array.isArray(data) && typeof data[2] === 'boolean') {
            return data[2];
        }

        return false;
    } catch (error) {
        console.error("Failed to check market status:", error);
        return false;
    }
}

// V2 function: resolveMarket
export async function resolvePredictionOnChain(predictionId: string, result: boolean, waitForReceipt: boolean = true) {
    const client = getOperatorClient();

    console.log(`[OPERATOR] Resolving market ${predictionId} on-chain with result: ${result}`);

    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'resolveMarket',
            args: [predictionId, result],
        });

        console.log(`[OPERATOR] Resolve Tx Hash: ${hash}`);

        if (waitForReceipt) {
            // Wait for receipt
            const receipt = await client.waitForTransactionReceipt({ hash });

            if (receipt.status !== 'success') {
                throw new Error(`Transaction reverted: ${hash}`);
            }
        }

        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to resolve on-chain:", error);
        throw error;
    }
}

// V2 function: voidMarket
export async function resolveVoidOnChain(predictionId: string, waitForReceipt: boolean = true) {
    const client = getOperatorClient();

    console.log(`[OPERATOR] Voiding market ${predictionId} on-chain`);

    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'voidMarket',
            args: [predictionId],
        });

        console.log(`[OPERATOR] Void Tx Hash: ${hash}`);

        if (waitForReceipt) {
            const receipt = await client.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction reverted: ${hash}`);
            }
        }

        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to void on-chain:", error);
        throw error;
    }
}

export async function distributeWinningsOnChain(predictionId: string, batchSize: number = 50, waitForReceipt: boolean = true) {
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

        if (waitForReceipt) {
            const receipt = await client.waitForTransactionReceipt({ hash });

            if (receipt.status !== 'success') {
                throw new Error(`Transaction reverted: ${hash}`);
            }
        }

        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to distribute on-chain:", error);
        throw error;
    }
}

export async function claimReferralRewardsOnChain(waitForReceipt: boolean = true) {
    const client = getOperatorClient();

    console.log(`[OPERATOR] Claiming referral rewards...`);

    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'claimReferralRewards',
            args: [],
        });

        console.log(`[OPERATOR] Claim Tx Hash: ${hash}`);

        if (waitForReceipt) {
            const receipt = await client.waitForTransactionReceipt({ hash });

            if (receipt.status !== 'success') {
                throw new Error(`Transaction reverted: ${hash}`);
            }
        }

        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to claim referral rewards:", error);
        throw error;
    }
}
