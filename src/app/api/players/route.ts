import { NextRequest, NextResponse } from 'next/server';
import { playerStore } from '@/lib/players';

export const dynamic = 'force-dynamic';

// GET - List all players or search
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        if (query) {
            const players = await playerStore.searchPlayers(query);
            return NextResponse.json({ success: true, players });
        }

        const players = await playerStore.getPlayers();
        return NextResponse.json({ success: true, players });
    } catch (error) {
        console.error('Error in /api/players:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch players' },
            { status: 500 }
        );
    }
}

// POST - Create or update a player
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, displayName, pfpUrl, fid } = body;

        if (!username) {
            return NextResponse.json(
                { success: false, error: 'Username is required' },
                { status: 400 }
            );
        }

        const player = await playerStore.savePlayer({
            username,
            displayName,
            pfpUrl,
            fid,
        });

        return NextResponse.json({ success: true, player });
    } catch (error) {
        console.error('Error in /api/players:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to save player' },
            { status: 500 }
        );
    }
}
