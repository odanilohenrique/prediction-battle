import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { betId, reason, slashType, slashedAddress } = body;

        if (!betId || !reason || !slashType) {
            return NextResponse.json({ success: false, error: 'Missing required fields: betId, reason, slashType' }, { status: 400 });
        }

        const bet = await store.getBet(betId);
        if (!bet) {
            return NextResponse.json({ success: false, error: 'Bet not found' }, { status: 404 });
        }

        // Update the bet with slash info
        bet.slashReason = reason;
        bet.slashType = slashType;
        bet.slashedAddress = slashedAddress || '';
        bet.slashedAt = Date.now();

        await store.saveBet(bet);

        console.log(`[SLASH] Market ${betId} - ${slashType} slashed. Reason: "${reason}"`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[SLASH REASON API] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
