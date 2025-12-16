import { NextRequest, NextResponse } from 'next/server';
import { store, Bet, BetParticipant } from '@/lib/store';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            castHash,
            castAuthor,
            castText,
            metric,
            targetValue,
            choice,
            betAmount,
            userAddress, // Expecting user address for ID
            initialValue,
        } = body;

        // Use wallet address as user ID if provided, otherwise fallback
        const userId = userAddress || 'demo_user';

        // Validate input
        if (!castHash || !metric || !targetValue || !choice || !betAmount) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Check for existing active prediction for this cast + metric + target
        // We need to scan/filter bets (not efficient but okay for MVP).
        // Ideally we'd have a secondary index `pred:{castHash}:{metric}:{target}`

        const allBets = await store.getBets();
        const existingBet = allBets.find(b =>
            b.castHash === castHash &&
            b.type === metric &&
            b.target === targetValue &&
            b.status === 'active'
        );

        let bet: Bet;
        let betId: string;

        if (existingBet) {
            // JOIN EXISTING
            bet = existingBet;
            betId = bet.id;

            // Add participant to existing bet
            const participant: BetParticipant = {
                userId,
                choice,
                amount: betAmount,
                timestamp: Date.now()
            };

            if (choice === 'yes') {
                bet.participants.yes.push(participant);
            } else {
                bet.participants.no.push(participant);
            }

            // Update totals
            bet.totalPot += betAmount;
            bet.participantCount += 1;

        } else {
            // CREATE NEW
            betId = `pred_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const now = Date.now();
            const expiresAt = now + (24 * 60 * 60 * 1000); // 24h default

            bet = {
                id: betId,
                username: castAuthor || 'unknown',
                type: metric,
                target: targetValue,
                timeframe: '24h',
                minBet: 0.05,
                maxBet: 100,
                createdAt: now,
                expiresAt,
                status: 'active',
                totalPot: betAmount,
                participantCount: 1,
                participants: {
                    yes: [],
                    no: [],
                },
                castHash,
                castAuthor,
                castText,
                initialValue: initialValue || 0
            };

            const participant: BetParticipant = {
                userId,
                choice,
                amount: betAmount,
                timestamp: now
            };

            if (choice === 'yes') {
                bet.participants.yes.push(participant);
            } else {
                bet.participants.no.push(participant);
            }
        }

        // Save to Redis
        await store.saveBet(bet);

        return NextResponse.json({
            success: true,
            predictionId: bet.id,
            prediction: bet,
        });
    } catch (error) {
        console.error('Error in /api/predictions/create:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create prediction' },
            { status: 500 }
        );
    }
}
