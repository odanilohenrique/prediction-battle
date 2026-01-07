import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { store, Bet } from '@/lib/store';
import { getUserByUsername } from '@/lib/neynar';

// Timeframe mappings in milliseconds
const TIMEFRAME_MS: Record<string, number> = {
    '30m': 30 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    'none': 100 * 365 * 24 * 60 * 60 * 1000, // 100 years
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
            castHash: manualCastHash,
            castUrl,
            wordToMatch, // New field,
            predictionImage, // Optional image
        } = body;

        // Function to extract hash from URL
        // Function to extract hash from URL
        const extractHash = (url: string) => {
            if (!url) return null;
            try {
                // Examples:
                // https://warpcast.com/betashop.eth/0x7678633e
                // https://farcaster.xyz/betashop.eth/0x7678633e
                const parts = url.split('/');
                const lastPart = parts[parts.length - 1];
                if (lastPart && lastPart.startsWith('0x')) {
                    return lastPart;
                }
                return null;
            } catch (e) {
                console.error('Error parsing URL:', e);
                return null;
            }
        };

        const extractedCastHash = extractHash(castUrl);
        const finalCastHash = manualCastHash || extractedCastHash;


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
            castHash: finalCastHash,
            castUrl: castUrl || undefined,
            wordToMatch,
            predictionImage,
        };

        // Save to Redis
        await store.saveBet(bet);

        // Purge cache
        revalidatePath('/');
        revalidatePath('/admin');
        revalidatePath('/admin/monitor');
        revalidatePath('/admin/payouts');

        return NextResponse.json({
            success: true,
            betId,
            bet,
        });
    } catch (error) {
        console.error('Error in /api/admin/bets/create:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message || 'Failed to create bet' },
            { status: 500 }
        );
    }
}
