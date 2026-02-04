
const { ethers } = require("hardhat");
require('dotenv').config({ path: '.env.local' });

async function main() {
    // using public RPC to be safe
    const rpcUrl = "https://base-sepolia-rpc.publicnode.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

    // Confirmed Market Hash from Debug Step
    const targetMarketHash = "0x1bc69409015049260ce3f26d66f8c8ba4392b62d2bd841acbb8973b477c4a04f";

    console.log(`Analyzing Targeted Market: ${targetMarketHash}`);

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
    const fromBlock = currentBlock - 20000;

    // Helper to get events using raw topics
    const getEvents = async (eventName) => {
        const fragment = contract.interface.getEvent(eventName);
        const topic0 = fragment.topicHash;
        const filter = {
            address: contractAddress,
            topics: [topic0, targetMarketHash], // Raw filtering by hash
            fromBlock,
            toBlock: 'latest'
        };
        const logs = await provider.getLogs(filter);
        return logs.map(log => {
            // Attach tx hash manually
            const parsed = contract.interface.parseLog(log);
            parsed.transactionHash = log.transactionHash;
            return parsed;
        });
    };

    const bets = await getEvents("BetPlaced");
    const proposals = await getEvents("OutcomeProposed");
    const challenges = await getEvents("OutcomeChallenged");
    const disputesResolved = await getEvents("DisputeResolved");
    const finalizations = await getEvents("OutcomeFinalized");
    const marketResolutions = await getEvents("MarketResolved");
    const payouts = await getEvents("PayoutClaimed");

    // Created event
    const createdFragment = contract.interface.getEvent("MarketCreated");
    const createdFilter = {
        address: contractAddress,
        topics: [createdFragment.topicHash, targetMarketHash],
        fromBlock,
        toBlock: 'latest'
    };
    const createdLogs = await provider.getLogs(createdFilter);
    const creationEvent = createdLogs.length > 0 ? contract.interface.parseLog(createdLogs[0]) : null;
    if (creationEvent) creationEvent.transactionHash = createdLogs[0].transactionHash;


    // --- REPORT ---
    console.log("\n============================================");
    console.log("       PREDICTION BATTLE - ON-CHAIN REPORT");
    console.log("============================================");

    if (creationEvent) {
        console.log(`\n📌 MARKET CREATION`);
        console.log(`- Creator (Seeder): ${creationEvent.args[1]}`);
        console.log(`- Transaction: ${creationEvent.transactionHash}`);
    }

    console.log(`\n💰 BETS PLACED`);
    let totalYes = BigInt(0);
    let totalNo = BigInt(0);
    const users = {};

    for (const bet of bets) {
        const user = bet.args.user;
        const side = bet.args.side ? "YES" : "NO";
        const rawAmount = bet.args.amount;
        const amount = ethers.formatUnits(rawAmount, 6);
        const txHash = bet.transactionHash;

        console.log(`- ${user} bet ${amount} USDC on ${side} (Tx: ${txHash})`);

        if (bet.args.side) totalYes += rawAmount;
        else totalNo += rawAmount;

        if (!users[user]) users[user] = { yes: BigInt(0), no: BigInt(0) };
        if (bet.args.side) users[user].yes += rawAmount;
        else users[user].no += rawAmount;
    }

    const totalPool = totalYes + totalNo;
    console.log(`\n📊 POOL TOTALS`);
    console.log(`- YES Pool: ${ethers.formatUnits(totalYes, 6)} USDC`);
    console.log(`- NO Pool:  ${ethers.formatUnits(totalNo, 6)} USDC`);
    console.log(`- TOTAL:    ${ethers.formatUnits(totalPool, 6)} USDC`);

    console.log(`\n⚖️ VERIFICATION`);
    if (proposals.length > 0) {
        proposals.forEach(p => {
            console.log(`- Proposed by: ${p.args.proposer}`);
            console.log(`- Outcome: ${p.args.result ? "YES" : "NO"}`);
            console.log(`- Bond: ${ethers.formatUnits(p.args.bond, 6)} USDC`);
            console.log(`- Tx: ${p.transactionHash}`);
        });
    } else {
        console.log("- No proposal yet.");
    }

    if (challenges.length > 0) {
        challenges.forEach(c => {
            console.log(`\n🚩 DISPUTE/CHALLENGE`);
            console.log(`- Challenger: ${c.args.challenger}`);
            console.log(`- Bond: ${ethers.formatUnits(c.args.bond, 6)} USDC`);
            console.log(`- Tx: ${c.transactionHash}`);
        });
    }

    console.log(`\n🏁 RESOLUTION`);
    let finalResult = null;
    if (marketResolutions.length > 0) {
        finalResult = marketResolutions[0].args.result;
        console.log(`- FINAL OUTCOME: ${finalResult ? "YES" : "NO"}`);
    } else {
        console.log("- Market Pending Resolution");
    }

    if (disputesResolved.length > 0) {
        console.log(`- Action: Admin Resolution (Arbitration)`);
        console.log(`- Winner: ${disputesResolved[0].args.winner}`);
        console.log(`- Reward: ${ethers.formatUnits(disputesResolved[0].args.totalBondReward, 6)} USDC`);
    } else if (finalizations.length > 0) {
        console.log(`- Action: Standard Finalization`);
    }

    console.log(`\n💸 PAYOUTS & PnL`);
    if (finalResult !== null) {
        console.log(`(Note: Approximate PnL based on outcomes)`);

        Object.entries(users).forEach(([user, stats]) => {
            const investedWinningSide = finalResult ? stats.yes : stats.no;
            const investedLosingSide = finalResult ? stats.no : stats.yes;

            if (investedWinningSide > BigInt(0)) {
                console.log(`\n🟢 WINNER: ${user}`);
                console.log(`   - Invested: ${ethers.formatUnits(investedWinningSide, 6)} USDC`);

                const claimed = payouts.filter(p => p.args.user === user).reduce((acc, p) => acc + p.args.amount, BigInt(0));

                if (claimed > BigInt(0)) {
                    console.log(`   - CLAIMED: ${ethers.formatUnits(claimed, 6)} USDC`);
                    const profit = claimed - investedWinningSide;
                    console.log(`   - NET PROFIT: ~${ethers.formatUnits(profit, 6)} USDC`);
                } else {
                    console.log(`   - Status: Unclaimed`);
                }
            }

            if (investedLosingSide > BigInt(0)) {
                console.log(`\n🔴 LOSER: ${user}`);
                console.log(`   - Lost: ${ethers.formatUnits(investedLosingSide, 6)} USDC`);
            }
        });
    } else {
        console.log("Market not resolved, no PnL yet.");
    }
    console.log("\n============================================");

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
