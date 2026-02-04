
const { ethers } = require("hardhat");
require('dotenv').config({ path: '.env.local' });

async function main() {
    const rpcUrl = "https://base-sepolia-rpc.publicnode.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    console.log(`Analyzing contract at: ${contractAddress}`);

    const abi = [
        "event MarketCreated(string indexed id, address indexed creator, uint256 deadlineBlock, uint256 bonusDuration)",
        "event BetPlaced(string indexed id, address indexed user, bool side, uint256 amount, uint256 shares, address referrer, uint256 weight)",
        "event OutcomeProposed(string indexed id, address indexed proposer, bool result, uint256 bond, uint256 disputeEndBlock, string evidence)",
        "event OutcomeChallenged(string indexed id, address indexed challenger, uint256 bond, string evidence)",
        "event DisputeResolved(string indexed id, address indexed winner, uint256 totalBondReward, bool finalResult)",
        "event OutcomeFinalized(string indexed id, address indexed proposer, uint256 reward)",
        "event MarketResolved(string indexed id, bool result, uint256 winnerPool)",
        "event PayoutClaimed(string indexed id, address indexed user, uint256 amount)",
    ];

    const contract = new ethers.Contract(contractAddress, abi, provider);

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 20000; // ~11 hours
    console.log(`Scanning last ~11h (Blocks ${fromBlock} to ${currentBlock})...`);

    // 1. Find All Markets Created
    const createdFilter = contract.filters.MarketCreated();
    const createdEvents = await contract.queryFilter(createdFilter, fromBlock);

    if (createdEvents.length === 0) {
        console.log("No markets found in the last 24h.");
        return;
    }

    console.log(`Found ${createdEvents.length} markets created. Checking for activity...`);

    let bestMarket = null;
    let maxActivity = -1;

    for (const event of createdEvents) {
        let marketIdHash = event.topics[1]; // Get Indexed Hash
        // Try to extract plaintext ID if available (usually not for indexed string, but let's check args)
        // Ethers v6: event.args[0]

        const betFilter = contract.filters.BetPlaced(marketIdHash);
        const bets = await contract.queryFilter(betFilter, fromBlock);

        if (bets.length > maxActivity) {
            maxActivity = bets.length;
            bestMarket = { event, bets, hash: marketIdHash };
        }
    }

    if (!bestMarket || maxActivity === 0) {
        console.log("Found markets, but NO betting activity in any of them.");
        return;
    }

    console.log(`\n>>> ANALYZING MOST ACTIVE MARKET (Hash: ${bestMarket.hash}) with ${maxActivity} bets <<<`);

    const marketIdFilterValue = bestMarket.hash;
    const { bets } = bestMarket;

    // Fetch other events for this market
    const proposedFilter = contract.filters.OutcomeProposed(marketIdFilterValue);
    const proposals = await contract.queryFilter(proposedFilter, fromBlock);

    const challengedFilter = contract.filters.OutcomeChallenged(marketIdFilterValue);
    const challenges = await contract.queryFilter(challengedFilter, fromBlock);

    const resolvedFilter = contract.filters.DisputeResolved(marketIdFilterValue);
    const disputesResolved = await contract.queryFilter(resolvedFilter, fromBlock);

    const finalizedFilter = contract.filters.OutcomeFinalized(marketIdFilterValue);
    const finalizations = await contract.queryFilter(finalizedFilter, fromBlock);

    const marketResolvedFilter = contract.filters.MarketResolved(marketIdFilterValue);
    const marketResolutions = await contract.queryFilter(marketResolvedFilter, fromBlock);

    const payoutFilter = contract.filters.PayoutClaimed(marketIdFilterValue);
    const payouts = await contract.queryFilter(payoutFilter, fromBlock);

    // --- REPORT GENERATION ---

    // Creator
    const creator = bestMarket.event.args[1];
    console.log(`Creator (Seed): ${creator}`);

    // Bets
    let totalYes = BigInt(0);
    let totalNo = BigInt(0);
    const userBets = {};

    console.log("\n--- BETS PLACED ---");
    for (const bet of bets) {
        const user = bet.args.user;
        const side = bet.args.side ? "YES" : "NO";
        const amount = bet.args.amount;
        const amountDisplay = ethers.formatUnits(amount, 6);

        console.log(`User: ${user} | Side: ${side} | Amount: $${amountDisplay}`);

        if (bet.args.side) totalYes += amount;
        else totalNo += amount;

        if (!userBets[user]) userBets[user] = { yes: BigInt(0), no: BigInt(0) };
        if (bet.args.side) userBets[user].yes += amount;
        else userBets[user].no += amount;
    }

    console.log(`\nTotal Pool YES: $${ethers.formatUnits(totalYes, 6)}`);
    console.log(`Total Pool NO:  $${ethers.formatUnits(totalNo, 6)}`);

    // Verification
    console.log("\n--- VERIFICATION ---");
    let proposer = null;
    if (proposals.length > 0) {
        const p = proposals[0];
        proposer = p.args.proposer;
        console.log(`Proposed by: ${proposer}`);
        console.log(`Proposed Result: ${p.args.result ? "YES" : "NO"}`);
        console.log(`Bond: $${ethers.formatUnits(p.args.bond, 6)}`);
        console.log(`Evidence: ${p.args.evidence}`);
    } else {
        console.log("No outcome proposed yet.");
    }

    if (challenges.length > 0) {
        const c = challenges[0];
        console.log(`\nChallenged by: ${c.args.challenger}`);
        console.log(`Challenge Bond: $${ethers.formatUnits(c.args.bond, 6)}`);
        console.log(`Evidence: ${c.args.evidence}`);
    }

    // Resolution
    console.log("\n--- RESOLUTION ---");
    let finalResult = null;

    if (marketResolutions.length > 0) {
        const r = marketResolutions[0];
        finalResult = r.args.result;
        console.log(`FINAL RESULT: ${finalResult ? "YES" : "NO"}`);
    } else {
        console.log("Market NOT Resolved yet.");
    }

    if (disputesResolved.length > 0) {
        const d = disputesResolved[0];
        console.log(`Arbitrated by Admin. Winner: ${d.args.winner}`);
        console.log(`Bond Reward: $${ethers.formatUnits(d.args.totalBondReward, 6)}`);
    } else if (finalizations.length > 0) {
        const f = finalizations[0];
        console.log(`Auto-Finalized by: ${f.args.proposer}`);
        console.log(`Reporter Reward: $${ethers.formatUnits(f.args.reward, 6)}`);
    }

    // PnL
    console.log("\n--- PROFIT/LOSS (PnL) ---");
    if (finalResult !== null) {
        const winners = [];
        const losers = [];

        for (const [user, bets] of Object.entries(userBets)) {
            const betAmount = finalResult ? bets.yes : bets.no;
            const lostAmount = finalResult ? bets.no : bets.yes;

            if (betAmount > 0) {
                winners.push({ user, invested: betAmount });
            }
            if (lostAmount > 0) {
                losers.push({ user, lost: lostAmount });
            }
        }

        console.log(`Winning Side (${finalResult ? "YES" : "NO"}) Investors (Detailed Payouts Pending Claim):`);
        winners.forEach(w => console.log(`- ${w.user}: Invested $${ethers.formatUnits(w.invested, 6)}`));

        console.log(`\nLosing Side Investors:`);
        losers.forEach(l => console.log(`- ${l.user}: Lost $${ethers.formatUnits(l.lost, 6)}`));

        console.log("\n--- CLAIMED PAYOUTS ---");
        if (payouts.length === 0) console.log("No payouts claimed yet.");
        for (const p of payouts) {
            console.log(`User: ${p.args.user} | Claimed: $${ethers.formatUnits(p.args.amount, 6)}`);
        }
    } else {
        console.log("Cannot calculate PnL - Market still open/active.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
