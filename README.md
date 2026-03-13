<p align="center">
  <img src="public/icon.png" width="80" height="80" alt="Prediction Battle" />
</p>

<h1 align="center">Prediction Battle</h1>

<p align="center">
  <strong>A fully on-chain prediction market protocol built on Base.</strong><br/>
  Bet USDC on real-world outcomes. Winners take from losers. No intermediaries. No house edge.
</p>

<p align="center">
  <a href="https://sepolia.basescan.org/address/0x8ce4f5A398D6D80F8387687bEae494Cd8fA2A1E9#code">Verified Contract</a> ·
  <a href="https://prediction-battle.vercel.app">Live Testnet</a>
</p>

---

## What Is This

Prediction Battle is a **production-ready decentralized prediction market DApp** where users stake USDC on binary outcomes (Side A vs Side B). Think Polymarket, but open-source, social-first, and running entirely on Base L2.

Every dollar flows through smart contract logic. The protocol takes a 21% fee on profits only (never on the original stake), split between the treasury, market creator, referrer, and the person who reports the result. Users get their full stake back if they lose nothing.

The smart contract is live, verified on Basescan, and handles everything: escrow, resolution disputes, slashing, fee distribution, and payouts.

## Why This Project Has Value

This is not a wireframe or a concept. This is a **complete, deployable product**:

- **Smart Contract (PredictionBattle v1.0):** 1,200+ lines of battle-tested Solidity. Reentrancy guards, role-based access control, treasury timelocks, MEV protection, circuit breakers. Verified on Basescan.

- **Frontend:** Next.js 14 + React + TypeScript + Tailwind. Premium dark UI with glassmorphism, micro-animations, and full mobile responsiveness. Not a template. Built from scratch.

- **Decentralized Resolution:** No oracle dependency. Uses an optimistic bond-backed verification system. Proposers stake USDC, challengers can dispute within 12 hours, admin arbitrates only when needed. Honest reporters earn 1% of the market profit.

- **Documentation:** Full Docs page, Technical Whitepaper (v2.0), and Roadmap are built into the app itself. Ready for users on day one.

- **Referral System:** Built into the contract. 5% of profits go to whoever referred the winning bettor. Growth mechanic baked into the protocol.

- **Early Bird Bonus:** Bets placed during the bonus window get 1.2x shares. Rewards early participants and creates urgency.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | Base (Coinbase L2) |
| **Smart Contract** | Solidity, Hardhat, OpenZeppelin |
| **Frontend** | Next.js 14, React 18, TypeScript |
| **Styling** | Tailwind CSS, Framer Motion |
| **Wallet** | Wagmi, Viem, Coinbase OnchainKit |
| **Auth** | Farcaster (FarcasterProvider) |
| **Storage** | Vercel KV (Redis) |
| **Hosting** | Vercel (deployed and configured) |
| **Currency** | USDC (ERC-20) |

## What the Buyer Gets

Everything you need to launch a prediction market platform:

```
Smart Contract
├── PredictionBattleV10.sol (verified, deployed)
├── Deploy scripts (Hardhat)
├── Full ABI + type-safe hooks
└── Testnet USDC integration

Frontend
├── 15+ React components
├── Admin dashboard (create/resolve/slash)
├── User dashboard (bet/claim/earn)
├── Docs, Whitepaper, Roadmap pages
├── Mobile-first responsive design
└── Wallet connection (Coinbase, MetaMask, etc.)

Infrastructure
├── Vercel project (configured)
├── Environment variables template
├── GitHub repository
└── Deployment documentation
```

## Revenue Model (Built Into the Contract)

| Fee | Rate | Goes To |
|-----|------|---------|
| Protocol Treasury | 10% | Platform owner (you) |
| Market Creator | 5% | Whoever created the market |
| Referrer | 5% | Whoever referred the winning bettor |
| Result Reporter | 1% | Whoever correctly reported the outcome |
| **Total** | **21%** | **On profits only. Stakes are never touched.** |

At just $10,000 in total betting volume, the treasury earns $1,000 automatically. At $100,000, that's $10,000. The contract handles all of this without any backend or manual work.

## Key Differentiators

**vs Polymarket:** Fully open-source, no centralized resolution, social-first market design, runs on Base (cheaper), creator rewards built in.

**vs Azuro/Overtime:** No oracle dependency. Resolution is community-driven with economic incentives. Works for subjective social events, not just sports.

**vs Building From Scratch:** 3-6 months of development time saved. Contract is audited through extensive testing, frontend is polished, documentation is complete.

## Security Highlights

- Non-custodial (all funds in the smart contract, never in a wallet)
- ReentrancyGuard on all state-changing functions
- Role-based access control (Admin + Operator roles)
- Treasury address changes require a 2-day timelock
- Global solvency tracking (`totalLockedAmount`)
- Max bet (100K USDC) and max pool (1M USDC) circuit breakers
- MEV protection: 5-minute cooldown between betting and proposing
- Pausable in emergencies
- Source code verified on Basescan

## Current Status

| Item | Status |
|------|--------|
| Smart Contract | ✅ Deployed + Verified (Base Sepolia) |
| Frontend | ✅ Live on Vercel |
| Wallet Integration | ✅ Coinbase, MetaMask, WalletConnect |
| Market Creation | ✅ Fully functional |
| Betting | ✅ Fully functional |
| Resolution System | ✅ Bond-backed verification |
| Fee Distribution | ✅ Automatic |
| Admin Dashboard | ✅ Complete |
| Documentation | ✅ Docs + Whitepaper + Roadmap |
| Mainnet Deploy | 🔜 One command away |

## Quick Start (For the New Owner)

```bash
# Clone and install
git clone https://github.com/odanilohenrique/prediction-battle.git
cd prediction-battle
npm install

# Configure environment
cp .env.local.example .env.local
# Fill in your wallet addresses and API keys

# Run locally
npm run dev

# Deploy to mainnet (when ready)
npx hardhat run scripts/deploy-mainnet.ts --network base
```

## What's Next (Roadmap for the Buyer)

The hard part is done. Here's where to take it:

1. **Deploy to Base Mainnet** (30 minutes of work)
2. **Launch on Farcaster** as a Miniapp for instant distribution
3. **Add a Leaderboard** to drive competition and retention
4. **PvP Tournaments** for direct player-vs-player battles
5. **X (Twitter) Integration** to expand beyond Farcaster
6. **Governance Token ($BATTLE)** for protocol fee sharing

## License

MIT

---

<p align="center">
  <strong>Ready to own a prediction market protocol?</strong><br/>
  DM on <a href="https://warpcast.com">Farcaster</a> or open an issue on this repo.
</p>
