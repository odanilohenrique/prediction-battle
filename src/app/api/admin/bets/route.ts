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
// Helper to fetch on-chain state for a single market
async function getOnChainInfo(marketId: string): Promise<{ state: number, outcome: number }> {
    try {
        const data = await publicClient.readContract({
            address: CURRENT_CONFIG.contractAddress as `0x${string}`,
            abi: PredictionBattleABI.abi,
            functionName: 'markets',
            args: [marketId],
        }) as any[];

        // Index 6 is state, Index 7 is outcome (V9)
        return Array.isArray(data) ? {
            state: Number(data[6]),
            outcome: data[7] !== undefined ? Number(data[7]) : 0
        } : { state: -1, outcome: 0 };
    } catch (error) {
        console.error(`[API BETS] Failed to fetch on-chain info for ${marketId}:`, error);
        return { state: -1, outcome: 0 };
    }
}

export async function GET() {
    try {
        const bets = await store.getBets();

        // Fetch on-chain state for all bets in parallel
        const betsWithOnChainState = await Promise.all(
            bets.map(async (bet) => {
                const info = await getOnChainInfo(bet.id);
                return { ...bet, onChainState: info.state, onChainOutcome: info.outcome };
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
