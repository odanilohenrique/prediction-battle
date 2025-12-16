import { NextRequest, NextResponse } from 'next/server';
import { store, Bet } from '@/lib/store';
import { getUserByUsername } from '@/lib/neynar';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            username,
            betType,
            targetValue,
            timeframe,
            minBet,
            maxBet,
            rules,
        } = body;

        // Validate input
        if (!username || !betType || !targetValue || !timeframe) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Fetch Farcaster profile data
        const userData = await getUserByUsername(username);

        // Create bet ID
        const betId = `admin_bet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const now = Date.now();
        const expiresAt = timeframe === '24h'
            ? now + (24 * 60 * 60 * 1000)
            : now + (7 * 24 * 60 * 60 * 1000);

        const bet: Bet = {
            id: betId,
            username: userData?.username || username,
            displayName: userData?.displayName,
            pfpUrl: userData?.pfpUrl,
            fid: userData?.fid,
            type: betType,
            target: targetValue,
            timeframe,
            minBet,
            maxBet,
            createdAt: now,
            expiresAt,
            status: 'active',
            totalPot: 0,
            participantCount: 0,
            participants: {
                yes: [],
                no: [],
            },
            rules: rules || 'Verified via Neynar API at deadline.',
        };

        // Save to Redis
        await store.saveBet(bet);

        return NextResponse.json({
            success: true,
            betId,
            bet,
        });
    } catch (error) {
        console.error('Error in /api/admin/bets/create:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create bet' },
            { status: 500 }
        );
    }
}

