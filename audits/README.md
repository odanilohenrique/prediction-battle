# Prediction Battle V8 - Audit Documentation

## 1. System Overview
**Prediction Battle** is a social prediction market platform built on the **Base (L2)** network. It allows users to bet on the outcome of social events, casts, and viral trends.

## 2. Target Contract
*   **File**: `audits/PredictionBattleV8.sol`
*   **Compiler**: Solidity `^0.8.20`
*   **Dependencies**: OpenZeppelin (AccessControl, ReentrancyGuard, Pausable, SafeERC20).

## 3. Key Changes in V8 (Audit Remediation)
This version specifically addresses findings from the previous audit.

### 3.1. Solvency Fix ([C-01])
*   **Change**: Removed the secondary fee deduction in `claimWinnings`.
*   **Logic**: Fees are now ONLY taken at entry (`placeBet`). The `totalPool` tracks the net amount available for distribution. `claimWinnings` simply distributes `totalPool - reporterReward`.

### 3.2. Role Separation ([M-02])
*   **Architecture**: Migrated to `AccessControl`.
*   **DEFAULT_ADMIN_ROLE (Owner)**:
    *   Held by a **Gnosis Safe Multisig** on Mainnet.
    *   Capabilities: `pause`, `unpause`, `setOperator`, `proposeTreasuryChange`, `withdrawHouseFees`.
    *   *Note*: The Admin does NOT resolve disputes in the normal flow.
*   **OPERATOR_ROLE (Operator)**:
    *   Held by a distinct Hot Wallet (or less complex Multisig).
    *   Capabilities: `resolveDispute`, `voidMarket`.
    *   *Rationale*: Allows day-to-day operations without exposing the Admin keys.
    *   *Enforcement*: `setOperator` automatically revokes the old operator's role, ensuring only one active operator exists at a time.

### 3.3. Safety Hatch (Anti-Lock)
*   **New Function**: `emergencyResolve(marketId)`
*   **Logic**: If a market remains in the `DISPUTED` state for more than **30 Days** (indicating both Operator and Admin are inactive/lost), **ANYONE** can call this function.
*   **Effect**: The market is Voided, and all funds (including bonds) are made claimable. This guarantees that user funds cannot be permanently locked due to key loss.

### 3.4. Time Reliability ([M-01])
*   **Change**: All duration checks now use `block.timestamp`.
*   **Dispute Window**: Fixed at `43200` seconds (12 hours).

### 3.5. Anti-Manipulation & Security Hardening (Post-Audit Refinements)
*   **Hardcoded USDC ([C-02])**: The contract now strictly uses the Base Mainnet USDC address (`0x8335...`).
*   **Minimum Bet ([M-03])**: Enforced minimum of **0.05 USDC** to prevent dust/spam attacks.
*   **Sniper Protection ([H-02])**:
    *   **Creator Delay**: Creators cannot propose a result until **24 Hours** after creation.
    *   **Global Cool-down**: No one can propose a result if a bet was placed in the last **30 Minutes**. This prevents "Bet & Close" attacks.

## 4. Critical Design Decisions

### 4.1. Early Resolution
*   **Feature**: `proposeOutcome` is allowed BEFORE the deadline.
*   **Rationale**: To settle markets for live events immediately upon conclusion.

## 5. Security Model
*   **Funds**: Pull-payment pattern for all claims.
*   **DoS Protection**: `maxBetAmount`, `maxMarketPool`.
*   **Emergency**: `pause` functionality stops all new bets and proposals.

## 6. Audit Scope
Please verify:
1.  **Solvency**: Confirm that `placeBet` (net) + `claimWinnings` mathematics are exact and no funds remain trapped.
2.  **Access Control**: Ensure `OPERATOR_ROLE` cannot perform Admin functions (like changing Treasury).
3.  **Safety Hatch**: Verify that `emergencyResolve` cannot be abused before the 30-day window.
