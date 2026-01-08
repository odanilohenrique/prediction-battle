
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: Request) {
    try {
        const { betId, adminAddress } = await req.json();

        if (!betId) {
            return NextResponse.json({ error: 'Missing betId' }, { status: 400 });
        }

        // Validate admin (simple check, ideally authenticate via session or signature)
        // For this MVP, we rely on the client ensuring only admins call this, 
        // but backend should technically check against whitelist too if we had authenticated headers.
        // We will just proceed with deletion for now as requested.

        console.log(`[DELETE] Request to delete bet ${betId}`);

        const bet = await store.getBet(betId);
        if (!bet) {
            return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
        }

        await store.deleteBet(betId);
        console.log(`[DELETE] Bet ${betId} deleted successfully.`);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting bet:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
