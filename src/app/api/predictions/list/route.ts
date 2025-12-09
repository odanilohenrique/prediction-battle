import { NextRequest, NextResponse } from 'next/server';
import { getUserPredictions, getActivePredictions, getAllPredictions } from '@/lib/predictions';
import { UserBet, Prediction } from '@/lib/types';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || 'demo_user';
        const status = searchParams.get('status'); // 'active' or 'completed'

        let predictions: Prediction[];

        if (status === 'active') {
            // Get active predictions
            predictions = getActivePredictions();
        } else {
            // Get all predictions (for completed bets)
            predictions = getAllPredictions();
        }

        // Filter for user's bets
        const userBets: UserBet[] = [];

        for (const prediction of predictions) {
            // Check if user has bet on this prediction
            const yesBet = prediction.pot.yes.find(b => b.userId === userId);
            const noBet = prediction.pot.no.find(b => b.userId === userId);

            const userBet = yesBet || noBet;
            if (!userBet) continue;

            const choice = yesBet ? 'yes' : 'no';

            // Determine status
            let betStatus: 'pending' | 'won' | 'lost' = 'pending';
            let payout: number | undefined;

            if (prediction.status === 'completed' && prediction.result) {
                if (choice === prediction.result) {
                    betStatus = 'won';
                    // Calculate payout (this is simplified - should use calculatePayouts)
                    const totalPot =
                        prediction.pot.yes.reduce((sum, b) => sum + b.amount, 0) +
                        prediction.pot.no.reduce((sum, b) => sum + b.amount, 0);
                    const winnersPot = totalPot * 0.8;
                    const winningBets = prediction.result === 'yes' ? prediction.pot.yes : prediction.pot.no;
                    const totalWinningStake = winningBets.reduce((sum, b) => sum + b.amount, 0);
                    payout = (userBet.amount / totalWinningStake) * winnersPot;
                } else {
                    betStatus = 'lost';
                    payout = 0;
                }
            }

            // Filter by status if requested
            if (status === 'active' && betStatus !== 'pending') continue;
            if (status === 'completed' && betStatus === 'pending') continue;

            userBets.push({
                predictionId: prediction.id,
                prediction,
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
