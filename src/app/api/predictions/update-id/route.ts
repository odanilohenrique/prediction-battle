
import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
    try {
        const { oldId, newId } = await req.json();

        if (!oldId || !newId) {
            return NextResponse.json({ success: false, error: 'Missing oldId or newId' }, { status: 400 });
        }

        console.log(`[UPDATE-ID] Syncing ID from ${oldId} to ${newId}`);

        // 1. Get existing bet
        const bet = await store.getBet(oldId);
        if (!bet) {
            return NextResponse.json({ success: false, error: 'Bet not found' }, { status: 404 });
        }

        // 2. Clone and Update ID
        const newBet = { ...bet, id: newId };

        // 3. Save new bet
        await store.saveBet(newBet);

        // 4. Delete old bet
        await store.deleteBet(oldId);

        console.log(`[UPDATE-ID] Successfully swapped ID.`);

        revalidatePath('/');

        return NextResponse.json({ success: true, oldId, newId });

    } catch (error) {
        console.error('[UPDATE-ID] Error:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
