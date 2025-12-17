
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: Request) {
    try {
        const { betId, userId, txHash } = await req.json();

        if (!betId || !userId) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const bet = await store.getBet(betId);
        if (!bet) {
            return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
        }

        // Find participant in both lists (though they should be in the winning side)
        let found = false;

        // Helper to update list
        const updateList = (list: any[]) => {
            return list.map(p => {
                if (p.userId.toLowerCase() === userId.toLowerCase()) {
                    found = true;
                    // Preserve existing data, only update paid status
                    return { ...p, paid: true, txHash };
                }
                return p;
            });
        };

        bet.participants.yes = updateList(bet.participants.yes);
        bet.participants.no = updateList(bet.participants.no);

        if (!found) {
            return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
        }

        await store.saveBet(bet);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error marking paid:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
