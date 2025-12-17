import { NextRequest, NextResponse } from 'next/server';
import { store, Bet } from '@/lib/store';

export async function POST(req: NextRequest) {
    try {
        const { betId, result } = await req.json();

        if (!betId || (result !== 'yes' && result !== 'no')) {
            return NextResponse.json({ success: false, error: 'Invalid parameters. Result must be "yes" or "no".' }, { status: 400 });
        }

        // 1. Fetch the Bet using the correct store method
        const bet = await store.getBet(betId);

        if (!bet) {
            return NextResponse.json({ success: false, error: 'Bet not found' }, { status: 404 });
        }

        if (bet.status !== 'active') {
            return NextResponse.json({ success: false, error: 'Bet is already completed' }, { status: 400 });
        }

        // 2. Set the winner and update status
        bet.result = result;
        bet.status = 'completed';

        // 3. Save the updated bet
        await store.saveBet(bet);

        return NextResponse.json({ success: true, bet });
    } catch (error) {
        console.error('Error resolving bet:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
