
import { NextResponse } from 'next/server';
import { store, Player } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const players = await store.getPlayers();
        return NextResponse.json({ success: true, players });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch players' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        if (body.players && Array.isArray(body.players)) {
            // Bulk Save
            await store.savePlayers(body.players);
            return NextResponse.json({ success: true, count: body.players.length });
        } else if (body.username) {
            // Single Save
            await store.savePlayer(body as Player);
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: 'Invalid data' }, { status: 400 });
        }
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to save player(s)' }, { status: 500 });
    }
}
