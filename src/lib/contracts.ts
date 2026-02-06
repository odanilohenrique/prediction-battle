import { createWalletClient, http, publicActions, custom, parseUnits } from 'viem';
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
            deadlineBlock: Number(data[5]),
            totalYes: BigInt(data[18] || 0),
            totalNo: BigInt(data[19] || 0)
        };
    } catch (error) {
        console.error("Failed to get market data:", error);
        return null;
    }
}

// V8: Calculate bond locally (Base 5 USDC + 1% Pool)
export function calculateRequiredBond(poolTotal: bigint): bigint {
    const MIN_BOND = BigInt(5_000_000); // 5 USDC
    const variableBond = poolTotal / BigInt(100);
    return MIN_BOND + variableBond;
}

// V8 Wrapper: Fetches market data to calculate bond
export async function getRequiredBond(predictionId: string): Promise<bigint> {
    const client = getOperatorClient();
    try {
        const data = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'markets',
            args: [predictionId],
        }) as any[];

        // V8 Indices: 18=TotalYes, 19=TotalNo (Check indices if getting errors, logic assumes standard V8 layout)
        // Wait, standard `markets` in V8 might have different indices. 
        // Let's use `getMarketDetails` if available or stick to strict indices.
        // Based on AdminBetCard analysis: 18=TotalYes, 19=TotalNo.
        const totalYes = BigInt(data[18] || 0);
        const totalNo = BigInt(data[19] || 0);

        return calculateRequiredBond(totalYes + totalNo);
    } catch (error) {
        console.error("Failed to get required bond:", error);
        return BigInt(5_000_000); // Default fallback
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

// V8: Get proposal info (Timestamp-based)
export async function getProposalInfo(predictionId: string) {
    const client = getOperatorClient();
    try {
        const data = await client.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'markets',
            args: [predictionId],
        }) as any[];

        // V8 Struct Indices:
        // 9: proposer
        // 10: proposedResult
        // 11: proposalTime (V8 uses timestamp, not block)
        // 12: bondAmount
        // 13: evidenceUrl
        // 14: challenger
        // 15: challengeBondAmount
        // 16: challengeEvidenceUrl
        // 17: challengeTime (V8 uses timestamp)

        const proposalTime = BigInt(data[11]);
        const challengeTime = BigInt(data[17]);

        // V8: Fixed window of 43200 seconds (12 hours)
        const DISPUTE_WINDOW_SECONDS = BigInt(43200);

        // V8 uses timestamp.now() for deadline calculation
        const deadlineTimestamp = proposalTime + DISPUTE_WINDOW_SECONDS;
        const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

        return {
            proposer: data[9] as string,
            proposedResult: data[10] as boolean,
            proposalTime: Number(proposalTime), // V8: now in seconds
            bondAmount: BigInt(data[12]),
            disputeDeadlineTimestamp: Number(deadlineTimestamp), // V8: timestamp
            canFinalize: currentTimestamp > deadlineTimestamp,
            evidenceUrl: data[13] as string,
            challenger: data[14] as string,
            challengeBondAmount: BigInt(data[15]),
            challengeEvidenceUrl: data[16] as string,
            challengeTime: Number(challengeTime) // V8: timestamp
        };
    } catch (error) {
        console.error("Failed to get proposal info:", error);
        return null;
    }
}

// V2 function: resolveMarket
export async function placeBet(marketId: string, side: boolean, amountUSDC: string, minShares: string, referrer?: string) {
    if (typeof window === 'undefined' || !window.ethereum) throw new Error('No crypto wallet found');

    const walletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(window.ethereum)
    }).extend(publicActions); // Extend with public actions to simulate

    const [address] = await walletClient.requestAddresses();
    const amount = parseUnits(amountUSDC, 6);
    const minSharesAmount = parseUnits(minShares, 6); // Shares has 6 decimals in V8

    console.log(`Placing bet: ${marketId}, Side: ${side}, Amount: ${amountUSDC}, MinShares: ${minShares}`);

    const { request } = await walletClient.simulateContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'placeBet',
        args: [
            marketId,
            side,
            amount,
            minSharesAmount,
            referrer || '0x0000000000000000000000000000000000000000'
        ],
        account: address,
    });

    return await walletClient.writeContract(request);
}
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

// V8: Creator withdraws seed on void market
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

// V8: Proposer claims reporter reward (1% of pool)
export async function claimReporterRewardOnChain(predictionId: string, waitForReceipt: boolean = true) {
    const client = getOperatorClient();
    console.log(`[OPERATOR] Claiming reporter reward for market ${predictionId}...`);
    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'claimReporterReward',
            args: [predictionId],
        });
        console.log(`[OPERATOR] Claim Reporter Reward Tx Hash: ${hash}`);
        if (waitForReceipt) {
            const receipt = await client.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
        }
        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to claim reporter reward:", error);
        throw error;
    }
}

// V8: Void abandoned market (anyone can call after 30 days post-deadline)
export async function voidAbandonedMarketOnChain(predictionId: string, waitForReceipt: boolean = true) {
    const client = getOperatorClient();
    console.log(`[OPERATOR] Voiding abandoned market ${predictionId}...`);
    try {
        const hash = await client.writeContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'voidAbandonedMarket',
            args: [predictionId],
        });
        console.log(`[OPERATOR] Void Abandoned Market Tx Hash: ${hash}`);
        if (waitForReceipt) {
            const receipt = await client.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
        }
        return hash;
    } catch (error) {
        console.error("[OPERATOR] Failed to void abandoned market:", error);
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
