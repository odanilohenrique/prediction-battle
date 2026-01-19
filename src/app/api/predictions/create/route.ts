import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { store, Bet, BetParticipant } from '@/lib/store';

export async function POST(request: NextRequest) {
    console.log('[API CREATE] Received create request!');
    try {
        const body = await request.json();
        console.log('[API CREATE] Parsing body...', JSON.stringify(body).slice(0, 100));
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
            maxEntrySize,
            minBet, // Accepted from client
            displayName, // Manual override
            pfpUrl, // Manual override
            wordToMatch, // For word_mentions type
            isVersus, // Battle mode flag
            optionA, // { label, imageUrl } for Player A
            optionB, // { label, imageUrl } for Player B
            timeframe, // Accepted from client
            predictionImage, // Optional image
            castUrl, // Optional Cast URL
            autoVerify, // [NEW] Admin switch for auto-verification
        } = body;

        // Use wallet address as user ID if provided, otherwise fallback
        const userId = userAddress || 'demo_user';

        // Validate input
        // Validate input
        if (!castHash) return NextResponse.json({ success: false, error: 'Missing required field: castHash' }, { status: 400 });
        if (!metric) return NextResponse.json({ success: false, error: 'Missing required field: metric' }, { status: 400 });
        // targetValue can be 0 for subjective bets, so we check for undefined/null
        if (targetValue === undefined || targetValue === null) return NextResponse.json({ success: false, error: 'Missing required field: targetValue' }, { status: 400 });
        if (!choice) return NextResponse.json({ success: false, error: 'Missing required field: choice' }, { status: 400 });
        if (!betAmount) return NextResponse.json({ success: false, error: 'Missing required field: betAmount' }, { status: 400 });

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
            // CREATE NEW BATTLE (Permissionless with Anti-Spam Liquidity)
            betId = `pred_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const now = Date.now();

            // Calculate Expiration
            const TIMEFRAME_MS: Record<string, number> = {
                '30m': 30 * 60 * 1000,
                '6h': 6 * 60 * 60 * 1000,
                '12h': 12 * 60 * 60 * 1000,
                '24h': 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000,
                'none': 100 * 365 * 24 * 60 * 60 * 1000, // 100 years
            };
            const selectedTimeframe = timeframe || '24h';
            const duration = TIMEFRAME_MS[selectedTimeframe] || TIMEFRAME_MS['24h'];
            const expiresAt = now + duration;

            // LIQUIDITY CHECK (Anti-Spam)
            // Creator must seed 1x Max Entry on YES and 1x Max Entry on NO
            const entryLimit = maxEntrySize || 10; // Default to 10 if not specified
            const requiredSeed = entryLimit * 2;

            if (betAmount < requiredSeed) {
                return NextResponse.json(
                    { success: false, error: `You must seed initial liquidity (${requiredSeed} total) to start a battle (2x Max Entry).` },
                    { status: 400 }
                );
            }

            bet = {
                id: betId,
                username: castAuthor || 'unknown',
                displayName: displayName || castAuthor, // Fallback to username
                pfpUrl: pfpUrl || '',
                type: metric,
                target: targetValue,
                timeframe: selectedTimeframe,
                minBet: minBet || 0.05, // Default to 0.05 if not provided
                maxBet: entryLimit, // Set Max Entry Size
                createdAt: now,
                expiresAt,
                status: 'active',
                totalPot: requiredSeed, // Initial Pot is the Seed
                participantCount: 0, // Starts at 0 (Seed doesn't count as user participant)
                participants: {
                    yes: [],
                    no: [],
                },
                castHash,
                castAuthor,
                castText,
                castUrl, // Saved here
                initialValue: requiredSeed, // CRITICAL: This is the seed amount used for multiplier calculation
                creatorAddress: userId, // Store creator wallet for fee splitting
                wordToMatch: wordToMatch || undefined,
                // Battle Mode specifics
                isVersus: isVersus || false,
                optionA: optionA || undefined,
                optionB: optionB || undefined,
                predictionImage: predictionImage || undefined,

                // [NEW] Automated Verification
                verification: autoVerify ? {
                    enabled: true,
                    type: (metric === 'likes_total' ? 'likes' :
                        metric === 'followers_gain' ? 'followers' :
                            metric === 'word_mentions' ? 'keyword' :
                                metric === 'comment_count' ? 'replies' :
                                    metric === 'quotes' ? 'recasts' : 'likes'), // Default fallback
                    target: targetValue,
                    url: castUrl || undefined,
                    username: castAuthor, // For follower checks
                    wordToMatch: wordToMatch,
                } : undefined
            };

            // Seed Liquidity (Dead Liquidity) is tracked via initialValue/totalPot
            // We do NOT add the creator as a participant because V2 seed does not generate shares.
            // Creator only gets fees, not payout from the seed itself.
        }

        // Save to Redis
        console.log('[API CREATE] Saving bet to Redis:', JSON.stringify({
            id: bet.id,
            creatorAddress: bet.creatorAddress,
            status: bet.status,
            expiresAt: bet.expiresAt,
            expiresAtHuman: new Date(bet.expiresAt).toISOString(),
            timeframe: bet.timeframe
        }));

        try {
            await store.saveBet(bet);
            console.log('[API CREATE] ✅ Bet saved successfully to Redis!');
        } catch (saveError) {
            console.error('[API CREATE] ❌ REDIS SAVE FAILED:', saveError);
            throw saveError;
        }

        // Purge cache for key pages
        revalidatePath('/');
        revalidatePath('/admin');
        revalidatePath('/admin/monitor');

        return NextResponse.json({
            success: true,
            predictionId: bet.id,
            prediction: bet,
            message: `Bet saved with expiresAt: ${new Date(bet.expiresAt).toISOString()}`
        });

    } catch (error) {
        console.error('Error in /api/predictions/create:', error);
        return NextResponse.json(
            {
                success: false,
                error: `Failed to create prediction: ${(error as Error).message}`,
                details: JSON.stringify(error)
            },
            { status: 500 }
        );
    }
}
