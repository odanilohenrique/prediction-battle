import { NextRequest, NextResponse } from 'next/server';
import { store, Bet } from '@/lib/store';
import { isAdmin } from '@/lib/config';

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

        // Calculate Fees & Settlements
        // Taxa da Casa: 20% Total on Volume
        const totalFeePercentage = 0.20;
        bet.feeAmount = bet.totalPot * totalFeePercentage;
        bet.winnerPool = bet.totalPot - bet.feeAmount;

        // Fee Split Feature:
        // - If Admin created: 20% to Protocol.
        // - If User created: 15% to Protocol, 5% to Creator.
        const creatorIsAdmin = bet.creatorAddress ? isAdmin(bet.creatorAddress) : true; // Default to admin for legacy bets

        if (creatorIsAdmin) {
            bet.protocolFeeAmount = bet.feeAmount;
            bet.creatorFeeAmount = 0;
        } else {
            bet.protocolFeeAmount = bet.totalPot * 0.15; // 15% to Protocol
            bet.creatorFeeAmount = bet.totalPot * 0.05;  // 5% to User Creator
        }

        // 3. Save the updated bet
        await store.saveBet(bet);

        return NextResponse.json({ success: true, bet });
    } catch (error) {
        console.error('Error resolving bet:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
