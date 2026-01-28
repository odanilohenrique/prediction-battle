import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { isPredictionResolved } from '@/lib/contracts';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
    try {
        const { betId } = await req.json();

        if (!betId) {
            return NextResponse.json({ success: false, error: 'Missing betId' }, { status: 400 });
        }

        const bet = await store.getBet(betId);
        if (!bet) {
            return NextResponse.json({ success: false, error: 'Bet not found' }, { status: 404 });
        }

        // Only sync if DB says active (or not completed)
        if (bet.status !== 'active') {
            return NextResponse.json({ success: true, message: 'Bet already completed in DB', status: bet.status });
        }

        // Check On-Chain
        const isResolvedOnChain = await isPredictionResolved(betId);

        if (isResolvedOnChain) {
            console.log(`[SYNC] Bet ${betId} found RESOLVED on-chain but ACTIVE in DB. Syncing...`);

            // We don't know the result (YES/NO) easily without more queries, 
            // but for now we can atleast mark it as 'completed' and maybe 'resolved'.
            // Ideally we should know the winner. 
            // For V5 strictness, we might want to query `markets` struct to get the result if we want to be precise.
            // But usually 'status: completed' is enough to unblock the UI.

            // NOTE: To be safe, we might want to fetch the result too if we want to populate 'bet.result'.
            // For now, let's just mark status. The claim button calculates payout based on on-chain shares anyway.

            bet.status = 'completed';
            // We keep bet.result as is (likely undefined) or we could try to fetch it.
            // But simplistic sync is better than nothing.

            await store.saveBet(bet);

            revalidatePath('/');
            revalidatePath('/admin');

            return NextResponse.json({ success: true, synced: true });
        } else {
            return NextResponse.json({ success: true, synced: false, message: 'On-chain market is also active' });
        }

    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
