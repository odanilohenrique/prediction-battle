import { NextResponse } from 'next/server';
import { store, Bet } from '@/lib/store';
import { getCastStats } from '@/lib/neynar';
import { sendPayout } from '@/lib/minikit';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const bets = await store.getBets();
        const now = Date.now();
        const expiredBets = bets.filter(b => b.status === 'active' && b.expiresAt <= now);
        const results = [];

        for (const bet of expiredBets) {
            try {
                // Fetch final cast stats from Neynar
                let finalValue = 0;

                if (bet.castHash) {
                    // It's a User Created Bet on a specific cast
                    const stats = await getCastStats(bet.castHash);
                    if (stats) {
                        // Get the value based on the metric type
                        // metric/type might be 'likes', 'recasts', 'replies'
                        // Need to map if necessary or access directly
                        // Assuming type matches stats keys for now (likes, recasts, replies)
                        const metricKey = bet.type as keyof typeof stats;
                        if (stats[metricKey] !== undefined) {
                            finalValue = stats[metricKey];
                        }
                    }
                } else {
                    // Admin Bet (Manual or Profile based) - Fallback Logic
                    // Mocking for MVP until Profile API is integrated
                    finalValue = Math.floor(Math.random() * (bet.target * 1.5));
                }

                // Determine result
                const result = finalValue >= bet.target ? 'yes' : 'no';

                // Update bet status
                bet.status = 'completed';
                bet.result = result;
                bet.finalValue = finalValue;

                // Calculating Payouts
                const totalPot = bet.totalPot;
                const platformFee = totalPot * 0.2;
                const winnersPot = totalPot * 0.8;

                const winningParticipants = result === 'yes' ? bet.participants.yes : bet.participants.no;
                const totalWinningStake = winningParticipants.reduce((sum, p) => sum + p.amount, 0);

                const payoutResults = [];

                if (totalWinningStake > 0) {
                    for (const participant of winningParticipants) {
                        const share = participant.amount / totalWinningStake;
                        const payoutAmount = share * winnersPot;

                        // Send Payout
                        const payoutTx = await sendPayout(participant.userId, payoutAmount);

                        payoutResults.push({
                            userId: participant.userId,
                            amount: payoutAmount,
                            success: payoutTx.success
                        });
                    }
                }

                // Save updated bet
                await store.saveBet(bet);

                results.push({
                    betId: bet.id,
                    result,
                    finalValue,
                    payouts: payoutResults
                });

            } catch (error) {
                console.error(`Error processing bet ${bet.id}:`, error);
            }
        }

        return NextResponse.json({
            success: true,
            checked: expiredBets.length,
            results,
        });
    } catch (error) {
        console.error('Error in /api/check:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to check predictions' },
            { status: 500 }
        );
    }
}

// Can also be triggered via GET for manual testing
export async function GET() {
    return POST();
}
