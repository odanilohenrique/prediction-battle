import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { UserBet } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || 'demo_user';
        const status = searchParams.get('status'); // 'active' or 'completed'

        // Fetch all bets from Redis
        const allBets = await store.getBets();

        // Filter for user's bets
        const userBets: UserBet[] = [];

        for (const bet of allBets) {
            // Check if user has bet on this prediction
            // Note: In store.ts 'participants' is used instead of 'pot'
            const yesBet = bet.participants.yes.find(b => b.userId === userId);
            const noBet = bet.participants.no.find(b => b.userId === userId);

            const userBet = yesBet || noBet;
            if (!userBet) continue;

            const choice = yesBet ? 'yes' : 'no';

            // Determine status
            let betStatus: 'pending' | 'won' | 'lost' = 'pending';
            let payout: number | undefined;

            if (bet.status === 'completed') {
                // TODO: Add result logic when we implement result checking
                betStatus = 'pending';
            }

            // Filter by status if requested
            if (status === 'active' && betStatus !== 'pending') continue;
            if (status === 'completed' && betStatus === 'pending') continue;

            userBets.push({
                predictionId: bet.id,
                prediction: {
                    ...bet,
                    // Map store 'participants' to frontend 'pot' expected structure
                    pot: bet.participants,
                    castHash: 'mock_hash', // Adapting to Prediction type
                    castText: `Prediction on @${bet.username}`,
                    castAuthor: bet.username,
                    metric: bet.type as any,
                    targetValue: bet.target,
                    initialValue: 0
                } as any, // Cast to any to bypass strict type mismatch for now
                choice: choice as 'yes' | 'no',
                amount: userBet.amount,
                timestamp: userBet.timestamp,
                status: betStatus,
                payout,
            });
        }

        // Sort by timestamp (newest first)
        userBets.sort((a, b) => b.timestamp - a.timestamp);

        return NextResponse.json({
            success: true,
            bets: userBets,
        });
    } catch (error) {
        console.error('Error in /api/predictions/list:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch predictions' },
            { status: 500 }
        );
    }
}
