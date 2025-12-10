import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const bets = await store.getBets();

        // Calculate stats
        const stats = {
            totalBets: bets.length,
            activeBets: bets.filter(b => b.status === 'active').length,
            totalVolume: bets.reduce((sum, b) => sum + b.totalPot, 0),
            totalFees: bets.reduce((sum, b) => sum + (b.totalPot * 0.2), 0),
        };

        return NextResponse.json({
            success: true,
            bets,
            stats,
        });
    } catch (error) {
        console.error('Error in /api/admin/bets:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch bets' },
            { status: 500 }
        );
    }
}
