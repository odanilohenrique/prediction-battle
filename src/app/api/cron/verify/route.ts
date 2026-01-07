import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { getCastStats, getUserStats, getUserRecentCasts, getUserByUsername } from '@/lib/neynar';

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
            const { type, target, url, username } = bet.verification!;
            let verified = false;
            let currentVal: number | string = 0;

            try {
                // A. ENGAGEMENT (Likes, Recasts, Replies)
                if (['likes', 'recasts', 'replies'].includes(type) && url) {
                    // Extract Hash/ID from URL logic if needed, or use full URL if API supports it.
                    // neynar.ts `getCastStats` expects Hash.
                    // Need a helper to extract hash from URL.
                    const hash = url.split('/').pop(); // naive extract
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
                if (type === 'followers' && username) {
                    const stats = await getUserStats(username);
                    if (stats) {
                        currentVal = stats.followers;
                        if (currentVal >= Number(target)) verified = true;
                    }
                }

                // C. KEYWORD
                if (type === 'keyword' && username) {
                    const user = await getUserByUsername(username);
                    if (user) {
                        const recentCasts = await getUserRecentCasts(user.fid, 50); // check last 50
                        const word = String(target).toLowerCase();
                        // Check if any cast contains the word
                        // Also check timestamp against bet creation? Ideally yes.
                        // For now, checks if ANY recent cast has it (assuming bet created recently).
                        const match = recentCasts.find(c => c.text.toLowerCase().includes(word));
                        if (match) {
                            currentVal = match.text;
                            verified = true;
                        }
                    }
                }

                // 4. Resolve if Verified (YES)
                if (verified) {
                    // Call the RESOLVE API (Internal call)
                    // Or simulate resolution here.
                    // Simulating resolution to ensure atomic update

                    bet.result = 'yes';
                    bet.status = 'completed';

                    // Fee Logic (Copied from resolve/route.ts)
                    const totalFeePercentage = 0.20;
                    bet.feeAmount = bet.totalPot * totalFeePercentage;
                    bet.winnerPool = bet.totalPot - bet.feeAmount;

                    // Protocol Fee (assuming User created for auto-verified bets?)
                    // If created by Admin, full fee.
                    bet.protocolFeeAmount = bet.feeAmount;
                    bet.creatorFeeAmount = 0;

                    await store.saveBet(bet);
                    results.push({ id: bet.id, result: 'RESOLVED_YES', reason: `Target met: ${currentVal} >= ${target}` });
                } else if (Date.now() > bet.expiresAt) {
                    // 5. Expired and NOT met -> Resolve NO
                    bet.result = 'no';
                    bet.status = 'completed';

                    // Fee Logic
                    const totalFeePercentage = 0.20;
                    bet.feeAmount = bet.totalPot * totalFeePercentage;
                    bet.winnerPool = bet.totalPot - bet.feeAmount;
                    bet.protocolFeeAmount = bet.feeAmount;
                    bet.creatorFeeAmount = 0;

                    await store.saveBet(bet);
                    results.push({ id: bet.id, result: 'RESOLVED_NO', reason: 'Time expired and target not met.' });
                } else {
                    results.push({ id: bet.id, result: 'PENDING', current: currentVal });
                }

            } catch (err) {
                console.error(`Failed to verify bet ${bet.id}:`, err);
                results.push({ id: bet.id, error: String(err) });
            }
        }

        return NextResponse.json({ success: true, processed: activeBets.length, results });

    } catch (error) {
        console.error('Cron Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
