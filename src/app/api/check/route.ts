import { NextResponse } from 'next/server';
import { getExpiredPredictions, updatePredictionResult, calculatePayouts, getTotalPot } from '@/lib/predictions';
import { getCastStats } from '@/lib/neynar';
import { sendPayout } from '@/lib/minikit';

export async function POST() {
    try {
        const expiredPredictions = getExpiredPredictions();
        const results = [];

        for (const prediction of expiredPredictions) {
            try {
                // Fetch final cast stats from Neynar
                const stats = await getCastStats(prediction.castHash);

                if (!stats) {
                    console.error(`Could not fetch stats for cast ${prediction.castHash}`);
                    continue;
                }

                const finalValue = stats[prediction.metric];

                // Determine result
                const result = finalValue >= prediction.targetValue ? 'yes' : 'no';

                // Update prediction
                updatePredictionResult(prediction.id, result, finalValue);

                // Calculate payouts
                const { winners, platformFee } = calculatePayouts(prediction);
                const totalPot = getTotalPot(prediction);

                // Send payouts (placeholder - requires actual MiniKit integration)
                const payoutResults = [];
                for (const winner of winners) {
                    const payoutResult = await sendPayout(winner.userId, winner.payout);
                    payoutResults.push({
                        userId: winner.userId,
                        amount: winner.payout,
                        success: payoutResult.success,
                    });
                }

                // Send platform fee to receiver address
                const receiverAddress = process.env.RECEIVER_ADDRESS;
                if (receiverAddress && platformFee > 0) {
                    await sendPayout(receiverAddress, platformFee);
                }

                results.push({
                    predictionId: prediction.id,
                    castHash: prediction.castHash,
                    metric: prediction.metric,
                    targetValue: prediction.targetValue,
                    finalValue,
                    result,
                    totalPot,
                    winnersCount: winners.length,
                    platformFee,
                    payouts: payoutResults,
                });
            } catch (error) {
                console.error(`Error processing prediction ${prediction.id}:`, error);
            }
        }

        return NextResponse.json({
            success: true,
            checked: expiredPredictions.length,
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
