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

            if (bet.status === 'completed' && bet.result) {
                if (bet.result === choice) {
                    betStatus = 'won';
                    // Calculate Payout
                    const totalPot = bet.totalPot;
                    const winnerPool = choice === 'yes'
                        ? bet.participants.yes.reduce((a, b) => a + b.amount, 0)
                        : bet.participants.no.reduce((a, b) => a + b.amount, 0);

                    if (winnerPool > 0) {
                        // Simple proportional share + house fee taken from losers
                        // Formula: (YourStake / WinnerPool) * (TotalPot - HouseFee)
                        // But we simplifed in payouts.ts: Stake + (Stake/WinnerPool * LoserPool * 0.8)

                        const loserPool = totalPot - winnerPool;
                        const winnings = (userBet.amount / winnerPool) * (loserPool * 0.8);
                        payout = userBet.amount + winnings;
                    } else {
                        // Should not happen if there's a winner, but safety
                        payout = userBet.amount;
                    }

                } else {
                    betStatus = 'lost';
                    payout = 0;
                }
            } else if (Date.now() > bet.expiresAt && !bet.result) {
                // Expired but not resolved
                betStatus = 'pending';
            }

            // Filter by status if requested
            // If requesting 'completed', we want won/lost.
            if (status === 'active' && betStatus !== 'pending') continue;

            // If requesting 'completed', include won/lost. 
            // NOTE: The previous logic excluded 'pending', which is correct for history.
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
                    initialValue: 0,
                    result: bet.result,
                    creatorAddress: bet.creatorAddress,
                    wordToMatch: bet.wordToMatch,
                } as any, // Cast to any to bypass strict type mismatch for now
                choice: choice as 'yes' | 'no',
                amount: userBet.amount,
                timestamp: userBet.timestamp,
                status: betStatus,
                payout,
                paid: userBet.paid,
                txHash: userBet.txHash
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
