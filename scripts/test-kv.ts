import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { kv } from '@vercel/kv';

const BETS_KEY = 'prediction_bets';

async function testKV() {
    console.log('=== Testing Vercel KV Connection ===');

    try {
        // 1. Test Read
        console.log('\n1. Reading all bets from Redis...');
        const bets = await kv.hgetall(BETS_KEY);
        if (!bets) {
            console.log('   ❌ No bets found (returned null)');
        } else {
            const betCount = Object.keys(bets).length;
            console.log(`   ✅ Found ${betCount} bets in Redis`);
            Object.keys(bets).forEach(id => {
                const bet = (bets as any)[id];
                console.log(`      - ${id}: creator=${bet.creatorAddress || 'NONE'}, status=${bet.status}, expiresAt=${new Date(bet.expiresAt).toISOString()}`);
            });
        }

        // 2. Test Write
        console.log('\n2. Testing write operation...');
        const testId = `test_bet_${Date.now()}`;
        const testBet = {
            id: testId,
            username: 'TEST_USER',
            status: 'active',
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            totalPot: 0,
            participantCount: 0,
            creatorAddress: '0xTEST',
            participants: { yes: [], no: [] }
        };

        await kv.hset(BETS_KEY, { [testId]: testBet });
        console.log(`   ✅ Test bet ${testId} written successfully`);

        // 3. Test Read Back
        console.log('\n3. Reading back the test bet...');
        const readBack = await kv.hget(BETS_KEY, testId);
        if (readBack) {
            console.log(`   ✅ Test bet read back successfully!`);
        } else {
            console.log(`   ❌ Test bet NOT found after write!`);
        }

        // 4. Cleanup
        console.log('\n4. Cleaning up test bet...');
        await kv.hdel(BETS_KEY, testId);
        console.log(`   ✅ Test bet deleted`);

        console.log('\n=== KV Test Complete ===');

    } catch (error) {
        console.error('❌ KV TEST FAILED:', error);
    }
}

testKV();
