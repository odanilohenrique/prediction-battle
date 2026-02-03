# PredictionBattle V7 - Technical Architecture & Security Model

## 1. System Overview
**PredictionBattle** is a decentralized prediction market platform on the Base network (Coinbase L2). 
The core mechanism is a **Parimutuel Betting System** (Pool-based), where users bet against each other rather than against the house.

### Key Characteristics:
- **Zero Insolvency Risk**: Payouts are calculated strictly from the pool of collected funds. The contract cannot pay out more than it holds.
- **Dynamic Odds**: Odds are determined by the ratio of the pools (`TotalYes` vs `TotalNo`) at the moment the market closes.
- **Decentralized Verification**: Outcome verification is handled by a Proposer/Challenger mechanism with economic bonds.

---

## 2. Core Mechanics

### A. Betting (Pool Logic)
Instead of fixed odds (like traditional sportsbooks), we use a share-based system:
1.  User bets `100 USDC` on **YES**.
2.  Protocol deducts fees (House, Creator, Referrer).
3.  Remaining amount enters the `YesPool`.
4.  User receives `Shares` proportional to their contribution weight.
    *   **Weighting**: To incentivize early betting, we use a dynamic weight system (`1.0x` to `1.5x`) based on the pool imbalance ratio.

### B. Solvency Proof (Mathematical Model)
System solvency is guaranteed by the following invariant:
$$ \text{TotalPayout} \leq \text{TotalPool} $$

**Payout Formula:**
$$ \text{Payout} = \frac{\text{UserShares} \times \text{DistributablePool}}{\text{TotalWinningShares}} $$

Where:
- `DistributablePool` = `TotalPool` - `Fees` - `ReporterReward`
- `TotalWinningShares` = Sum of all shares on the winning side.

Since $\sum \text{UserShares} = \text{TotalWinningShares}$, the sum of all payouts equals exactly the `DistributablePool`. The contract never mints money; it only distributes what is locked.

---

## 3. Security Measures (Audit Updates)

### A. MEV / Slippage Protection
We implemented a `minSharesOut` parameter in the `placeBet` function to protect users from front-running attacks (sandwich attacks) where a bot could manipulate the odds just before a user's transaction.
```solidity
require(shares >= _minSharesOut, "Slippage: Odds changed");
```

### B. Time Handling (Base L2)
- **Block-Based Timing**: We use `block.number` logic tailored for **Base Network (OP Stack)**.
- **Dispute Window**: `21600 blocks` (~12 hours at 2s/block). This ensures a sufficient window for dispute resolution despite the fast block times.

### C. Bond Validation
- **Dynamic Bond**: The contract enforces a minimum bond (`getRequiredBond`) of at least 50 USDC or 1% of the total pool, whichever is higher, to prevent spam proposals.

### D. Access Control & Rewards
- **Pull over Push**: All payouts (winnings, bonds, fees) use a "Pull" pattern.
- **Solvency First**: Reporter rewards are deducted from the Market Pool itself, ensuring the Oracle is always paid even if the House Balance is empty.

---

## 4. Lifecycle State Machine
1.  **OPEN**: Users can place bets.
2.  **LOCKED**: Deadline passed. Betting closed. Waiting for proposal.
3.  **PROPOSED**: An outcome (YES/NO) has been proposed by a user (backed by a Bond).
4.  **DISPUTED** (Optional): If challenged within the window, state moves to Dispute.
5.  **RESOLVED**: Final outcome set. Payouts enabled.

---
**Auditor Note:** Please verify `PredictionBattleV7_SECURE_AuditCopy.sol` against these specs.
