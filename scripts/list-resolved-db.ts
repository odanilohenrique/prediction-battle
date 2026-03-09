import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const [key, ...rest] = line.split('=');
            if (key && rest.length > 0) {
                process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
            }
        });
    }
}

async function main() {
    loadEnv();
    console.log('Fetching prediction_bets from KV...');
    const bets = await kv.hgetall('prediction_bets');

    if (!bets) {
        console.log('No bets found in "prediction_bets" hash.');
        return;
    }

    const betArray = Object.values(bets) as any[];
    console.log(`Found ${betArray.length} total bets in DB.`);

    const active = betArray.filter(b => b.status === 'active' || b.status === 'pending');
    console.log(`Found ${active.length} active/pending bets in DB.`);

    console.log('\nActive Markets (from DB):');
    active.forEach(b => {
        console.log(`- Q: ${b.question || b.castText} | ID: ${b.id || b.predictionId} | Status: ${b.status} | CreatedAt: ${b.createdAt}`);
    });
}

main().catch(console.error);
