# Prediction Battle V9 - Audit Context & System Overview

## 1. Introduction
**Prediction Battle** is a decentralized prediction market running on the **Base** blockchain (Coinbase L2). It allows users to bet on binary outcomes (YES/NO) of future events (e.g., "Will ETH hit $3k this week?").

The system uses a **Parimutuel** betting model, meaning users are not betting against the house, but against each other. The losers' funds are distributed proportionally among the winners.

## 2. Core Architecture: Parimutuel Betting
Unlike fixed-odds bookmakers, the odds in Prediction Battle are dynamic and determined by the ratio of funds in the pool.
- **Total Pool** = Total YES Bets + Total NO Bets.
- **Payout** = If YES wins, YES bettors split the ENTIRE pool (minus fees) based on their share of the YES side.

### 2.1. Recoverable Seed (V9 Feature)
To solve the "cold start" problem (empty pools have infinite odds), Market Creators must provide a **Seed Liquidity** (e.g., 10 USDC).
- **Crucial Distinction**: In V9, this seed is **NOT** donation. It is stored separately (`seedAmount`) and is **returned 100% to the Creator** after the market resolves, regardless of the outcome.
- It serves only to show "skin in the game" and prevent spam. It does *not* dilute user winnings.

### 2.2. Early Bird Mechanism
To incentivize early liquidity, the protocol awards **Weighted Shares**:
- **Standard Weight**: 1.0x shares per USDC.
- **Early Bird Weight**: 1.2x shares per USDC (for bets placed in the first X hours).
- This means early bettors get a slightly larger claim on the final pot than late bettors for the same dollar amount.

## 3. Market Lifecycle

1.  **Creation (`createMarket`)**:
    - Creator defines the Question, Deadline, and deposits Seed (USDC).
    - Market State: `OPEN`.

2.  **Betting (`placeBet`)**:
    - Users bet USDC on YES or NO.
    - Funds are locked in the contract.
    - Betting closes when the Deadline is reached.
    - Market State: `LOCKED` (implicitly, by time).

3.  **Resolution Proposal (`proposeOutcome`)**:
    - After the deadline + cool-down period, anyone can propose a result (YES/NO).
    - Proposer posts a **Bond** (Minimum 5 USDC + 1% of Pool).
    - Market State: `PROPOSED`.
    - A 12-hour **Dispute Window** begins.

4.  **Dispute (Optional) (`challengeOutcome`)**:
    - If the proposal is wrong, anyone can challenge it within the window.
    - Challenger posts a matching **Bond**.
    - Market State: `DISPUTED`.
    - An Admin/Operator manually resolves the dispute (`resolveDispute`). The winner gets both bonds.

5.  **Finalization (`finalizeOutcome`)**:
    - If no dispute occurs within 12 hours, the Proposed Result becomes official.
    - The Proposer gets their Bond back + a Reward (1% of the Pool).
    - Market State: `RESOLVED`.

## 4. Economic Model & Fees (21% Total)
Fees are taken *only* from the Winnings (the total pot) before distribution.
- **House Fee**: 10% (Protocol Revenue)
- **Creator Fee**: 5% (Incentive for market creation)
- **Referrer Fee**: 5% (Incentive for sharing)
- **Reporter Reward**: 1% (Incentive for correct resolution)
- **User Payout**: ~79% of the Total Pool goes to winners.

*Note: In case of a DRAW (Technical Tie), fees are still taken, and the remaining ~79% is refunded proportionally to all users.*

## 5. Technical Stack
- **Contract Language**: Solidity ^0.8.20
- **Token**: USDC (Standard ERC-20)
- **Chain**: Base Sepolia (Testnet) / Base Mainnet
- **Key Libraries**: OpenZeppelin (ERC20, ReentrancyGuard, AccessControl, Pausable)

## 6. Known Changes in V9 (vs V8)
- **Insolvency Fix**: The `DRAW` fee calculation was corrected to ensure the contract doesn't pay out >100%.
- **No EnumerableSet**: Removed for gas optimization. The contract no longer tracks the list of specific user addresses; indexers (The Graph) must handle this.
- **Flexible Deploy**: USDC address is now passed in the constructor.
- **Reduced Bonus**: Early Bird weight reduced from 1.5x to 1.2x.
