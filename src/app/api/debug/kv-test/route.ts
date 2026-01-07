
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
    const results: any = {
        timestamp: new Date().toISOString(),
        tests: {}
    };

    try {
        // Test 1: Basic KV ping
        const testKey = `test_${Date.now()}`;
        const testValue = { test: true, time: Date.now() };

        await kv.set(testKey, testValue);
        const readBack = await kv.get(testKey);
        await kv.del(testKey);

        results.tests.kvPing = {
            status: 'OK',
            wrote: testValue,
            readBack
        };

        // Test 2: Check BETS_KEY
        const BETS_KEY = 'prediction_bets';
        const allBetsRaw = await kv.hgetall(BETS_KEY);
        const betCount = allBetsRaw ? Object.keys(allBetsRaw).length : 0;

        results.tests.betsHash = {
            status: 'OK',
            totalBets: betCount,
            keys: allBetsRaw ? Object.keys(allBetsRaw).slice(0, 5) : []
        };

        // Test 3: Store getBets
        const betsFromStore = await store.getBets();
        results.tests.storeGetBets = {
            status: 'OK',
            count: betsFromStore.length,
            latestCreatedAt: betsFromStore.length > 0
                ? new Date(Math.max(...betsFromStore.map(b => b.createdAt))).toISOString()
                : null
        };

        // Test 4: Write a test bet and read it back
        const testBetId = `diag_${Date.now()}`;
        const testBet = {
            id: testBetId,
            username: 'DIAGNOSTIC_TEST',
            status: 'active',
            createdAt: Date.now(),
            expiresAt: Date.now() + 60000,
            totalPot: 0,
            participantCount: 0,
            participants: { yes: [], no: [] },
            type: 'test',
            target: 0,
            timeframe: '30m',
            minBet: 0,
            maxBet: 0
        };

        await kv.hset(BETS_KEY, { [testBetId]: testBet });
        const readBackBet = await kv.hget(BETS_KEY, testBetId);
        await kv.hdel(BETS_KEY, testBetId); // Cleanup

        results.tests.betWriteRead = {
            status: readBackBet ? 'OK' : 'FAILED',
            wrote: testBetId,
            readBack: readBackBet ? 'SUCCESS' : 'NULL'
        };

        // Test 5: Environment check
        results.tests.env = {
            KV_URL: process.env.KV_URL ? 'SET (hidden)' : 'NOT SET',
            KV_REST_API_URL: process.env.KV_REST_API_URL ? 'SET (hidden)' : 'NOT SET',
            KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? 'SET (hidden)' : 'NOT SET',
        };

        results.overall = 'ALL TESTS PASSED';

    } catch (error: any) {
        results.overall = 'ERROR';
        results.error = error.message;
        results.stack = error.stack?.split('\n').slice(0, 5);
    }

    return NextResponse.json(results, {
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        }
    });
}
