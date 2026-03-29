
import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { verifyAdminFromBody } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
    try {
        const { adminAddress } = await request.json();

        // SECURITY: Verify admin
        const authError = verifyAdminFromBody(adminAddress);
        if (authError) return authError;

        const bets = await store.getBets();
        if (bets.length <= 1) {
            return NextResponse.json({ success: true, message: 'Nothing to clean up' });
        }

        const sorted = bets.sort((a, b) => b.createdAt - a.createdAt);
        const latestInfo = sorted[0];
        const toDelete = sorted.slice(1);

        for (const bet of toDelete) {
            await store.deleteBet(bet.id);
        }

        return NextResponse.json({
            success: true,
            deletedCount: toDelete.length,
            keptId: latestInfo.id
        });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
