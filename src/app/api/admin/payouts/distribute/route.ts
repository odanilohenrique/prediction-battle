import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { verifyAdminFromBody } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
    try {
        const { predictionId, adminAddress } = await request.json();

        // SECURITY: Verify admin
        const authError = verifyAdminFromBody(adminAddress);
        if (authError) return authError;

        if (!predictionId) {
            return NextResponse.json({ success: false, error: 'Missing predictionId' }, { status: 400 });
        }

        const bet = await store.getBet(predictionId);

        if (!bet) {
            return NextResponse.json({ success: false, error: 'Bet not found' }, { status: 404 });
        }

        if (bet.status !== 'completed') {
            return NextResponse.json({
                success: false,
                error: 'Market not resolved yet.'
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: `Market resolved. Winners can now claim rewards via claimReward().`,
            info: {
                totalYes: bet.participants?.yes?.length || 0,
                totalNo: bet.participants?.no?.length || 0,
                result: bet.result,
            }
        });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
