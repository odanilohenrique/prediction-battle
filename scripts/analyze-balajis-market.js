
const { ethers } = require("ethers");
require('dotenv').config({ path: '.env.local' });

async function main() {
    const rpcUrl = "https://sepolia.base.org";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const contractAddress = "0xF8623E94364b58246BC6FaBeA10710563d2dB6ae";
    const marketId = "0x93a9dba990a76c556af9881e83668bbfb5817644c55495a864279e3f9e06f07a";

    console.log(`\n=== DEEP LOG EXTRACTION: @balajis vs silviosantos ===`);

    const abi = [
        "function markets(string) view returns (string id, address creator, string question, uint256 creationTime, uint256 bonusDuration, uint256 deadlineTime, uint8 state, uint8 outcome, uint256 seedAmount, bool seedWithdrawn, address proposer, bool proposedResult, uint256 proposalTime, uint256 bondAmount, string evidenceUrl, address challenger, uint256 challengeBondAmount, string challengeEvidenceUrl, uint256 challengeTime, uint256 totalYes, uint256 totalNo, uint256 totalSharesYes, uint256 totalSharesNo, uint256 netDistributable, uint256 referrerPool, uint256 roundId)",
        "event MarketCreated(string indexed id, address indexed creator, uint256 deadlineTime, uint256 seedAmount)",
        "event BetPlaced(string indexed id, address indexed user, bool side, uint256 amount, uint256 shares, address referrer, uint256 weight)",
        "event OutcomeProposed(string indexed id, address indexed proposer, bool result, uint256 bond, uint256 disputeEndTime, string evidence)",
        "event OutcomeChallenged(string indexed id, address indexed challenger, uint256 bond, string evidence)",
        "event MarketResolved(string indexed id, bool result, uint256 winnerPool)",
        "event PayoutClaimed(string indexed id, address indexed user, uint256 amount)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, provider);

    const currentBlock = await provider.getBlockNumber();

    // Scan last 100k blocks in 10k chunks
    let allLogs = [];
    const step = 10000;
    for (let to = currentBlock; to > currentBlock - 100000; to -= step) {
        const from = to - step;
        console.log(`Scanning ${from} to ${to}...`);
        try {
            const logs = await Promise.all([
                contract.queryFilter(contract.filters.MarketCreated(marketId), from, to),
                contract.queryFilter(contract.filters.BetPlaced(marketId), from, to),
                contract.queryFilter(contract.filters.OutcomeProposed(marketId), from, to),
                contract.queryFilter(contract.filters.OutcomeChallenged(marketId), from, to),
                contract.queryFilter(contract.filters.MarketResolved(marketId), from, to),
                contract.queryFilter(contract.filters.PayoutClaimed(marketId), from, to)
            ]);
            allLogs = allLogs.concat(...logs);
        } catch (e) {
            console.warn(`Error in range ${from}-${to}: ${e.message}`);
        }
    }

    allLogs.sort((a, b) => (a.blockNumber - b.blockNumber) || (a.transactionIndex - b.transactionIndex));

    console.log("\n--- 🔎 TRANSACTION HISTORY ---");
    const summary = {
        bets: [],
        claims: [],
        resolution: null,
        referrals: {}
    };

    for (const log of allLogs) {
        const name = log.fragment.name;
        const args = log.args;

        if (name === "MarketCreated") {
            console.log(`[Block ${log.blockNumber}] Market Created by ${args.creator} with $${ethers.formatUnits(args.seedAmount, 6)} Seed.`);
        } else if (name === "BetPlaced") {
            const amt = ethers.formatUnits(args.amount, 6);
            const side = args.side ? "YES" : "NO";
            console.log(`[Block ${log.blockNumber}] Bet Placed: ${args.user} bet $${amt} on ${side}. Ref: ${args.referrer}`);
            summary.bets.push({ user: args.user, side, amt: parseFloat(amt), ref: args.referrer });
            if (args.referrer !== ethers.ZeroAddress) {
                summary.referrals[args.referrer] = (summary.referrals[args.referrer] || 0) + parseFloat(amt) * 0.05;
            }
        } else if (name === "MarketResolved") {
            console.log(`[Block ${log.blockNumber}] Market Resolved as ${args.result ? "YES" : "NO"}.`);
            summary.resolution = args.result;
        } else if (name === "PayoutClaimed") {
            const amt = ethers.formatUnits(args.amount, 6);
            console.log(`[Block ${log.blockNumber}] Payout Claimed: ${args.user} received $${amt}.`);
            summary.claims.push({ user: args.user, amt: parseFloat(amt) });
        }
    }

    console.log("\n--- 📈 PnL SUMMARY ---");
    const userPnL = {};
    summary.bets.forEach(b => {
        const u = b.user.toLowerCase();
        if (!userPnL[u]) userPnL[u] = { invest: 0, win: 0, lost: 0 };
        userPnL[u].invest += b.amt;
        if (summary.resolution === (b.side === "YES")) {
            // This is slightly complex due to weight/shares, but for report:
        } else {
            userPnL[u].lost += b.amt;
        }
    });

    summary.claims.forEach(c => {
        const u = c.user.toLowerCase();
        if (!userPnL[u]) userPnL[u] = { invest: 0, win: 0, lost: 0 };
        userPnL[u].win += c.amt;
    });

    for (const [u, p] of Object.entries(userPnL)) {
        console.log(`User: ${u}`);
        console.log(`  Invested: $${p.invest.toFixed(4)}`);
        console.log(`  Received: $${p.win.toFixed(4)}`);
        console.log(`  PnL:      $${(p.win - p.invest).toFixed(4)}`);
    }

    console.log("\n--- 🔗 REFERRAL DATA ---");
    for (const [ref, amt] of Object.entries(summary.referrals)) {
        console.log(`Referrer: ${ref} | Total Earned: $${amt.toFixed(4)}`);
    }
}

main().catch(console.error);
