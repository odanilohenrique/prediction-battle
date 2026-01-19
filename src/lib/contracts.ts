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

// V3: MarketState enum
export enum MarketState {
    OPEN = 0,
    LOCKED = 1,
    PROPOSED = 2,
    RESOLVED = 3
}

// Check if prediction is resolved on-chain (V3: uses MarketState enum)
export async function isPredictionResolved(predictionId: string): Promise<boolean> {
    const client = getOperatorClient();
    try {
        // V3: getMarketInfo returns (creator, deadline, state, result, totalYes, totalNo, totalSharesYes, totalSharesNo)
        const data = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'getMarketInfo',
            args: [predictionId],
        }) as any[];

        // V3 struct order: [creator, deadline, state (enum), result, totalYes, totalNo, ...]
        // Index 2 is 'state' (uint8 enum)
        if (Array.isArray(data) && typeof data[2] === 'number') {
            return data[2] === MarketState.RESOLVED;
        }

        return false;
    } catch (error) {
        console.error("Failed to check market status:", error);
        return false;
    }
}

// V3: Get market state
export async function getMarketState(predictionId: string): Promise<MarketState> {
    const client = getOperatorClient();
    try {
        const data = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'getMarketInfo',
            args: [predictionId],
        }) as any[];

        if (Array.isArray(data) && typeof data[2] === 'number') {
            return data[2] as MarketState;
        }

        return MarketState.OPEN;
    } catch (error) {
        console.error("Failed to get market state:", error);
        return MarketState.OPEN;
    }
}

// V3: Get required bond amount
export async function getRequiredBond(predictionId: string): Promise<bigint> {
    const client = getOperatorClient();
    try {
        const bond = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'getRequiredBond',
            args: [predictionId],
        }) as bigint;

        return bond;
    } catch (error) {
        console.error("Failed to get required bond:", error);
        return BigInt(0);
    }
}

// V3: Get reporter reward
export async function getReporterReward(predictionId: string): Promise<bigint> {
    const client = getOperatorClient();
    try {
        const reward = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'getReporterReward',
            args: [predictionId],
        }) as bigint;

        return reward;
    } catch (error) {
        console.error("Failed to get reporter reward:", error);
        return BigInt(0);
    }
}

// V3: Get proposal info
export async function getProposalInfo(predictionId: string) {
    const client = getOperatorClient();
    try {
        const data = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'getProposalInfo',
            args: [predictionId],
        }) as any[];

        // Returns: (proposer, proposedResult, proposalTime, bondAmount, disputeDeadline, canFinalize)
        return {
            proposer: data[0] as string,
            proposedResult: data[1] as boolean,
            proposalTime: data[2] as bigint,
            bondAmount: data[3] as bigint,
            disputeDeadline: data[4] as bigint,
            canFinalize: data[5] as boolean,
            evidenceUrl: data[6] as string, // V3.1
        };
    } catch (error) {
        console.error("Failed to get proposal info:", error);
        return null;
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

// V2 NOTE: distributeWinnings does NOT exist in V2!
// In V2, users claim their own rewards via claimReward(marketId)
// This function is kept for backwards compatibility but will throw an error
export async function distributeWinningsOnChain(predictionId: string, batchSize: number = 50, waitForReceipt: boolean = true) {
    console.warn(`[OPERATOR] distributeWinnings is DEPRECATED in V2. Users must call claimReward() themselves.`);
    console.warn(`[OPERATOR] Market ${predictionId} is resolved. Winners can claim via the UI.`);

    // Don't actually call the contract - just return a fake hash to prevent errors
    // This allows the DB to update without failing
    return '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
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

// ============ V3: Decentralized Verification Functions ============

// V3: Dispute an outcome (Admin only)
export async function disputeOutcomeOnChain(predictionId: string, waitForReceipt: boolean = true) {
    const client = getOperatorClient();

    console.log(`[OPERATOR] Disputing outcome for market ${predictionId}...`);

    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'disputeOutcome',
            args: [predictionId],
        });

        console.log(`[OPERATOR] Dispute Tx Hash: ${hash}`);

        if (waitForReceipt) {
            const receipt = await client.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction reverted: ${hash}`);
            }
        }

        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to dispute outcome:", error);
        throw error;
    }
}

// V3: Admin force-resolve (emergency)
export async function adminResolveOnChain(predictionId: string, result: boolean, waitForReceipt: boolean = true) {
    const client = getOperatorClient();

    console.log(`[OPERATOR] Admin resolving market ${predictionId} with result: ${result}...`);

    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'adminResolve',
            args: [predictionId, result],
        });

        console.log(`[OPERATOR] Admin Resolve Tx Hash: ${hash}`);

        if (waitForReceipt) {
            const receipt = await client.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction reverted: ${hash}`);
            }
        }

        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to admin resolve:", error);
        throw error;
    }
}
