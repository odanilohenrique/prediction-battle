
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { isAdmin } from '@/lib/config';

export async function POST(request: Request) {
    try {
        // basic auth check (can be improved)
        // For now, we assume this is called by admin/dev

        const bets = await store.getBets();
        if (bets.length <= 1) {
            return NextResponse.json({ success: true, message: 'Nothing to clean up (0 or 1 bet found)' });
        }

        // Sort by creation time descending (newest first)
        const sorted = bets.sort((a, b) => b.createdAt - a.createdAt);

        // Keep the first one
        const latestInfo = sorted[0];
        const toDelete = sorted.slice(1);

        console.log(`[CLEANUP] Keeping latest bet: ${latestInfo.id} (${(latestInfo as any).targetName || (latestInfo as any).question || (latestInfo as any).title || 'Untitled'})`);
        console.log(`[CLEANUP] Deleting ${toDelete.length} old bets...`);

        for (const bet of toDelete) {
            await store.deleteBet(bet.id);
            console.log(`[CLEANUP] Deleted ${bet.id}`);
        }

        return NextResponse.json({
            success: true,
            deletedCount: toDelete.length,
            keptId: latestInfo.id
        });

    } catch (error) {
        console.error('[CLEANUP] Error:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
