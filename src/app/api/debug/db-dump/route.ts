import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const BETS_KEY = 'prediction_bets';
        const rawBets = await kv.hgetall(BETS_KEY);

        let bets: any[] = [];
        if (rawBets) {
            bets = Object.values(rawBets);
        }

        // Environment Fingerprint (safe to show)
        const envUrl = process.env.KV_URL || '';
        const envHash = envUrl ? envUrl.substring(0, 15) + '...' : 'UNDEFINED';

        return NextResponse.json({
            success: true,
            envHash,
            totalBets: bets.length,
            activeBets: bets.filter((b: any) => b.status === 'active').sort((a: any, b: any) => b.createdAt - a.createdAt),
            otherBets: bets.filter((b: any) => b.status !== 'active').sort((a: any, b: any) => b.createdAt - a.createdAt),
            timestamp: new Date().toISOString()
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
