// Emergency repair: Re-save the 4 bets that were deleted by the previous broken script
// Uses Upstash REST API correctly: POST /hset/key with body [field1, value1, field2, value2]
require('dotenv').config({ path: '.env.local' });

const kvUrl = process.env.KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN;

// The 4 bets that need to be re-saved (from the original debug output)
const repairs = [
    {
        oldId: 'pred_1772476086370_in79quf',
        newId: '0xbb7a537e527169785ec62212b6a27a383ec2623d39e77cef6be91df9b5ab81d2',
        question: 'Testando slash no criador por ambiguidade',
        creator: '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02',
        createdAt: 1772476086370,
    },
    {
        oldId: 'pred_1772539993925_xjc3d4t',
        newId: '0x98fbb2cd1cca3a7d808cd8031ab1a1d83a6005558d82c1ac85ff9cee5407846d',
        question: 'testando mercado offchain',
        creator: '0x1cb36C90dd0278906295D6bc890A2A76E4D8f80b',
        createdAt: 1772539993925,
    },
    {
        oldId: 'pred_1772476141565_kepsisw',
        newId: '0xc1044f9041f8c03c9a9d594260fa825523da48756346ebee5d2be15513953dc1',
        question: 'Testando slash no criador por ambiguidade2',
        creator: '0x1cb36C90dd0278906295D6bc890A2A76E4D8f80b',
        createdAt: 1772476141565,
    },
    {
        oldId: 'pred_1772540082506_f0tfct5',
        newId: '0x245db6736e14cc230583725bfd4c09e39592b4578eab20c412069feb657dd454',
        question: 'testando novamente',
        creator: '0xEF7eb01f92f333805eA974d8d5a0d71032286436',
        createdAt: 1772540082506,
    },
];

async function main() {
    console.log('=== EMERGENCY REPAIR ===\n');

    // First, read ALL existing bets to check current state
    const response = await fetch(`${kvUrl}/hgetall/prediction_bets`, {
        headers: { Authorization: `Bearer ${kvToken}` }
    });
    const kvData = await response.json();
    const pairs = kvData.result || [];
    const existingKeys = [];
    for (let i = 0; i < pairs.length; i += 2) {
        existingKeys.push(pairs[i]);
    }
    console.log(`Current DB keys (${existingKeys.length}): ${existingKeys.join(', ').slice(0, 200)}...\n`);

    for (const r of repairs) {
        console.log(`--- Repairing: ${r.oldId.slice(0, 30)}...`);
        console.log(`    New ID: ${r.newId.slice(0, 30)}...`);

        // Check if either old or new ID exists
        if (existingKeys.includes(r.newId)) {
            console.log(`    Already exists with correct ID ✅, skipping`);
            continue;
        }
        if (existingKeys.includes(r.oldId)) {
            console.log(`    ⚠️ Old ID still exists — will rename`);
        }

        // Reconstruct the bet object
        const bet = {
            id: r.newId,
            username: r.question.includes('vs') ? r.question : 'unknown',
            castText: r.question,
            status: 'active',
            createdAt: r.createdAt,
            expiresAt: r.createdAt + 365 * 24 * 60 * 60 * 1000, // 1 year
            type: 'custom_text',
            target: 0,
            timeframe: '1y',
            minBet: 0.05,
            maxBet: 5,
            totalPot: 10,
            participantCount: 0,
            participants: { yes: [], no: [] },
            creatorAddress: r.creator,
            isVersus: false,
        };

        // Use Upstash REST API correctly
        // HSET key field value → POST /hset/key/field with body as value
        const setRes = await fetch(`${kvUrl}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${kvToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(['HSET', 'prediction_bets', r.newId, JSON.stringify(bet)])
        });
        const setData = await setRes.json();
        console.log(`    HSET result:`, JSON.stringify(setData));

        if (setData.error) {
            console.log(`    ❌ HSET failed, trying alternative format...`);
            // Alternative: use the pipeline endpoint
            const altRes = await fetch(`${kvUrl}/hset/prediction_bets/${encodeURIComponent(r.newId)}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${kvToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bet)
            });
            const altData = await altRes.json();
            console.log(`    Alt HSET result:`, JSON.stringify(altData));
        }
    }

    // Verify
    console.log('\n=== VERIFICATION ===');
    const verifyRes = await fetch(`${kvUrl}/hgetall/prediction_bets`, {
        headers: { Authorization: `Bearer ${kvToken}` }
    });
    const verifyData = await verifyRes.json();
    const verifyPairs = verifyData.result || [];
    console.log(`Total bets after repair: ${verifyPairs.length / 2}`);
    for (let i = 0; i < verifyPairs.length; i += 2) {
        console.log(`  Key: ${verifyPairs[i].slice(0, 40)}...`);
    }
}

main().catch(console.error);
