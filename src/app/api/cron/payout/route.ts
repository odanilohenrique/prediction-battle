import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // 1. Auth Check
        const authHeader = req.headers.get('authorization');
        const CRON_SECRET = process.env.CRON_SECRET;
        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
            if (process.env.NODE_ENV === 'production') {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        // 2. Fetch Completed but Unpaid Bets
        const allBets = await store.getBets();

        const betsToPay = allBets.filter(b => {
            if (b.status !== 'completed') return false;
            if (!['yes', 'no'].includes(b.result || '')) return false;

            const winners = b.result === 'yes' ? b.participants.yes : b.participants.no;
            if (winners.length === 0) return false;

            const allPaid = winners.every(w => w.paid);
            return !allPaid;
        });

        if (betsToPay.length === 0) {
            return NextResponse.json({ success: true, message: 'No pending payouts found.' });
        }

        const results = [];
        const BATCH_LIMIT = 5;
        const processList = betsToPay.slice(0, BATCH_LIMIT);

        for (const bet of processList) {
            try {
                console.log(`[AutoPayout] Processing ${bet.id}...`);

                // V2 Change: We no longer auto-distribute on chain. 
                // We just mark them as "paid" in our DB (or rather "resolved / available to claim")
                // so the cron doesn't keep picking them up.
                // Or better: We mark them as "claimable" but for now let's just mark paid to stop the cron loop.

                const winners = bet.result === 'yes' ? bet.participants.yes : bet.participants.no;

                // In V2, "paid" flag in DB means "Available to Claim" or "Claimed"
                // Since we can't easily track individual claims without events, 
                // we'll mark them as processed here so the cron moves on.
                const updatedWinners = winners.map((w: any) => ({
                    ...w,
                    paid: true,
                    paidAt: Date.now(),
                    notes: 'Marked as claimable (V2 user claim)'
                }));

                if (bet.result === 'yes') {
                    bet.participants.yes = updatedWinners;
                } else {
                    bet.participants.no = updatedWinners;
                }

                await store.saveBet(bet);
                results.push({ id: bet.id, status: 'marked_claimable' });

            } catch (error: any) {
                console.error(`[AutoPayout] Failed ${bet.id}:`, error);
                results.push({ id: bet.id, status: 'failed', error: error.message });
            }
        }

        return NextResponse.json({
            success: true,
            message: 'V2 Update: Marked bets as claimable (no auto-distribute)',
            processed: processList.length,
            results
        });

    } catch (error) {
        console.error('AutoPayout Cron Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
