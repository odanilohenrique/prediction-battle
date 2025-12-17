import { NextRequest, NextResponse } from 'next/server';
import { store, Bet } from '@/lib/store';
import { getUserByUsername } from '@/lib/neynar';

// Timeframe mappings in milliseconds
const TIMEFRAME_MS: Record<string, number> = {
    '30m': 30 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
};

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
            // Manual user profile input (optional - overrides Neynar)
            displayName: manualDisplayName,
            pfpUrl: manualPfpUrl,
            // Custom & Versus options
            customQuestion,
            optionA,
            optionB,
        } = body;

        // Validate input (custom_text doesn't need targetValue)
        if (!username || !betType || !timeframe) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Try to fetch Farcaster profile data (unless manual data provided)
        let userData = null;
        if (!manualDisplayName && !manualPfpUrl) {
            userData = await getUserByUsername(username);
        }

        // Create bet ID
        const betId = `admin_bet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const now = Date.now();
        const expiresAt = now + (TIMEFRAME_MS[timeframe] || TIMEFRAME_MS['24h']);

        const bet: Bet = {
            id: betId,
            username: userData?.username || username,
            displayName: manualDisplayName || userData?.displayName,
            pfpUrl: manualPfpUrl || userData?.pfpUrl,
            fid: userData?.fid,
            type: betType,
            target: targetValue || 0, // Default to 0 if not provided (custom_text)
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
            rules: rules || 'Verified manually by admin at deadline.',
            // Map custom question to castText for display
            castText: customQuestion,
            optionA,
            optionB,
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
