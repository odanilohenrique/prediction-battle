import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { isPredictionResolved, getOnChainMarketData } from '@/lib/contracts';
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
        const chainData = await getOnChainMarketData(betId);

        // 4 = RESOLVED
        if (chainData && chainData.state === 4) {
            console.log(`[SYNC] Bet ${betId} found RESOLVED on-chain. Syncing details...`);

            // Update Status
            bet.status = 'completed';

            // Update Result
            if (chainData.isVoid) {
                bet.result = 'void';
            } else {
                bet.result = chainData.result ? 'yes' : 'no';
            }

            await store.saveBet(bet);

            revalidatePath('/');
            revalidatePath('/admin');
            revalidatePath('/admin/payouts');

            return NextResponse.json({ success: true, synced: true, result: bet.result });
        } else {
            const stateMap = ['OPEN', 'LOCKED', 'PROPOSED', 'DISPUTED', 'RESOLVED'];
            const stateStr = chainData ? stateMap[chainData.state] : 'UNKNOWN';

            // If disputed (3), we might want to inform frontend but we assume sync is mostly for resolving stuck 'active' bets.
            return NextResponse.json({ success: true, synced: false, message: `On-chain market state is ${stateStr} (${chainData?.state})` });
        }

    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
