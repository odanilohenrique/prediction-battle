import { NextResponse } from 'next/server';
import { getTrendingCasts } from '@/lib/neynar';

export async function GET() {
    try {
        const casts = await getTrendingCasts(20);

        return NextResponse.json({
            success: true,
            casts,
        });
    } catch (error) {
        console.error('Error in /api/casts/trending:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch trending casts' },
            { status: 500 }
        );
    }
}
