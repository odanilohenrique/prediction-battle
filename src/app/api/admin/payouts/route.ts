import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const bets = await store.getBets();

        // Filter for completed bets that have results
        const completedBets = bets.filter(
            (b) => b.status === 'completed' && b.result
        ).sort((a, b) => b.createdAt - a.createdAt);

        return NextResponse.json({
            success: true,
            payouts: completedBets
        });
    } catch (error) {
        console.error('Error fetching payouts:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch payouts' },
            { status: 500 }
        );
    }
}
