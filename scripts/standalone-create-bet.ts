
import 'dotenv/config';
import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';

async function main() {
    console.log('🚀 Running Standalone Bet Creator...');

    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.error('❌ Error: KV_REST_API_URL and KV_REST_API_TOKEN are required in .env.local');
        return;
    }

    const betId = `admin_bet_${Date.now()}`;
    const now = Date.now();
    const expiresAt = now + 30 * 60 * 1000; // 30 mins

    const bet = {
        id: betId,
        username: 'betashop.eth',
        displayName: 'betashop.eth',
        pfpUrl: 'https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/486fd621-633b-4eb7-a13b-cb5cd118cb00/anim=false,fit=contain,f=auto,w=288',
        type: 'likes_total',
        target: 10,
        timeframe: '30m',
        minBet: 0.1,
        maxBet: 50,
        expiresAt: expiresAt,
        status: 'active',
        totalPot: 0,
        participantCount: 0,
        participants: { yes: [], no: [] },
        createdAt: now,
        castHash: '0x7678633e',
        rules: 'Automated test 30m',
    };

    const BETS_KEY = 'prediction_bets';

    console.log('📝 Saving bet to KV...');
    await kv.hset(BETS_KEY, { [bet.id]: bet });

    console.log('\n✅ Bet Created Successfully!');
    console.log(`ID: ${bet.id}`);
    console.log(`Target: ${bet.target} Likes`);
    console.log(`Expires: ${new Date(expiresAt).toLocaleString()}`);
}

main().catch(console.error);
