import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: Request) {
    try {
        const { adminAddress } = await req.json();

        // Basic admin check (client side mostly for now, but good practice to expect it)
        // if (!isAdmin(adminAddress)) ... 

        console.log(`[DELETE ALL] Request to NUKE all bets`);

        await store.deleteAllBets();
        console.log(`[DELETE ALL] All bets deleted successfully.`);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting all bets:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
