
const { ethers } = require("ethers");
require('dotenv').config({ path: '.env.local' });

async function main() {
    const rpcUrl = "https://sepolia.base.org";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const contractAddress = "0xF8623E94364b58246BC6FaBeA10710563d2dB6ae";
    const marketId = "0x93a9dba990a76c556af9881e83668bbfb5817644c55495a864279e3f9e06f07a";

    console.log(`\n=== DEEP DATA ANALYSIS: @balajis vs silviosantos ===`);
    console.log(`Market ID: ${marketId}`);
    console.log(`Contract:  ${contractAddress}`);

    const abi = [
        "function markets(string) view returns (string id, address creator, string question, uint256 creationTime, uint256 bonusDuration, uint256 deadlineTime, uint8 state, uint8 outcome, uint256 seedAmount, bool seedWithdrawn, address proposer, bool proposedResult, uint256 proposalTime, uint256 bondAmount, string evidenceUrl, address challenger, uint256 challengeBondAmount, string challengeEvidenceUrl, uint256 challengeTime, uint256 totalYes, uint256 totalNo, uint256 totalSharesYes, uint256 totalSharesNo, uint256 netDistributable, uint256 referrerPool, uint256 roundId)",
        "function creatorBalance(address) view returns (uint256)",
        "function rewardsBalance(address) view returns (uint256)",
        "function houseBalance() view returns (uint256)",
        "function claimableBonds(address) view returns (uint256)",
        "function hasClaimed(string, uint256, address) view returns (bool)",
        "event MarketCreated(string indexed id, address indexed creator, uint256 deadlineTime, uint256 seedAmount)",
        "event BetPlaced(string indexed id, address indexed user, bool side, uint256 amount, uint256 shares, address referrer, uint256 weight)",
        "event OutcomeProposed(string indexed id, address indexed proposer, bool result, uint256 bond, uint256 disputeEndTime, string evidence)",
        "event OutcomeChallenged(string indexed id, address indexed challenger, uint256 bond, string evidence)",
        "event MarketResolved(string indexed id, bool result, uint256 winnerPool)",
        "event PayoutClaimed(string indexed id, address indexed user, uint256 amount)",
        "event CreatorFeesWithdrawn(address indexed creator, uint256 amount)",
        "event ReferrerFeesWithdrawn(address indexed referrer, uint256 amount)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, provider);

    // 1. Fetch Market Struct
    const m = await contract.markets(marketId);

    console.log("\n--- 📊 MARKET ON-CHAIN STATE ---");
    console.log(`Question: ${m.question}`);
    console.log(`Creator:  ${m.creator}`);
    console.log(`Outcome:  ${m.outcome === 1 ? 'YES' : m.outcome === 2 ? 'NO' : m.outcome === 3 ? 'DRAW' : 'CANCELLED'} (${m.outcome})`);
    console.log(`Seed:     $${ethers.formatUnits(m.seedAmount, 6)} (Withdrawn: ${m.seedWithdrawn})`);
    console.log(`Total YES: $${ethers.formatUnits(m.totalYes, 6)} (${m.totalSharesYes.toString()} shares)`);
    console.log(`Total NO:  $${ethers.formatUnits(m.totalNo, 6)} (${m.totalSharesNo.toString()} shares)`);
    console.log(`Net Dist: $${ethers.formatUnits(m.netDistributable, 6)} (Pool for winners)`);
    console.log(`Ref Pool: $${ethers.formatUnits(m.referrerPool, 6)}`);
    console.log(`Proposer: ${m.proposer} | Bond: $${ethers.formatUnits(m.bondAmount, 6)}`);
    if (m.challenger !== ethers.ZeroAddress) {
        console.log(`Challenger: ${m.challenger} | Bond: $${ethers.formatUnits(m.challengeBondAmount, 6)}`);
    }

    // 2. Fetch Events
    const marketCreatedLogs = await contract.queryFilter(contract.filters.MarketCreated(marketId), 19000000);
    const betLogs = await contract.queryFilter(contract.filters.BetPlaced(marketId), 19000000);
    const proposalLogs = await contract.queryFilter(contract.filters.OutcomeProposed(marketId), 19000000);
    const challengeLogs = await contract.queryFilter(contract.filters.OutcomeChallenged(marketId), 19000000);
    const resolveLogs = await contract.queryFilter(contract.filters.MarketResolved(marketId), 19000000);
    const payoutLogs = await contract.queryFilter(contract.filters.PayoutClaimed(marketId), 19000000);

    console.log("\n--- 🎫 BETS ANALYSIS ---");
    const userBets = {};
    const winners = [];
    const losers = [];
    const isYesWin = m.outcome === 1;

    for (const log of betLogs) {
        const { user, side, amount, shares, referrer, weight } = log.args;
        const sideStr = side ? "YES (Balajis)" : "NO (Silvio)";
        console.log(`Bet: ${user} | Side: ${sideStr} | Amt: $${ethers.formatUnits(amount, 6)} | Shares: ${shares.toString()} | Ref: ${referrer}`);

        if (!userBets[user]) userBets[user] = { yes: BigInt(0), no: BigInt(0), yesShares: BigInt(0), noShares: BigInt(0), referrals: [] };
        if (side) {
            userBets[user].yes += amount;
            userBets[user].yesShares += shares;
        } else {
            userBets[user].no += amount;
            userBets[user].noShares += shares;
        }

        if (referrer !== ethers.ZeroAddress) {
            const refAddr = referrer.toLowerCase();
            if (!userBets[refAddr]) userBets[refAddr] = { yes: BigInt(0), no: BigInt(0), yesShares: BigInt(0), noShares: BigInt(0), referrals: [] };
            userBets[refAddr].referrals.push({ user, amount });
        }
    }

    console.log("\n--- ⚖️ VERIFICATION & DISPUTE ---");
    if (proposalLogs.length > 0) {
        const p = proposalLogs[0].args;
        console.log(`Proposed by: ${p.proposer}`);
        console.log(`Result:      ${p.result ? "YES" : "NO"}`);
        console.log(`Bond:        $${ethers.formatUnits(p.bond, 6)}`);
    }
    if (challengeLogs.length > 0) {
        const c = challengeLogs[0].args;
        console.log(`Challenged by: ${c.challenger}`);
        console.log(`Bond:          $${ethers.formatUnits(c.bond, 6)}`);
    }
    if (resolveLogs.length > 0) {
        const r = resolveLogs[0].args;
        console.log(`Market Resolved: ${r.result ? "YES" : "NO"}`);
    }

    console.log("\n--- 💸 PAYOUTS & BALANCES ---");
    const totalSharesWin = isYesWin ? m.totalSharesYes : m.totalSharesNo;

    for (const [user, data] of Object.entries(userBets)) {
        const winShares = isYesWin ? data.yesShares : data.noShares;
        const invested = data.yes + data.no;

        let payout = BigInt(0);
        if (winShares > 0 && totalSharesWin > 0) {
            // Check if user is the LAST winner to clear dust (contract logic refinement)
            // For simplicity in analysis, we use the proportional math.
            payout = (winShares * m.netDistributable) / totalSharesWin;
        }

        const hasClaimed = await contract.hasClaimed(marketId, m.roundId, user);

        if (invested > 0 || winShares > 0) {
            console.log(`User: ${user}`);
            console.log(`  Invested: $${ethers.formatUnits(invested, 6)}`);
            if (winShares > 0) {
                console.log(`  Expected Payout: $${ethers.formatUnits(payout, 6)} (Shares: ${winShares.toString()})`);
                console.log(`  Status: ${hasClaimed ? "✅ CLAIMED" : "⌛ PENDING CLAIM"}`);
            } else if (invested > 0) {
                console.log(`  Status: 💀 LOST`);
            }
        }
    }

    // Fees
    console.log("\n--- 🏦 FEES & SYSTEM REWARDS ---");
    const totalPool = m.totalYes + m.totalNo;
    const houseFee = (totalPool * 1000n) / 10000n; // 10%
    const creatorFee = (totalPool * 500n) / 10000n; // 5%
    const refPoolTotal = (totalPool * 500n) / 10000n; // 5%
    const repFee = (totalPool * 100n) / 10000n; // 1%

    console.log(`House Fee (10%):    $${ethers.formatUnits(houseFee, 6)}`);
    console.log(`Creator Fee (5%):   $${ethers.formatUnits(creatorFee, 6)} (Creator: ${m.creator})`);
    console.log(`Referrer Pool (5%): $${ethers.formatUnits(refPoolTotal, 6)}`);
    console.log(`Reporter Fee (1%):  $${ethers.formatUnits(repFee, 6)} (Proposer: ${m.proposer})`);

    // Reporter/Referrer specific balances
    const proposerBalance = await contract.rewardsBalance(m.proposer);
    console.log(`\nProposer Current Rewards Balance: $${ethers.formatUnits(proposerBalance, 6)}`);

    console.log("\n=== END OF REPORT ===");
}

main().catch(console.error);
