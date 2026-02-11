
import { NextResponse } from 'next/server';
import { store, Bet } from '@/lib/store';
import { createPublicClient, http } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';
import { CURRENT_CONFIG } from '@/lib/config';

const publicClient = createPublicClient({
    chain: process.env.NEXT_PUBLIC_USE_MAINNET === 'true' ? base : baseSepolia,
    transport: http(),
});

export async function POST(request: Request) {
    try {
        const { betId, userId, action } = await request.json();

        if (!betId) {
            return NextResponse.json({ success: false, error: 'Missing betId' }, { status: 400 });
        }

        // Fetch existing bet from Vercel KV via Store
        const bet = await store.getBet(betId);
        if (!bet) {
            return NextResponse.json({ success: false, error: 'Prediction not found in DB' }, { status: 404 });
        }

        let updated = false;

        // ==========================================
        // ACTION: MARK AS PAID (User Claimed)
        // ==========================================
        if (action === 'mark_paid' && userId) {
            if (bet.participants) {
                // Check YES bets
                const yesIdx = bet.participants.yes.findIndex((p) => p.userId === userId);
                if (yesIdx !== -1) {
                    bet.participants.yes[yesIdx].paid = true;
                    // bet.participants.yes[yesIdx].claimedAt = Date.now(); // 'claimedAt' not in BetParticipant interface yet, check store.ts
                    updated = true;
                }

                // Check NO bets
                const noIdx = bet.participants.no.findIndex((p) => p.userId === userId);
                if (noIdx !== -1) {
                    bet.participants.no[noIdx].paid = true;
                    updated = true;
                }
            }

            if (updated) {
                await store.saveBet(bet);
                return NextResponse.json({ success: true, message: 'User marked as paid' });
            } else {
                return NextResponse.json({ success: false, error: 'User bet not found' }, { status: 404 });
            }
        }

        // ==========================================
        // ACTION: GLOBAL SYNC (Default)
        // ==========================================

        // 1. Fetch On-Chain Data
        const contractAddress = CURRENT_CONFIG.contractAddress as `0x${string}`;
        if (!contractAddress) throw new Error("Contract address not configured");

        const marketData = await publicClient.readContract({
            address: contractAddress,
            abi: PredictionBattleABI.abi,
            functionName: 'markets',
            args: [betId],
        }) as any[];

        // Market Struct V9 Indices:
        // 6: State (0=Open, 1=Locked, 2=Proposed, 3=Disputed, 4=Resolved)
        // 7: Outcome (0=Pending, 1=Yes, 2=No, 3=Draw, 4=Cancelled)

        const state = Number(marketData[6]);
        const outcome = Number(marketData[7]);

        let dbStatus: 'active' | 'completed' = 'active'; // Types from store.ts
        let dbResult: 'yes' | 'no' | 'void' | undefined = undefined; // Types from store.ts

        if (state === 4) { // RESOLVED
            dbStatus = 'completed';
            if (outcome === 1) dbResult = 'yes';
            else if (outcome === 2) dbResult = 'no';
            else if (outcome === 3) dbResult = 'void'; // Map DRAW to VOID in DB if DB types don't support 'draw'? 
            // Types.ts had 'draw', but Store interface (lines 18 & 51) has 'yes' | 'no' | 'void'.
            // Vercel KV stores JSON, so we can store 'draw' but TS might complain if we use strict types.
            // Let's force cast to avoid type errors, but store 'draw'.
            else if (outcome === 4) dbResult = 'void';

            // Handle 'draw' specifically
            if (outcome === 3) {
                dbResult = 'draw' as any; // Allow draw storage
            }
        } else if (state === 1) {
            // Locked is still 'active' in DB usually, or maybe we want a 'locked' status?
            // Store interface only has 'active' | 'completed'.
            dbStatus = 'active';
        }

        // Only update if changed
        if (bet.status !== dbStatus || bet.result !== dbResult) {
            bet.status = dbStatus;
            bet.result = dbResult;
            bet.resolvedAt = Date.now(); // Update timestamp
            updated = true;
        }

        if (updated) {
            await store.saveBet(bet);
        }

        return NextResponse.json({
            success: true,
            synced: true,
            data: { status: dbStatus, result: dbResult }
        });

    } catch (error) {
        console.error('Sync Error:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
