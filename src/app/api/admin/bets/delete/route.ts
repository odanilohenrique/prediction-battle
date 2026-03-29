
import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { verifyAdminFromBody } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
    try {
        const { betId, adminAddress } = await req.json();

        // SECURITY: Verify admin
        const authError = verifyAdminFromBody(adminAddress);
        if (authError) return authError;

        if (!betId) {
            return NextResponse.json({ error: 'Missing betId' }, { status: 400 });
        }

        const bet = await store.getBet(betId);
        if (!bet) {
            return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
        }

        await store.deleteBet(betId);

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
