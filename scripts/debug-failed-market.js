require('dotenv').config({ path: '.env.local' });
const { fetch } = require('undici');

async function main() {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        console.error("Missing KV credentials");
        return;
    }

    // Vercel KV REST API to hgetall prediction_bets
    const res = await fetch(`${url}/hgetall/prediction_bets`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    if (data.error) {
        console.error("API Error:", data.error);
        return;
    }

    // result is an array like [key1, val1, key2, val2...]
    const rawArray = data.result;
    const markets = [];
    for (let i = 0; i < rawArray.length; i += 2) {
        markets.push(JSON.parse(rawArray[i + 1]));
    }

    console.log(`Found ${markets.length} total markets in hash.`);

    const failedMarket = markets.find(m =>
        (m.displayName && m.displayName.toLowerCase().includes('ethereum')) ||
        (m.optionA && m.optionA.label && m.optionA.label.toLowerCase().includes('ethereum')) ||
        (m.optionB && m.optionB.label && m.optionB.label.toLowerCase().includes('ethereum'))
    );

    console.log("\n--- FAILED MARKET DATA ('ethereum_brasil') ---");
    console.log(JSON.stringify(failedMarket, null, 2));

    const workingMarket = markets.find(m =>
        m.id.startsWith('0x') &&
        ((m.displayName && m.displayName.toLowerCase().includes('cameron')) ||
            (m.optionA && m.optionA.label && m.optionA.label.toLowerCase().includes('cameron')) ||
            (m.optionB && m.optionB.label && m.optionB.label.toLowerCase().includes('cameron')))
    );

    console.log("\n--- WORKING MARKET DATA ('cameron') ---");
    console.log(JSON.stringify(workingMarket, null, 2));
}

main().catch(console.error);
