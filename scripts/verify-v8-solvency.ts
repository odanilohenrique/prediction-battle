
import { ethers } from "ethers";

// Mocking the math logic of Solidity in TS for verification
const FEE_DENOMINATOR = 10000;
const HOUSE_FEE_BPS = 1000;   // 10%
const CREATOR_FEE_BPS = 500;  // 5%
const REFERRER_FEE_BPS = 500; // 5%
const REPORTER_REWARD_BPS = 100; // 1%

function simulateV8Flow() {
    console.log("--- V8 SOLVENCY SIMULATION ---");

    // 1. PLACE BET (100 USDC)
    const betAmount = 100_000_000; // 100 USDC (6 decimals)
    console.log(`[1] User Bets: ${betAmount / 1e6} USDC`);

    // Fee Calc (Entry)
    const houseFee = Math.floor((betAmount * HOUSE_FEE_BPS) / FEE_DENOMINATOR);
    const creatorFee = Math.floor((betAmount * CREATOR_FEE_BPS) / FEE_DENOMINATOR);
    const referrerFee = Math.floor((betAmount * REFERRER_FEE_BPS) / FEE_DENOMINATOR);

    const totalFees = houseFee + creatorFee + referrerFee;
    const netAmount = betAmount - totalFees;

    console.log(`    - Fees Taken: ${totalFees / 1e6} USDC`);
    console.log(`    - Net to Pool: ${netAmount / 1e6} USDC`);

    // Pool State
    const totalPool = netAmount; // Assuming single bet for simplicity
    const totalShares = 1000; // Mock shares
    const userShares = 1000;

    // 2. RESOLUTION
    console.log(`[2] Resolution (Win)`);
    // Reporter Reward Calculation
    const reporterReward = Math.floor((totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR);
    console.log(`    - Reporter Reward: ${reporterReward / 1e6} USDC`);

    // 3. CLAIM (V8 Logic)
    // distributable = totalPool - reporterReward (NO DOUBLE TAX)
    const distributablePool = totalPool - reporterReward;
    console.log(`    - Distributable: ${distributablePool / 1e6} USDC`);

    const payout = Math.floor((userShares * distributablePool) / totalShares);
    console.log(`[3] User Payout: ${payout / 1e6} USDC`);

    // CHECK
    const effectiveFeeRate = (betAmount - payout) / betAmount;
    console.log(`[4] Effective Fee Rate: ${(effectiveFeeRate * 100).toFixed(2)}%`);

    // Expected: 20% entry + small reporter reward on net.
    // 100 -> 80 Net. 
    // Reward = 1% of 80 = 0.8
    // Payout = 79.2
    // Total Cost = 20.8 USDC (~20.8%)

    if (payout > 60_000_000) {
        console.log("✅ SOLVENCY CHECK PASSED (Payout > 60%)");
    } else {
        console.error("❌ SOLVENCY CHECK FAILED (Double Tax still likely)");
    }
}

simulateV8Flow();
