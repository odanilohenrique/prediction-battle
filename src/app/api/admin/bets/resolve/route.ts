import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { store, Bet } from '@/lib/store';
import { isAdmin } from '@/lib/config';
import { resolvePredictionOnChain, isPredictionResolved, resolveVoidOnChain } from '@/lib/contracts';

export async function POST(req: NextRequest) {
    try {
        const { betId, result } = await req.json();

        if (!betId || (result !== 'yes' && result !== 'no' && result !== 'void')) {
            return NextResponse.json({ success: false, error: 'Invalid parameters. Result must be "yes", "no", or "void".' }, { status: 400 });
        }

        // 1. Fetch the Bet
        const bet = await store.getBet(betId);

        if (!bet) {
            return NextResponse.json({ success: false, error: 'Bet not found' }, { status: 404 });
        }

        if (bet.status !== 'active') {
            return NextResponse.json({ success: false, error: 'Bet is already completed' }, { status: 400 });
        }

        const winBool = result === 'yes';

        try {
            // 2. Execute On-Chain Logic (V2: resolveMarket / voidMarket)
            const alreadyResolved = await isPredictionResolved(betId);

            if (alreadyResolved) {
                console.log(`[ADMIN] Bet ${betId} already resolved on-chain. Skipping tx.`);
            } else {
                if (result === 'void') {
                    console.log(`[ADMIN] Voiding ${betId} manually via voidMarket`);
                    await resolveVoidOnChain(betId);
                } else {
                    console.log(`[ADMIN] Resolving ${betId} manually via resolveMarket -> ${result}`);
                    await resolvePredictionOnChain(betId, winBool);
                }
            }

            // V2 NOTE: Distribution is user-initiated via claimReward()
            // No batch distributeWinnings in V2 - each user claims their own reward
            console.log(`[ADMIN] Market ${betId} resolved. Users can now call claimReward().`);

        } catch (chainError) {
            console.error('Blockchain Resolution Failed:', chainError);
            // Check if it's "already resolved" - if so, still update DB
            const errorMsg = String(chainError).toLowerCase();
            if (errorMsg.includes('already') || errorMsg.includes('resolved')) {
                console.log(`[ADMIN] Bet ${betId} was already resolved. Continuing to update DB.`);
            } else {
                return NextResponse.json({ success: false, error: `Blockchain Error: ${chainError}` }, { status: 500 });
            }
        }

        // 3. Update Status in DB
        bet.result = result;
        bet.status = 'completed';

        // Calculate Fees (Record keeping only, contract handles real funds)
        const totalFeePercentage = 0.20;
        bet.feeAmount = bet.totalPot * totalFeePercentage;
        bet.winnerPool = bet.totalPot - bet.feeAmount;

        const creatorIsAdmin = bet.creatorAddress ? isAdmin(bet.creatorAddress) : true;

        if (creatorIsAdmin) {
            bet.protocolFeeAmount = bet.feeAmount;
            bet.creatorFeeAmount = 0;
        } else {
            bet.protocolFeeAmount = bet.totalPot * 0.15;
            bet.creatorFeeAmount = bet.totalPot * 0.05;
        }

        // 4. Save
        await store.saveBet(bet);

        // Purge cache
        revalidatePath('/');
        revalidatePath('/admin');
        revalidatePath('/admin/monitor');
        revalidatePath('/admin/payouts');

        return NextResponse.json({ success: true, bet });
    } catch (error) {
        console.error('Error resolving bet:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
