
import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { verifyAdminFromBody } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
    try {
        const { betId, userId, txHash, adminAddress } = await req.json();

        // SECURITY: Verify admin
        const authError = verifyAdminFromBody(adminAddress);
        if (authError) return authError;

        if (!betId || !userId) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const bet = await store.getBet(betId);
        if (!bet) {
            return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
        }

        let found = false;

        const updateList = (list: any[]) => {
            return list.map(p => {
                if (p.userId && p.userId.toLowerCase() === userId.toLowerCase()) {
                    found = true;
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
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
