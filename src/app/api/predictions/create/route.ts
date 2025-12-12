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

        // For MVP, checking if prediction exists is complex without a secondary index in Redis.
        // We'll skip the check for now or implement a basic scan if critical.
        // For speed: Create new prediction each time (or client handles dedup).

        const betId = `pred_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const now = Date.now();
        const expiresAt = now + (24 * 60 * 60 * 1000); // 24h default

        const bet: Bet = {
            id: betId,
            username: castAuthor || 'unknown', // Mapping castAuthor to username field
            type: metric, // Mapping metric to type
            target: targetValue, // Mapping targetValue to target
            timeframe: '24h',
            minBet: 0.05, // Defaults
            maxBet: 100, // Defaults
            createdAt: now,
            expiresAt,
            status: 'active',
            totalPot: betAmount,
            participantCount: 1,
            participants: {
                yes: [],
                no: [],
            },
            // specific fields
            castHash,
            castAuthor,
            castText,
            initialValue: initialValue || 0
        };

        // Add the initial participant
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
