import { kv } from '@vercel/kv';
import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    console.log('🔍 Checking Redis Connection...');
    console.log('KV_URL:', process.env.KV_URL ? (process.env.KV_URL.substring(0, 15) + '...') : 'UNDEFINED');

    try {
        const BETS_KEY = 'prediction_bets';
        const betsMap = await kv.hgetall(BETS_KEY);

        if (!betsMap) {
            console.log('❌ No bets found (Key does not exist or empty).');
            return;
        }

        const bets = Object.values(betsMap);
        console.log(`✅ Found ${bets.length} bets in DB.`);

        console.log('\n--- Active Bets ---');
        bets.filter((b: any) => b.status === 'active').forEach((b: any) => {
            console.log(`[ACTIVE] ${b.id} | ${b.type} | Target: ${b.target} | Created: ${new Date(b.createdAt).toISOString()}`);
        });

        console.log('\n--- Completed Bets ---');
        bets.filter((b: any) => b.status !== 'active').forEach((b: any) => {
            console.log(`[COMPLETED] ${b.id} | Result: ${b.result} | Status in DB: ${b.status}`);
        });

        // Check specifically for the bet likely causing issues (the "Jesse Pollak comments" one mentioned)
        console.log('\n--- Looking for specific missing bet (comments/jessepollak) ---');
        const missing = bets.find((b: any) => b.username?.includes('jesse') && b.type === 'comment_count');
        if (missing) {
            console.log('Found it!', missing);
        } else {
            console.log('❌ Not found in this DB.');
        }

    } catch (error) {
        console.error('❌ Failed to connect or fetch:', error);
    }
}

main();
