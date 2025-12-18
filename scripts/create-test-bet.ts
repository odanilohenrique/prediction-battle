
import 'dotenv/config'; // Load .env
import { store } from '../src/lib/store';
import { v4 as uuidv4 } from 'uuid';

async function mainLocal() {
    console.log('🚀 Creating Test Bet via Script...');

    const betId = uuidv4();
    const now = Date.now();
    const expiresAt = now + 30 * 60 * 1000; // 30 mins from now

    const bet = {
        id: betId,
        username: 'betashop.eth',
        displayName: 'betashop.eth',
        pfpUrl: 'https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/486fd621-633b-4eb7-a13b-cb5cd118cb00/anim=false,fit=contain,f=auto,w=288',
        type: 'likes_total',
        target: 10, // Target: 10 Likes (Low for testing)
        timeframe: 'custom',
        minBet: 0.1,
        maxBet: 50,
        expiresAt: expiresAt,
        status: 'active',
        totalPot: 0,
        participantCount: 0,
        participants: { yes: [], no: [] },
        createdAt: now,
        castHash: '0x7678633e', // Short hash provided
        rules: 'This is an automated test bet for likes.',
    };

    console.log('📝 Bet Object:', bet);

    // Save to KV
    await store.saveBet(bet);

    console.log('\n✅ Bet Created Successfully!');
    console.log(`ID: ${bet.id}`);
    console.log(`Expires in: 30 minutes`);
}

mainLocal().catch(console.error);

export {};
