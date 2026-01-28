import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { createPublicClient, http } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import { CURRENT_CONFIG } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';

export const dynamic = 'force-dynamic';

// Create a public client for reading contract state
const publicClient = createPublicClient({
    chain: CURRENT_CONFIG.chainId === 84532 ? baseSepolia : base,
    transport: http(CURRENT_CONFIG.rpcUrl),
});

// Helper to fetch on-chain state for a single market
async function getOnChainState(marketId: string): Promise<number> {
    try {
        const data = await publicClient.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'markets',
            args: [marketId],
        }) as any[];

        // Index 6 is the 'state' field in the V5/V6 struct
        return Array.isArray(data) ? Number(data[6]) : -1;
    } catch (error) {
        console.error(`[API BETS] Failed to fetch on-chain state for ${marketId}:`, error);
        return -1; // Return -1 if contract read fails (e.g., market not on chain)
    }
}

export async function GET() {
    try {
        const bets = await store.getBets();

        // Fetch on-chain state for all bets in parallel
        const betsWithOnChainState = await Promise.all(
            bets.map(async (bet) => {
                const onChainState = await getOnChainState(bet.id);
                return { ...bet, onChainState };
            })
        );

        // Calculate stats
        const stats = {
            totalBets: betsWithOnChainState.length,
            activeBets: betsWithOnChainState.filter(b => b.status === 'active').length,
            disputedBets: betsWithOnChainState.filter(b => b.onChainState === 3).length, // DISPUTED = 3
            totalVolume: betsWithOnChainState.reduce((sum, b) => sum + b.totalPot, 0),
            totalFees: betsWithOnChainState.reduce((sum, b) => sum + (b.totalPot * 0.2), 0),
        };
        console.log(`[API BETS] Returning ${betsWithOnChainState.length} bets with on-chain state. Stats: ${JSON.stringify(stats)}`);

        return NextResponse.json({
            success: true,
            bets: betsWithOnChainState,
            stats,
            _fetchedAt: new Date().toISOString(), // Debug timestamp
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (error) {
        console.error('Error in /api/admin/bets:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch bets' },
            { status: 500 }
        );
    }
}
