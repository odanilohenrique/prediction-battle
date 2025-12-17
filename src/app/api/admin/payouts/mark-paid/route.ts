
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: Request) {
    try {
        const { betId, userId, txHash } = await req.json();

        if (!betId || !userId) {
            console.error('Missing fields in mark-paid:', { betId, userId });
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        console.log(`[MarkPaid] Attempting to mark ${userId} as paid for bet ${betId}, tx: ${txHash}`);

        const bet = await store.getBet(betId);
        if (!bet) {
            console.error(`[MarkPaid] Bet not found: ${betId}`);
            return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
        }

        // Find participant in both lists (though they should be in the winning side)
        let found = false;

        // Helper to update list
        const updateList = (list: any[]) => {
            return list.map(p => {
                // Ensure case-insensitive comparison
                if (p.userId && p.userId.toLowerCase() === userId.toLowerCase()) {
                    found = true;
                    console.log(`[MarkPaid] Found participant ${p.userId}, marking paid.`);
                    return { ...p, paid: true, txHash };
                }
                return p;
            });
        };

        bet.participants.yes = updateList(bet.participants.yes);
        bet.participants.no = updateList(bet.participants.no);

        if (!found) {
            console.error(`[MarkPaid] Participant ${userId} not found in bet ${betId}`);
            return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
        }

        await store.saveBet(bet);
        console.log(`[MarkPaid] Successfully saved bet ${betId}`);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error marking paid:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
