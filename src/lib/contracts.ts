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

// V5: MarketState enum
export enum MarketState {
    OPEN = 0,
    LOCKED = 1,
    PROPOSED = 2,
    DISPUTED = 3,
    RESOLVED = 4
}

// Check if prediction is resolved on-chain
export async function isPredictionResolved(predictionId: string): Promise<boolean> {
    const client = getOperatorClient();
    try {
        const data = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'markets',
            args: [predictionId],
        }) as any[];

        // V5 Index 6 is 'state'
        const stateVal = data[6];
        if (typeof stateVal === 'number' || typeof stateVal === 'bigint') {
            return Number(stateVal) === MarketState.RESOLVED;
        }

        return false;
    } catch (error) {
        console.error("Failed to check market status:", error);
        return false;
    }
}

// V5: Get market state
export async function getMarketState(predictionId: string): Promise<MarketState> {
    const client = getOperatorClient();
    try {
        const data = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'markets',
            args: [predictionId],
        }) as any[];

        // Handle both number and bigint return types from Viem
        const stateVal = data[6];
        if (typeof stateVal === 'number' || typeof stateVal === 'bigint') {
            return Number(stateVal) as MarketState;
        }

        return MarketState.OPEN;
    } catch (error) {
        console.error("Failed to get market state:", error);
        return MarketState.OPEN;
    }
}

// V5: Get Full Market Data
export async function getOnChainMarketData(predictionId: string) {
    const client = getOperatorClient();
    try {
        const data = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'markets',
            args: [predictionId],
        }) as any[];

        if (!Array.isArray(data)) return null;

        return {
            state: Number(data[6]),
            result: Boolean(data[7]),
            isVoid: Boolean(data[8]),
            deadline: Number(data[5]),
            totalYes: BigInt(data[18] || 0),
            totalNo: BigInt(data[19] || 0)
        };
    } catch (error) {
        console.error("Failed to get market data:", error);
        return null;
    }
}

// V5: Get required bond amount
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

// V5: Get reporter reward (approx 1% of pool)
export async function getReporterReward(predictionId: string): Promise<bigint> {
    const client = getOperatorClient();
    try {
        // We can just calculate it from pool info if needed, or return 0 for now as it's not critical
        // OR read market info and calc 1% of totalYes + totalNo
        const data = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'markets',
            args: [predictionId],
        }) as any[];

        if (Array.isArray(data)) {
            const totalYes = BigInt(data[18] || 0);
            const totalNo = BigInt(data[19] || 0);
            return (totalYes + totalNo) / BigInt(100);
        }
        return BigInt(0);
    } catch (error) {
        console.error("Failed to get reporter reward:", error);
        return BigInt(0);
    }
}

// V5: Get proposal info (Extended)
export async function getProposalInfo(predictionId: string) {
    const client = getOperatorClient();
    try {
        const data = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'markets',
            args: [predictionId],
        }) as any[];

        // Indices:
        // 9: proposer
        // 10: proposedResult
        // 11: proposalTime
        // 12: bondAmount
        // 13: evidenceUrl
        // 14: challenger
        // 15: challengeBondAmount
        // 16: challengeEvidenceUrl
        // 17: challengeTime

        const proposalTime = BigInt(data[11]);
        const disputeWindow = BigInt(43200); // V6: 12 hours
        const deadline = proposalTime + disputeWindow;
        const now = BigInt(Math.floor(Date.now() / 1000));

        return {
            proposer: data[9] as string,
            proposedResult: data[10] as boolean,
            proposalTime: proposalTime,
            bondAmount: BigInt(data[12]),
            disputeDeadline: deadline,
            canFinalize: now > deadline,
            evidenceUrl: data[13] as string,
            // New V5 fields
            challenger: data[14] as string,
            challengeBondAmount: BigInt(data[15]),
            challengeEvidenceUrl: data[16] as string,
            challengeTime: BigInt(data[17])
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
            functionName: 'adminResolve',
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
    // V6 Note: Users must call claimWinnings themselves.
    console.warn(`[OPERATOR] distributeWinnings is DEPRECATED. Users call claimWinnings().`);
    return '0x0' as `0x${string}`;
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

// ============ V6: Pull Payment Functions ============

// V6: User claims their payout (called from frontend)
// Note: This is typically called directly from the component using writeContractAsync.
// This wrapper exists for backend/operator usage if needed.
export async function claimWinningsOnChain(predictionId: string, waitForReceipt: boolean = true) {
    const client = getOperatorClient();
    console.log(`[OPERATOR] Claiming winnings for market ${predictionId}...`);
    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'claimWinnings',
            args: [predictionId],
        });
        console.log(`[OPERATOR] Claim Tx Hash: ${hash}`);
        if (waitForReceipt) {
            const receipt = await client.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
        }
        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to claim winnings:", error);
        throw error;
    }
}

// V6: Creator withdraws fees
export async function withdrawCreatorFeesOnChain(waitForReceipt: boolean = true) {
    const client = getOperatorClient();
    console.log(`[OPERATOR] Withdrawing creator fees...`);
    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'withdrawCreatorFees',
            args: [],
        });
        console.log(`[OPERATOR] Withdraw Fees Tx Hash: ${hash}`);
        if (waitForReceipt) {
            const receipt = await client.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
        }
        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to withdraw creator fees:", error);
        throw error;
    }
}

// V6: Creator withdraws seed on void market
export async function withdrawSeedOnChain(predictionId: string, waitForReceipt: boolean = true) {
    const client = getOperatorClient();
    console.log(`[OPERATOR] Withdrawing seed for voided market ${predictionId}...`);
    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'withdrawSeed',
            args: [predictionId],
        });
        console.log(`[OPERATOR] Withdraw Seed Tx Hash: ${hash}`);
        if (waitForReceipt) {
            const receipt = await client.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
        }
        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to withdraw seed:", error);
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
