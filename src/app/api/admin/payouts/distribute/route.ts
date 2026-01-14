import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import { ABI } from '@/lib/abi/PredictionBattle'; // Ensure we have this or inline it
import { TESTNET_CONFIG, MAINNET_CONFIG } from '@/lib/config';

// Inline ABI for distributeWinnings if not easily importable, but we should try to import if possible.
// For robustness, I'll include the relevant parts here to avoid module resolution issues if the JSON isn't TS-friendly.
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

export async function POST(request: NextRequest) {
    try {
        const { predictionId, batchSize = 50 } = await request.json();

        if (!predictionId) {
            return NextResponse.json({ success: false, error: 'Missing predictionId' }, { status: 400 });
        }

        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            return NextResponse.json({ success: false, error: 'Server configuration error: Missing Private Key' }, { status: 500 });
        }

        const isMainnet = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
        const chain = isMainnet ? base : baseSepolia;
        const rpcUrl = isMainnet ? MAINNET_CONFIG.rpcUrl : TESTNET_CONFIG.rpcUrl;
        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

        if (!contractAddress) {
            return NextResponse.json({ success: false, error: 'Missing Contract Address' }, { status: 500 });
        }

        const account = privateKeyToAccount(privateKey as `0x${string}`);

        const client = createWalletClient({
            account,
            chain,
            transport: http(rpcUrl)
        }).extend(publicActions);

        console.log(`[API] Distributing winnings for ${predictionId} on ${chain.name}...`);

        const { request: txRequest } = await client.simulateContract({
            address: contractAddress,
            abi: DISTRIBUTE_ABI,
            functionName: 'distributeWinnings',
            args: [predictionId, BigInt(batchSize)],
            account
        });

        const txHash = await client.writeContract(txRequest);

        console.log(`[API] Distribution Tx Sent: ${txHash}`);

        // Wait for Receipt (optional, but good for admin feedback)
        const receipt = await client.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status !== 'success') {
            throw new Error(`Transaction failed with status: ${receipt.status}`);
        }

        return NextResponse.json({
            success: true,
            txHash,
            blockNumber: receipt.blockNumber.toString()
        });

    } catch (error: any) {
        console.error('[API] Distribution Error:', error);

        // Handle "Already fully paid out" error specifically
        const errorMsg = error.message?.toLowerCase() || '';
        const shortMsg = error.shortMessage?.toLowerCase() || '';

        if (errorMsg.includes('already fully paid out') || shortMsg.includes('paid out')) {
            console.log(`[API] Contract reported paid out for ${predictionId}. Syncing DB...`);
            try {
                const { store } = await import('@/lib/store'); // Dynamic import to avoid cycles if any
                const bet = await store.getBet(predictionId);

                if (bet) {
                    const winningOption = bet.result;
                    if (winningOption === 'yes' || winningOption === 'no') {
                        // Mark all on winning side as paid
                        const updateList = (list: any[]) => list.map(p => ({ ...p, paid: true, txHash: 'CONTRACT_SYNC_AUTO' }));

                        bet.participants[winningOption] = updateList(bet.participants[winningOption] || []);
                        // Also update void logic impact if needed, but winningOption usually sufficient

                        await store.saveBet(bet);
                        console.log(`[API] Synced DB for ${predictionId}`);

                        return NextResponse.json({
                            success: true,
                            message: 'Already paid out on-chain. Database synced.'
                        });
                    }
                }
            } catch (syncError) {
                console.error('[API] Failed to sync DB:', syncError);
            }
        }

        return NextResponse.json({
            success: false,
            error: error.shortMessage || error.message || 'Unknown error'
        }, { status: 500 });
    }
}
