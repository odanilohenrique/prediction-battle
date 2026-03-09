const { createPublicClient, http, parseAbi } = require('viem');
const { baseSepolia } = require('viem/chains');

const CONTRACT = '0xF8623E94364b58246BC6FaBeA10710563d2dB6ae';
const ADMIN = '0x8C451adc05eFDDe2B8cB2F0BA9d7A2223212BECb';

require('dotenv').config({ path: '.env.local' });

const client = createPublicClient({
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
});

const abi = parseAbi([
    'function markets(string) view returns (string id, address creator, string question, uint256 creationTime, uint256 bonusDuration, uint256 deadlineTime, uint8 state, uint8 outcome, uint256 seedAmount, bool seedWithdrawn, address proposer, bool proposedResult, uint256 proposalTime, uint256 bondAmount, string evidenceUrl, address challenger, uint256 challengeBondAmount, string challengeEvidenceUrl, uint256 challengeTime, uint256 totalYes, uint256 totalNo, uint256 totalSharesYes, uint256 totalSharesNo, uint256 netDistributable, uint256 referrerPool, uint256 roundId)',
    'function marketExists(string) view returns (bool)',
    'function adminResolve(string _marketId, uint8 _outcome, bool _slashCreator)',
    'function houseBalance() view returns (uint256)',
    'function totalLockedAmount() view returns (uint256)',
]);

async function main() {
    console.log('=== DRAW FAILURE - MARKET STATE ANALYSIS v3 ===\n');

    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (!kvUrl || !kvToken) {
        console.log('❌ KV credentials not found');
        return;
    }

    // Use HGETALL since store uses Redis hash
    console.log('Fetching bets from Vercel KV (HGETALL)...');
    const response = await fetch(`${kvUrl}/hgetall/prediction_bets`, {
        headers: { Authorization: `Bearer ${kvToken}` }
    });

    const kvData = await response.json();

    if (!kvData.result || kvData.result.length === 0) {
        console.log('❌ No bets found. Response:', JSON.stringify(kvData).slice(0, 200));
        return;
    }

    // HGETALL returns alternating key/value pairs: [key1, val1, key2, val2, ...]
    const pairs = kvData.result;
    const bets = [];
    for (let i = 0; i < pairs.length; i += 2) {
        const key = pairs[i];
        const val = typeof pairs[i + 1] === 'string' ? JSON.parse(pairs[i + 1]) : pairs[i + 1];
        bets.push({ ...val, _kvKey: key });
    }

    console.log(`Found ${bets.length} bets in database\n`);

    const outcomeNames = ['PENDING', 'YES', 'NO', 'DRAW', 'CANCELLED'];
    const stateNames = ['OPEN', 'LOCKED', 'PROPOSED', 'DISPUTED', 'RESOLVED'];

    for (const bet of bets) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📋 Market: ${bet.id}`);
        console.log(`   Question: ${(bet.castText || bet.question || 'N/A').slice(0, 60)}`);
        console.log(`   DB Status: ${bet.status} | DB Result: ${bet.result || 'N/A'}`);

        try {
            const exists = await client.readContract({ address: CONTRACT, abi, functionName: 'marketExists', args: [bet.id] });
            if (!exists) {
                console.log(`   ⚠️ NOT on-chain`);
                continue;
            }

            const data = await client.readContract({ address: CONTRACT, abi, functionName: 'markets', args: [bet.id] });

            const state = Number(data[6]);
            const outcome = Number(data[7]);
            const seedAmount = Number(data[8]) / 1e6;
            const seedWithdrawn = data[9];
            const proposer = data[10];
            const challenger = data[15];
            const totalYes = Number(data[19]) / 1e6;
            const totalNo = Number(data[20]) / 1e6;
            const bondAmount = Number(data[13]) / 1e6;
            const challBond = Number(data[16]) / 1e6;
            const netDist = Number(data[23]) / 1e6;

            console.log(`   Chain: ${stateNames[state]} | ${outcomeNames[outcome]} | YES: $${totalYes} | NO: $${totalNo} | Seed: $${seedAmount}`);
            console.log(`   Proposer: ${proposer?.slice(0, 10)}... | Challenger: ${challenger?.slice(0, 10)}...`);
            console.log(`   Bonds: $${bondAmount} + $${challBond} | NetDist: $${netDist}`);

            if (state !== 4) {
                console.log(`\n   🔍 ACTIVE market — simulating DRAW...`);

                // Simulate with slashCreator=false
                try {
                    await client.simulateContract({
                        address: CONTRACT,
                        abi,
                        functionName: 'adminResolve',
                        args: [bet.id, 3, false],
                        account: ADMIN,
                    });
                    console.log(`   ✅ DRAW (slash=false) → OK`);
                } catch (err) {
                    const reason = err.cause?.reason || err.shortMessage || err.message;
                    console.log(`   ❌ DRAW (slash=false) → FAIL: ${reason?.slice(0, 200)}`);
                }

                // Simulate with slashCreator=true
                try {
                    await client.simulateContract({
                        address: CONTRACT,
                        abi,
                        functionName: 'adminResolve',
                        args: [bet.id, 3, true],
                        account: ADMIN,
                    });
                    console.log(`   ✅ DRAW (slash=true) → OK`);
                } catch (err) {
                    const reason = err.cause?.reason || err.shortMessage || err.message;
                    console.log(`   ❌ DRAW (slash=true) → FAIL: ${reason?.slice(0, 200)}`);
                }

                // Also simulate YES and NO for comparison
                try {
                    await client.simulateContract({
                        address: CONTRACT,
                        abi,
                        functionName: 'adminResolve',
                        args: [bet.id, 1, false], // YES
                        account: ADMIN,
                    });
                    console.log(`   ✅ YES (slash=false) → OK`);
                } catch (err) {
                    const reason = err.cause?.reason || err.shortMessage || err.message;
                    console.log(`   ❌ YES (slash=false) → FAIL: ${reason?.slice(0, 200)}`);
                }
                try {
                    await client.simulateContract({
                        address: CONTRACT,
                        abi,
                        functionName: 'adminResolve',
                        args: [bet.id, 2, false], // NO
                        account: ADMIN,
                    });
                    console.log(`   ✅ NO (slash=false) → OK`);
                } catch (err) {
                    const reason = err.cause?.reason || err.shortMessage || err.message;
                    console.log(`   ❌ NO (slash=false) → FAIL: ${reason?.slice(0, 200)}`);
                }
            }
        } catch (err) {
            console.log(`   ❌ Error: ${err.message?.slice(0, 200)}`);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('DONE');
}

main().catch(console.error);
