import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import { TESTNET_CONFIG, MAINNET_CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Shared ABI for distribution
const DISTRIBUTE_ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "_id", "type": "string" },
            { "internalType": "uint256", "name": "_batchSize", "type": "uint256" }
        ],
        "name": "distributeWinnings",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

export async function GET(req: NextRequest) {
    try {
        // 1. Auth Check (Optional but recommended)
        const authHeader = req.headers.get('authorization');
        const CRON_SECRET = process.env.CRON_SECRET;
        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
            if (process.env.NODE_ENV === 'production') {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        // 2. Fetch Completed but Unpaid Bets
        // We need a way to track "paid on chain". 
        // Currently AdminBet interfaces don't explicitly store "isPaidOnChain", 
        // but individual participants have "paid: boolean".
        // However, the contract distribution pays EVERYONE.
        // So we can check if ALL winners are marked paid? Or add a new flag 'payoutTxHash' to the bet.

        const allBets = await store.getBets();

        // Filter for:
        // - Status: 'completed'
        // - Result: 'yes' or 'no'
        // - Not yet fully paid (we'll check a flag or participant status)
        // - Has a predictionId (should rely on ID)

        // Let's assume we add a 'payoutTxHash' or 'payoutStatus' to the bet in the future.
        // For now, checks if any winners are NOT paid.

        const betsToPay = allBets.filter(b => {
            if (b.status !== 'completed') return false;
            if (!['yes', 'no'].includes(b.result || '')) return false;

            // Check if already processed
            // Ideally we should check KV store for a "payout_processed" flag to avoid double-spend attempts (though contract protects against it usually)
            // Simpler check: If all winners in local DB are marked "paid", skip.

            const winners = b.result === 'yes' ? b.participants.yes : b.participants.no;
            if (winners.length === 0) return false; // No winners to pay

            const allPaid = winners.every(w => w.paid);
            return !allPaid;
        });

        if (betsToPay.length === 0) {
            return NextResponse.json({ success: true, message: 'No pending payouts found.' });
        }

        // 3. Setup Wallet
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            return NextResponse.json({ success: false, error: 'Server configuration error: Missing Private Key' }, { status: 500 });
        }

        const isMainnet = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
        const chain = isMainnet ? base : baseSepolia;
        const rpcUrl = isMainnet ? MAINNET_CONFIG.rpcUrl : TESTNET_CONFIG.rpcUrl;
        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const client = createWalletClient({
            account,
            chain,
            transport: http(rpcUrl)
        }).extend(publicActions);

        const results = [];

        // 4. Process Payouts (One by one to avoid nonce issues / timeouts)
        // Limit to 5 per run to be safe
        const BATCH_LIMIT = 5;
        const processList = betsToPay.slice(0, BATCH_LIMIT);

        for (const bet of processList) {
            try {
                console.log(`[AutoPayout] Processing ${bet.id}...`);

                // Call Contract
                // FIRE AND FORGET (waitForReceipt = false)
                // We use the shared helper which we updated
                const { distributeWinningsOnChain } = await import('@/lib/contracts');
                const txHash = await distributeWinningsOnChain(bet.id, 50, false);

                console.log(`[AutoPayout] Tx Sent (No Wait): ${txHash}`);

                // Update Local DB immediately to mark as processing/paid
                const winners = bet.result === 'yes' ? bet.participants.yes : bet.participants.no;
                const updatedWinners = winners.map((w: any) => ({ ...w, paid: true, paidAt: Date.now(), txHash }));

                if (bet.result === 'yes') {
                    bet.participants.yes = updatedWinners;
                } else {
                    bet.participants.no = updatedWinners;
                }

                await store.saveBet(bet);
                results.push({ id: bet.id, status: 'initiated', txHash });

                // Wait a bit to prevent nonce overlap if RPC is slow
                // Reduced to 1s to ensure we fit in 10s limit for 5 bets
                await new Promise(r => setTimeout(r, 1000));

            } catch (error: any) {
                console.error(`[AutoPayout] Failed ${bet.id}:`, error);

                // Handle "Nothing to distribute" or "Already paid" errors gracefully
                if (error.message?.includes('Nothing to distribute') || error.message?.includes('No winners')) {
                    // Mark as paid in DB so we don't retry
                    const winners = bet.result === 'yes' ? bet.participants.yes : bet.participants.no;
                    const updatedWinners = winners.map(w => ({ ...w, paid: true, paidAt: Date.now(), notes: 'Marked paid (contract said nothing to distribute)' }));
                    if (bet.result === 'yes') bet.participants.yes = updatedWinners;
                    else bet.participants.no = updatedWinners;
                    await store.saveBet(bet);
                    results.push({ id: bet.id, status: 'marked_paid_error', reason: 'Contract said nothing to distribute' });
                } else {
                    results.push({ id: bet.id, status: 'failed', error: error.message });
                }
            }
        }

        return NextResponse.json({ success: true, processed: processList.length, results });

    } catch (error) {
        console.error('AutoPayout Cron Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
