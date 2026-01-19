import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

/**
 * V2 NOTE: distributeWinnings does NOT exist in PredictionBattleV2!
 * 
 * In V2, distribution is user-initiated via claimReward(marketId).
 * Each winner must claim their own reward.
 * 
 * This endpoint now just syncs the database to mark all winners as "pending claim"
 * and returns a message informing the admin.
 */
export async function POST(request: NextRequest) {
    try {
        const { predictionId } = await request.json();

        if (!predictionId) {
            return NextResponse.json({ success: false, error: 'Missing predictionId' }, { status: 400 });
        }

        console.log(`[API] V2: Batch distribute called for ${predictionId}`);
        console.log(`[API] V2: Note - distributeWinnings does not exist in V2. Users must call claimReward().`);

        // Sync DB to mark market as resolved (if not already)
        const bet = await store.getBet(predictionId);

        if (!bet) {
            return NextResponse.json({ success: false, error: 'Bet not found in database' }, { status: 404 });
        }

        if (bet.status !== 'completed') {
            return NextResponse.json({
                success: false,
                error: 'Market not resolved yet. Please resolve the market first.'
            }, { status: 400 });
        }

        // In V2, we don't auto-distribute. Instead, inform the admin.
        return NextResponse.json({
            success: true,
            message: `V2 Contract: Market "${predictionId}" is resolved. Winners can now claim their rewards by calling claimReward() on the contract. No batch distribution in V2.`,
            info: {
                totalYes: bet.participants?.yes?.length || 0,
                totalNo: bet.participants?.no?.length || 0,
                result: bet.result,
                note: 'Each winner must claim individually via the Claim Reward button.'
            }
        });

    } catch (error: any) {
        console.error('[API] Distribute Error:', error);

        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error'
        }, { status: 500 });
    }
}
