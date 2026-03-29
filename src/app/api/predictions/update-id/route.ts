
import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { revalidatePath } from 'next/cache';
import { verifyAdminFromBody } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
    try {
        const { oldId, newId, adminAddress } = await req.json();

        // SECURITY: Verify admin
        const authError = verifyAdminFromBody(adminAddress);
        if (authError) return authError;

        if (!oldId || !newId) {
            return NextResponse.json({ success: false, error: 'Missing oldId or newId' }, { status: 400 });
        }

        const bet = await store.getBet(oldId);
        if (!bet) {
            return NextResponse.json({ success: false, error: 'Bet not found' }, { status: 404 });
        }

        const newBet = { ...bet, id: newId };
        await store.saveBet(newBet);
        await store.deleteBet(oldId);

        revalidatePath('/');

        return NextResponse.json({ success: true, oldId, newId });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
