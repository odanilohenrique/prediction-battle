import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { verifyAdminFromBody } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { betId, reason, slashType, slashedAddress, adminAddress } = body;

        // SECURITY: Verify admin
        const authError = verifyAdminFromBody(adminAddress);
        if (authError) return authError;

        if (!betId || !reason || !slashType) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const bet = await store.getBet(betId);
        if (!bet) {
            return NextResponse.json({ success: false, error: 'Bet not found' }, { status: 404 });
        }

        bet.slashReason = reason;
        bet.slashType = slashType;
        bet.slashedAddress = slashedAddress || '';
        bet.slashedAt = Date.now();

        await store.saveBet(bet);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
