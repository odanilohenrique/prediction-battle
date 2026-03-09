const { createPublicClient, http, parseAbi } = require('viem');
const { baseSepolia } = require('viem/chains');

const CONTRACT_ADDRESS = '0xF8623E94364b58246BC6FaBeA10710563d2dB6ae';
const USDC_DECIMALS = 6;

const abi = parseAbi([
    'function markets(string) view returns (string id, address creator, string question, uint256 creationTime, uint256 bonusDuration, uint256 deadlineTime, uint8 state, uint8 outcome, uint256 seedAmount, bool seedWithdrawn, address proposer, bool proposedResult, uint256 proposalTime, uint256 bondAmount, string evidenceUrl, address challenger, uint256 challengeBondAmount, string challengeEvidenceUrl, uint256 challengeTime, uint256 totalYes, uint256 totalNo, uint256 totalSharesYes, uint256 totalSharesNo, uint256 netDistributable, uint256 referrerPool, uint256 roundId)',
    'event MarketCreated(string indexed id, address indexed creator, uint256 deadlineTime, uint256 seedAmount)',
    'event BetPlaced(string indexed id, address indexed user, bool side, uint256 amount, uint256 shares, address referrer, uint256 weight)',
    'event PayoutClaimed(string indexed id, address indexed user, uint256 amount)'
]);

const client = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });

async function getLogsInChunks(event, fromBlock, toBlock) {
    let allLogs = [];
    let currentFrom = fromBlock;
    const CHUNK = 9999n;
    while (currentFrom <= toBlock) {
        let currentTo = currentFrom + CHUNK;
        if (currentTo > toBlock) currentTo = toBlock;
        const logs = await client.getLogs({ address: CONTRACT_ADDRESS, event, fromBlock: currentFrom, toBlock: currentTo });
        allLogs = allLogs.concat(logs);
        currentFrom = currentTo + 1n;
    }
    return allLogs;
}

async function runSpecific() {
    const ids = [
        '0xb3e3d2a8853d41e93462e2694c1c08c54b57cbffaf5abbae8b4521a42e6632d4', // testando slash no criador por ambiguidade
        '0xfca66dc1f23f01e50e929832b998d40286dda068574dcbbf3650708054806fd2', // testando empate do mercado
        '0x67bfe6bae241f68046ff4a5071379a09743420dbdb387379826a2a2ee7a6c5ed', // testando mercados cancelados
        '0x2b7887df0bd9a77358de73a6ed15af715dc93eaeeab2415a29bc041a9fdc21cf'  // testanto verificador com chalenger vencedor
    ];

    const latestBlock = await client.getBlockNumber();
    const resolvedMarkets = [];

    for (const id of ids) {
        const m = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi,
            functionName: 'markets',
            args: [id]
        });
        resolvedMarkets.push({ id, data: m });
    }

    for (const res of resolvedMarkets) {
        const [id, creator, question, creationTime, bonusDuration, deadlineTime, state, outcome, seedAmount, seedWithdrawn, proposer, proposedResult, proposalTime, bondAmount, evidenceUrl, challenger, challengeBondAmount, challengeEvidenceUrl, challengeTime, totalYes, totalNo, totalSharesYes, totalSharesNo, netDistributable, referrerPool, roundId] = res.data;

        console.log(`\n==================================================`);
        console.log(`MARKET: ${question}`);
        console.log(`ID: ${id}`);
        console.log(`Creator: ${creator}`);
        console.log(`Outcome: ${["PENDING", "YES", "NO", "DRAW", "CANCELLED"][outcome]}`);
        // Fetch bets and claims from a reasonable recent block (38,200,000) to now
        const startBlock = 38200000n;
        const betLogs = await getLogsInChunks(abi[2], startBlock, latestBlock);
        const marketBets = betLogs.filter(l => l.args.id === id);

        const claimLogs = await getLogsInChunks(abi[3], startBlock, latestBlock);
        const marketClaims = claimLogs.filter(l => l.args.id === id);

        console.log(`BETTING SUMMARY:`);
        console.log(`  Total YES: ${Number(totalYes) / 10 ** 6} USDC`);
        console.log(`  Total NO:  ${Number(totalNo) / 10 ** 6} USDC`);
        console.log(`  Net Pool: ${Number(netDistributable) / 10 ** 6} USDC`);
        console.log(`  Referrer Pool: ${Number(referrerPool) / 10 ** 6} USDC`);

        const players = {};
        const referrers = {};

        marketBets.forEach(l => {
            const u = l.args.user.toLowerCase();
            const r = l.args.referrer.toLowerCase();
            if (!players[u]) players[u] = { yes: 0n, no: 0n, claimed: 0n, referrer: r };
            if (l.args.side) players[u].yes += l.args.amount; else players[u].no += l.args.amount;
            if (r !== '0x0000000000000000000000000000000000000000') referrers[r] = (referrers[r] || 0n) + l.args.amount;
        });

        marketClaims.forEach(l => {
            const u = l.args.user.toLowerCase();
            if (players[u]) players[u].claimed += l.args.amount;
        });

        console.log(`\nPLAYER DETAILS:`);
        for (const [addr, d] of Object.entries(players)) {
            const bet = Number(d.yes + d.no) / 10 ** 6;
            const claimed = Number(d.claimed) / 10 ** 6;
            console.log(`  - ${addr}: Bet ${bet} USDC [${d.yes > 0 ? 'YES' : ''}${d.no > 0 ? (d.yes > 0 ? ', NO' : 'NO') : ''}], Claimed ${claimed} USDC. Ref: ${d.referrer}`);
        }

        console.log(`\nREFERRAL DETAILS:`);
        if (Object.keys(referrers).length === 0) {
            console.log(`  (None)`);
        } else {
            for (const [addr, amt] of Object.entries(referrers)) {
                const reward = (amt * 500n) / 10000n;
                console.log(`  - ${addr}: Generated ${Number(amt) / 10 ** 6} USDC volume -> Reward: ${Number(reward) / 10 ** 6} USDC`);
            }
        }

        // Fees Breakdown
        const totalPool = totalYes + totalNo;
        console.log(`\nFEES RECAP:`);
        console.log(`  House (10%): ${Number(totalPool * 1000n / 10000n) / 10 ** 6} USDC`);
        console.log(`  Creator (5%): ${Number(totalPool * 500n / 10000n) / 10 ** 6} USDC`);
        console.log(`  Referral Pool (5%): ${Number(referrerPool) / 10 ** 6} USDC`);
        console.log(`  Reporter Reward (1%): ${Number(totalPool * 100n / 10000n) / 10 ** 6} USDC`);
    }
}
runSpecific().catch(console.error);
