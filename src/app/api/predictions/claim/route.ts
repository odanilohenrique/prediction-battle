import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: NextRequest) {
    try {
        const { betId, userAddress } = await req.json();

        if (!betId || !userAddress) {
            return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
        }

        const bet = await store.getBet(betId);
        if (!bet) {
            return NextResponse.json({ success: false, error: 'Bet not found' }, { status: 404 });
        }

        // Find user in participants and mark as paid/claimed
        let updated = false;

        // Helper to update list
        const updateList = (list: any[]) => {
            return list.map(p => {
                if (p.address.toLowerCase() === userAddress.toLowerCase()) {
                    updated = true;
                    return { ...p, paid: true, claimedAt: Date.now() };
                }
                return p;
            });
        };

        bet.participants.yes = updateList(bet.participants.yes);
        bet.participants.no = updateList(bet.participants.no);

        if (updated) {
            await store.saveBet(bet);
            return NextResponse.json({ success: true, message: 'Claim registered' });
        } else {
            return NextResponse.json({ success: false, error: 'User not found in participants' }, { status: 404 });
        }

    } catch (error) {
        console.error('Claim API Error:', error);
        return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
    }
}
