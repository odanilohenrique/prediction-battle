// Repair script for the single new off-chain market
require('dotenv').config({ path: '.env.local' });

const kvUrl = process.env.KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN;

const oldId = 'pred_1772622908082_8uc8ne1';
const newId = '0xb3e3d2a8853d41e93462e2694c1c08c54b57cbffaf5abbae8b4521a42e6632d4';

async function main() {
    console.log(`Fetching ${oldId}...`);
    const getRes = await fetch(`${kvUrl}/hget/prediction_bets/${oldId}`, {
        headers: { Authorization: `Bearer ${kvToken}` }
    });

    let betStr = (await getRes.json()).result;
    if (!betStr) {
        console.log(`Old bet not found in KV!`);
        return;
    }

    let bet = typeof betStr === 'string' ? JSON.parse(betStr) : betStr;
    console.log(`Found DB bet. Changing ID...`);

    bet.id = newId;

    // Save with the alternative pipeline endpoint which works well
    const setRes = await fetch(`${kvUrl}/pipeline`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${kvToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify([
            // 1. Save new
            ['HSET', 'prediction_bets', newId, JSON.stringify(bet)],
            // 2. Delete old
            ['HDEL', 'prediction_bets', oldId]
        ])
    });
    const result = await setRes.json();
    console.log(`Pipeline result:`, JSON.stringify(result));
}

main().catch(console.error);
