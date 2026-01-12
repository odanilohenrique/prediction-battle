import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { getCastStats, getUserStats, getUserRecentCasts, getUserByUsername } from '@/lib/neynar';
import { resolvePredictionOnChain, distributeWinningsOnChain } from '@/lib/contracts';

export const dynamic = 'force-dynamic'; // Prevent caching

// Standard Cron authentication (optional, but good practice)
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
    try {
        // 1. Auth Check
        const authHeader = req.headers.get('authorization');
        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
            if (process.env.NODE_ENV === 'production') {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        // 2. Fetch Active Bets
        const allBets = await store.getBets();
        const activeBets = allBets.filter(b => b.status === 'active' && b.verification?.enabled);

        if (activeBets.length === 0) {
            return NextResponse.json({ success: true, message: 'No verify-enabled active bets found.' });
        }

        const results = [];

        // LIMIT BATCH SIZE to avoid timeouts (Vercel Hobby 10s limit)
        // Since we run daily, we process up to 10. 
        // With fire-and-forget, this should be very fast.
        const BATCH_LIMIT = 10;
        const processList = activeBets.slice(0, BATCH_LIMIT);

        // 3. Loop and Verify
        for (const bet of processList) {
            let verified = false;
            let currentVal: number | string = 0;
            let finalResult: boolean | null = null;
            const expired = Date.now() > bet.expiresAt;

            // EXCEPTION: Battles are manual for now
            if (bet.optionA && bet.optionB) {
                if (!expired) continue;
                // If expired battle, we skip auto-resolution for safety
                results.push({ id: bet.id, result: 'SKIPPED_VERSUS', reason: 'Waiting for manual resolution.' });
                continue;
            }

            // Standard Verification Logic
            if (bet.verification?.enabled) {
                const { type, target, url, username } = bet.verification;

                try {
                    // A. ENGAGEMENT
                    if (['likes', 'recasts', 'replies'].includes(type) && url) {
                        const hash = url.split('/').pop();
                        if (hash) {
                            const stats = await getCastStats(hash);
                            if (stats) {
                                if (type === 'likes') currentVal = stats.likes;
                                if (type === 'recasts') currentVal = stats.recasts;
                                if (type === 'replies') currentVal = stats.replies;
                                if (Number(currentVal) >= Number(target)) verified = true;
                            }
                        }
                    }
                    // B. FOLLOWERS
                    else if (type === 'followers' && username) {
                        const stats = await getUserStats(username);
                        if (stats) {
                            currentVal = stats.followers;
                            if (currentVal >= Number(target)) verified = true;
                        }
                    }
                    // C. KEYWORD
                    else if (type === 'keyword' && username) {
                        const user = await getUserByUsername(username);
                        if (user) {
                            const recentCasts = await getUserRecentCasts(user.fid, 50);
                            const word = String(target).toLowerCase();
                            const match = recentCasts.find(c => c.text.toLowerCase().includes(word));
                            if (match) {
                                currentVal = match.text;
                                verified = true;
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Verification check failed for ${bet.id}:`, e);
                }
            }

            // DECISION LOGIC
            if (verified) {
                finalResult = true; // YES won (Target Met)
            } else if (expired) {
                finalResult = false; // NO won (Time up & Target NOT Met)
            }

            // 4. Resolve On-Chain if result decided
            if (finalResult !== null) {
                console.log(`[CRON] Resolving Bet ${bet.id} -> ${finalResult ? 'YES' : 'NO'}`);

                try {
                    // Check if already resolved to allow retrying payouts
                    const { isPredictionResolved } = await import('@/lib/contracts');
                    const alreadyResolved = await isPredictionResolved(bet.id);

                    let resolveTxHash = undefined;

                    if (!alreadyResolved) {
                        // FIRE AND FORGET (waitForReceipt = false)
                        resolveTxHash = await resolvePredictionOnChain(bet.id, finalResult, false);
                        console.log(`[CRON] Resolution Tx Sent (No Wait): ${resolveTxHash}`);
                    } else {
                        console.log(`[CRON] Bet ${bet.id} already resolved on-chain.`);
                    }

                    // 4.4 Update DB Optimistically
                    // We assume the tx will succeed. The Payout Cron (running 15 mins later) will handle distribution.
                    bet.result = finalResult ? 'yes' : 'no';
                    bet.status = 'completed'; // Ready for Payout Cron
                    bet.resolvedAt = Date.now();
                    if (resolveTxHash) {
                        bet.resolutionTxHash = resolveTxHash;
                    }

                    // Calculate Fees (Local DB update)
                    const totalFeePercentage = 0.20;
                    bet.feeAmount = bet.totalPot * totalFeePercentage;
                    bet.winnerPool = bet.totalPot - bet.feeAmount;
                    bet.protocolFeeAmount = bet.feeAmount;
                    bet.creatorFeeAmount = 0;

                    await store.saveBet(bet);
                    results.push({ id: bet.id, result: finalResult ? 'RESOLVED_YES' : 'RESOLVED_NO', tx: resolveTxHash || 'Already Resolved' });

                } catch (chainError) {
                    console.error(`[CRON] Chain action failed for ${bet.id}:`, chainError);
                    results.push({ id: bet.id, error: String(chainError) });
                }
            } else {
                results.push({ id: bet.id, result: 'PENDING', current: currentVal });
            }
        }

        return NextResponse.json({ success: true, processed: processList.length, results });

    } catch (error) {
        console.error('Cron Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
