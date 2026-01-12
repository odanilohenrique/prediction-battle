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
            // Allow bypassing auth in development if needed, or strictly enforce
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

        // 3. Loop and Verify
        for (const bet of activeBets) {
            let verified = false;
            let currentVal: number | string = 0;
            let finalResult: boolean | null = null;
            const expired = Date.now() > bet.expiresAt;

            // EXCEPTION: Battles are manual for now, unless expired
            if (bet.optionA && bet.optionB) {
                // If expired, we can't auto-decide winner without data.
                // For now, only standard bets are auto-resolvable.
                // TODO: Add Battle Verification Logic
                if (!expired) {
                    continue; // Skip if not expired
                }
                // If expired, battles might need manual intervention or default "draw/no"?
                // Let's leave battles as manual trigger only for safety to avoid resolving wrong.
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

                    if (!alreadyResolved) {
                        await resolvePredictionOnChain(bet.id, finalResult);
                        // Wait slightly for propagation if needed (viem waitForReceipt should be enough)
                        await new Promise(r => setTimeout(r, 2000));
                    } else {
                        console.log(`[CRON] Bet ${bet.id} already resolved on-chain. Proceeding to payout.`);
                    }

                    // 4.3 Trigger Payout (Distribute Winnings)
                    // Always try to distribute if we are in this block
                    let distributionTx: string | undefined;
                    try {
                        distributionTx = await distributeWinningsOnChain(bet.id, 50);
                    } catch (distError: any) {
                        console.warn(`[CRON] Distribution warning for ${bet.id}: ${distError.message}`);
                    }

                    // 4.4 Update DB
                    bet.result = finalResult ? 'yes' : 'no';
                    bet.status = 'completed';

                    // Update fees
                    const totalFeePercentage = 0.20;
                    bet.feeAmount = bet.totalPot * totalFeePercentage;
                    bet.winnerPool = bet.totalPot - bet.feeAmount;
                    bet.protocolFeeAmount = bet.feeAmount;
                    bet.creatorFeeAmount = 0;

                    // 4.5 Mark winners as PAID if distribution succeeded
                    if (distributionTx) {
                        const winOption = finalResult ? 'yes' : 'no';
                        if (bet.participants && bet.participants[winOption]) {
                            bet.participants[winOption] = bet.participants[winOption].map((p: any) => ({
                                ...p,
                                paid: true,
                                txHash: distributionTx
                            }));
                        }
                    }
                    bet.creatorFeeAmount = 0;

                    await store.saveBet(bet);
                    results.push({ id: bet.id, result: finalResult ? 'RESOLVED_YES' : 'RESOLVED_NO', tx: 'OnChain Success' });

                } catch (chainError) {
                    console.error(`[CRON] Chain action failed for ${bet.id}:`, chainError);
                    results.push({ id: bet.id, error: String(chainError) });
                }
            } else {
                results.push({ id: bet.id, result: 'PENDING', current: currentVal });
            }
        }

        return NextResponse.json({ success: true, processed: activeBets.length, results });

    } catch (error) {
        console.error('Cron Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
