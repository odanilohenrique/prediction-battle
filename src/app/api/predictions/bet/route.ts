import { NextRequest, NextResponse } from 'next/server';
import { store, BetParticipant } from '@/lib/store';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { betId, choice, amount } = body;

        // TODO: Get user ID from authentication
        const userId = 'demo_user';

        // Validate input
        if (!betId || !choice || !amount) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Get the bet from Redis
        const bet = await store.getBet(betId);

        if (!bet) {
            return NextResponse.json(
                { success: false, error: 'Bet not found' },
                { status: 404 }
            );
        }

        // Validate amount
        if (amount < bet.minBet || amount > bet.maxBet) {
            return NextResponse.json(
                { success: false, error: `Amount must be between ${bet.minBet} and ${bet.maxBet} USDC` },
                { status: 400 }
            );
        }

        // Add participant
        const participant: BetParticipant = {
            userId,
            choice,
            amount,
            timestamp: Date.now(),
        };

        if (choice === 'yes') {
            bet.participants.yes.push(participant);
        } else {
            bet.participants.no.push(participant);
        }

        // Update stats
        bet.totalPot += amount;
        bet.participantCount = bet.participants.yes.length + bet.participants.no.length;

        // Save updated bet to Redis
        await store.saveBet(bet);

        return NextResponse.json({
            success: true,
            bet,
        });
    } catch (error) {
        console.error('Error in /api/predictions/bet:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to place bet' },
            { status: 500 }
        );
    }
}
