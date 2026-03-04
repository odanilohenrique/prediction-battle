// Debug: Compare how the frontend reconstructs market IDs vs what the contract produces
const { createPublicClient, http, parseAbi, keccak256, encodePacked } = require('viem');
const { baseSepolia } = require('viem/chains');

require('dotenv').config({ path: '.env.local' });

const CONTRACT = '0xF8623E94364b58246BC6FaBeA10710563d2dB6ae';

const client = createPublicClient({
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
});

const abi = parseAbi([
    'function markets(string) view returns (string id, address creator, string question, uint256 creationTime, uint256 bonusDuration, uint256 deadlineTime, uint8 state, uint8 outcome, uint256 seedAmount, bool seedWithdrawn, address proposer, bool proposedResult, uint256 proposalTime, uint256 bondAmount, string evidenceUrl, address challenger, uint256 challengeBondAmount, string challengeEvidenceUrl, uint256 challengeTime, uint256 totalYes, uint256 totalNo, uint256 totalSharesYes, uint256 totalSharesNo, uint256 netDistributable, uint256 referrerPool, uint256 roundId)',
    'function marketExists(string) view returns (bool)',
    'function marketCount() view returns (uint256)',
]);

async function main() {
    console.log('=== DEBUG: ID RECONSTRUCTION ===\n');

    // 1. Get current marketCount
    const marketCount = await client.readContract({
        address: CONTRACT, abi, functionName: 'marketCount'
    });
    console.log(`Current marketCount: ${marketCount}\n`);

    // 2. Get all bet IDs from KV
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    const response = await fetch(`${kvUrl}/hgetall/prediction_bets`, {
        headers: { Authorization: `Bearer ${kvToken}` }
    });
    const kvData = await response.json();
    const pairs = kvData.result || [];
    const bets = [];
    for (let i = 0; i < pairs.length; i += 2) {
        const val = typeof pairs[i + 1] === 'string' ? JSON.parse(pairs[i + 1]) : pairs[i + 1];
        bets.push(val);
    }

    console.log(`Found ${bets.length} bets in DB\n`);

    // 3. Check each bet: is it on-chain?
    for (const bet of bets) {
        const isOnChain = bet.id.startsWith('0x');
        const isPred = bet.id.startsWith('pred_');
        const isAdmin = bet.id.startsWith('admin_');

        console.log(`--- Bet: ${bet.id.slice(0, 40)}...`);
        console.log(`    DB Type: ${isPred ? 'PRED (temp)' : isOnChain ? 'ON-CHAIN (synced)' : isAdmin ? 'ADMIN (no chain)' : 'UNKNOWN'}`);
        console.log(`    Question: ${(bet.castText || '').slice(0, 50)}`);
        console.log(`    Creator: ${bet.creatorAddress || 'N/A'}`);
        console.log(`    Status: ${bet.status}`);

        if (isOnChain) {
            const exists = await client.readContract({
                address: CONTRACT, abi, functionName: 'marketExists', args: [bet.id]
            });
            console.log(`    On-chain exists: ${exists ? '✅' : '❌'}`);

            if (exists) {
                const data = await client.readContract({
                    address: CONTRACT, abi, functionName: 'markets', args: [bet.id]
                });
                console.log(`    On-chain creator: ${data[1]}`);
                console.log(`    On-chain question: ${data[2].slice(0, 50)}`);
                console.log(`    On-chain creationTime: ${data[3]} (${new Date(Number(data[3]) * 1000).toISOString()})`);
            }
        } else if (isPred) {
            // This is a temporary bet that was NEVER synced to on-chain
            // Let's check if there's a matching market on-chain
            console.log(`    ⚠️ TEMP ID - never synced to blockchain`);

            // Try to reconstruct what the ID SHOULD be
            // We need: creator address, question, block timestamp, nonce
            const creator = bet.creatorAddress;
            const question = bet.castText || '';

            if (creator && question) {
                console.log(`    Attempting reconstruction for nonces 0-${Number(marketCount) - 1}...`);

                // We need to know the block timestamp. Since we don't have it,
                // let's search by trying different timestamps from the bet's createdAt
                const betCreatedSec = BigInt(Math.floor(bet.createdAt / 1000));

                // Try a range of timestamps around the creation time (+/- 30 seconds)
                let found = false;
                for (let nonce = 0; nonce < Number(marketCount) && !found; nonce++) {
                    for (let offset = -30; offset <= 30 && !found; offset++) {
                        const ts = betCreatedSec + BigInt(offset);
                        const candidateId = keccak256(encodePacked(
                            ['address', 'string', 'uint256', 'uint256'],
                            [creator, question, ts, BigInt(nonce)]
                        ));

                        // Check if this candidate exists on-chain
                        const exists = await client.readContract({
                            address: CONTRACT, abi,
                            functionName: 'marketExists',
                            args: [candidateId]
                        });

                        if (exists) {
                            console.log(`    ✅ FOUND MATCH! nonce=${nonce}, offset=${offset}s`);
                            console.log(`    On-chain ID: ${candidateId}`);
                            console.log(`    Block timestamp used: ${ts}`);
                            found = true;
                        }
                    }
                }

                if (!found) {
                    console.log(`    ❌ No matching on-chain market found!`);
                    console.log(`    This means either:`);
                    console.log(`      1. The on-chain createMarket tx FAILED (most likely)`);
                    console.log(`      2. The creator address doesn't match`);
                    console.log(`      3. The question text was modified`);
                }
            }
        }
        console.log('');
    }

    // 4. Also check: are there on-chain markets NOT in the DB?
    console.log('\n=== Checking for orphaned on-chain markets ===');
    // We know there are potentially 12 markets. Let's see which ones are in DB
    const dbIds = bets.map(b => b.id);
    console.log(`DB IDs: ${dbIds.join('\n         ')}`);
}

main().catch(console.error);
