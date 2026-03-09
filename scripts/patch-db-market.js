require('dotenv').config({ path: '.env.local' });

async function main() {
    const oldId = 'pred_1772713132541_sbykxgw';
    const newId = '0x57c5fb38d708eee517cf972243a2ff1a570145e255904f68209588ff7fb77bc8';

    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        console.error('Missing KV env vars');
        return;
    }

    // 1. Get old bet
    const getRes = await fetch(`${url}/hget/prediction_bets/${oldId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const { result: rawBet } = await getRes.json();

    if (!rawBet) {
        console.log('Bet not found!');
        return;
    }

    const bet = typeof rawBet === 'string' ? JSON.parse(rawBet) : rawBet;

    // 2. Clone and update ID
    const newBet = { ...bet, id: newId, predictionId: newId };

    // 3. Save new bet
    const setRes = await fetch(`${url}/hset/prediction_bets/${newId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newBet)
    });
    console.log('Set Response:', await setRes.json());

    // 4. Delete old bet
    const delRes = await fetch(`${url}/hdel/prediction_bets/${oldId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Delete Response:', await delRes.json());

    console.log(`✅ Fully patched! Market ${newId} is now live.`);
}

main().catch(console.error);
