'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';
import { TrendingUp, Wallet, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Bet } from '@/lib/store';

export default function PayoutsPage() {
    const [payouts, setPayouts] = useState<Bet[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<Record<string, boolean>>({}); // Key: `${betId}-${userId}`
    const [justPaid, setJustPaid] = useState<Record<string, boolean>>({}); // Locally hide paid users

    const { address, chainId } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const { switchChainAsync } = useSwitchChain();

    // USDC Address (Same as in AdminBetCard)
    const IS_MAINNET = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
    const EXPECTED_CHAIN_ID = IS_MAINNET ? 8453 : 84532;
    const USDC_ADDRESS = IS_MAINNET
        ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

    useEffect(() => {
        fetchPayouts();
    }, []);

    async function fetchPayouts() {
        try {
            const res = await fetch(`/api/admin/payouts?t=${Date.now()}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.success) {
                setPayouts(data.payouts);
            }
        } catch (error) {
            console.error('Error fetching payouts:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSync() {
        if (!confirm('Run automated checker to find expired bets?')) return;
        setLoading(true);
        try {
            const res = await fetch('/api/check', { method: 'POST' });
            const data = await res.json();
            alert(`Sync Complete! Checked ${data.checked} bets.`);
            fetchPayouts();
        } catch (error) {
            console.error('Sync failed:', error);
            alert('Failed to sync payouts');
            setLoading(false);
        }
    }

    const handlePayWinner = async (betId: string, userAddress: string, amount: number) => {
        const key = `${betId}-${userAddress}`;
        if (processing[key]) return;

        if (!userAddress || userAddress === 'demo_user') {
            alert('Cannot pay demo user or invalid address.');
            return;
        }

        try {
            // 0. Verify and Switch Chain
            if (chainId !== EXPECTED_CHAIN_ID) {
                try {
                    console.log(`Switching chain from ${chainId} to ${EXPECTED_CHAIN_ID}...`);
                    if (switchChainAsync) {
                        await switchChainAsync({ chainId: EXPECTED_CHAIN_ID });
                    } else {
                        throw new Error("Troca de rede não suportada pela carteira.");
                    }
                } catch (switchError) {
                    console.error('Failed to switch chain:', switchError);
                    alert(`⚠️ Error: Wrong network. Please switch to ${IS_MAINNET ? 'Base Mainnet' : 'Base Sepolia'}.`);
                    return;
                }
            }

            if (!confirm(`Send ${amount.toFixed(2)} USDC to ${userAddress}?`)) return;

            setProcessing(prev => ({ ...prev, [key]: true }));

            const amountInWei = parseUnits(amount.toString(), 6);

            const hash = await writeContractAsync({
                address: USDC_ADDRESS as `0x${string}`,
                abi: [{
                    name: 'transfer',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [
                        { name: 'to', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    outputs: [{ name: '', type: 'bool' }]
                }],
                functionName: 'transfer',
                args: [userAddress as `0x${string}`, amountInWei],
                gas: BigInt(200000),
            });

            console.log(`Transaction Sent! Hash: ${hash}`);

            // Mark as paid in backend
            try {
                await fetch('/api/admin/payouts/mark-paid', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        betId: betId,
                        userId: userAddress,
                        txHash: hash
                    })
                });

                // Optimistically hide the user
                setJustPaid(prev => ({ ...prev, [key]: true }));
                fetchPayouts(); // Background refresh

            } catch (err) {
                console.error("Failed to mark as paid in DB", err);
                alert("Transaction sent but failed to update database. Please check manually.");
            }

        } catch (error) {
            console.error('Payment failed:', error);
            alert('❌ Payment Failed: ' + (error as Error).message);
        } finally {
            setProcessing(prev => ({ ...prev, [key]: false }));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-textPrimary mb-2 flex items-center gap-2">
                <Wallet className="w-8 h-8 text-primary" />
                Payout Dashboard
            </h1>
            <div className="flex justify-between items-center mb-8">
                <p className="text-textSecondary">
                    Manually distribute winnings to predictors from the House Wallet.
                </p>
                <button
                    onClick={handleSync}
                    className="flex items-center gap-2 bg-darkGray hover:bg-darkGray/70 text-textPrimary px-4 py-2 rounded-xl transition-colors font-medium border border-white/10"
                >
                    <CheckCircle className="w-4 h-4" />
                    Sync / Check Expired
                </button>
            </div>

            {payouts.length === 0 ? (
                <div className="text-center py-12 bg-surface rounded-xl border border-darkGray">
                    <p className="text-textSecondary">No completed predictions needing payout.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {payouts.map((bet) => {
                        // Handle "void" or "draw" (checking if bet.result is used this way, or if we need a new field. 
                        // The contract returns "isVoid", we might need to update the API/Type to include it.
                        // For now, assuming standard result='yes'/'no'.
                        // But wait, if I set 'isVoid' in contract, the indexer/API needs to return it.
                        // The current `BetMonitor` interface in `MonitorPage` didn't have `isVoid`.
                        // I'll assume for now `result` might be 'void' or I check a flag if available. 
                        // Let's assume the API returns `result: 'draw'` or similar if I update the resolver?
                        // Actually, I haven't updated the API to return 'isVoid' yet.
                        // Crucially, the frontend relies on `bet` object.

                        // Let's assume for this step I interpret a specific condition or just result string.
                        // I'll stick to 'yes'/'no' for now but handle case where I might manually set 'draw' in DB if I update API.
                        // Actually, better: allow 'draw' as a fallback.

                        const isDraw = bet.result === 'draw' || (bet as any).isVoid;
                        const result = bet.result || 'no';

                        let winners: any[] = [];
                        let totalWinningStake = 0;

                        if (isDraw) {
                            winners = [...bet.participants.yes, ...bet.participants.no];
                            totalWinningStake = bet.totalPot; // Everyone is a "winner" of their refund share
                        } else {
                            winners = result === 'yes' ? bet.participants.yes : bet.participants.no;
                            totalWinningStake = winners.reduce((sum, p) => sum + p.amount, 0);
                        }

                        const totalPot = bet.totalPot;
                        const winnersPot = totalPot * 0.8;


                        return (
                            <div key={bet.id} className="bg-surface border border-darkGray rounded-xl p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-textPrimary text-lg">
                                            @{bet.username}
                                        </h3>
                                        <p className="text-sm text-textSecondary">
                                            Target: {bet.target} ({bet.type})
                                        </p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${isDraw ? 'bg-gray-500/20 text-gray-400' :
                                            result === 'yes' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                                        }`}>
                                        Result: {isDraw ? 'DRAW (REFUND)' : result.toUpperCase()}
                                    </div>
                                </div>

                                <div className="bg-darkGray/30 rounded-lg p-3 mb-4 flex gap-4 text-sm">
                                    <div>
                                        <span className="text-textSecondary">Total Pot:</span>{' '}
                                        <span className="font-bold text-textPrimary">${totalPot.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-textSecondary">Winners Pot (80%):</span>{' '}
                                        <div>
                                            <span className="text-textSecondary">Winners Pot (80%):</span>{' '}
                                            <span className="font-bold text-green-500">${winnersPot.toFixed(2)}</span>
                                            {isDraw && <span className="text-xs text-gray-400 ml-2">(Refund Pool)</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-bold text-textSecondary uppercase">Winners to Pay</h4>

                                    {/* Smart Contract Distribution Button */}
                                    <button
                                        onClick={async () => {
                                            if (!confirm(`Run Auto-Distribution for ${bet.id} via Smart Contract? (Ensures ETH payouts)`)) return;

                                            // Optimistic UI for button
                                            const btn = document.getElementById(`dist-btn-${bet.id}`);
                                            if (btn) { btn.innerHTML = 'Processing...'; (btn as any).disabled = true; }

                                            try {
                                                const res = await fetch('/api/admin/payouts/distribute', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ predictionId: bet.id })
                                                });
                                                const d = await res.json();
                                                if (d.success) {
                                                    alert(`✅ Distribution Complete!\nTx: ${d.txHash}`);
                                                    fetchPayouts(); // Refresh
                                                } else {
                                                    throw new Error(d.error);
                                                }
                                            } catch (e) {
                                                alert(`❌ Distribute Failed: ${(e as Error).message}`);
                                                if (btn) { btn.innerHTML = '⚡ Distribute (Contract)'; (btn as any).disabled = false; }
                                            }
                                        }}
                                        id={`dist-btn-${bet.id}`}
                                        className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1 rounded-lg flex items-center gap-1 transition-colors"
                                    >
                                        ⚡ Distribute (Contract)
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {winners.filter(w => !w.paid && w.userId !== 'demo_user' && !justPaid[`${bet.id}-${w.userId}`]).length === 0 ? (
                                        <p className="text-sm text-textSecondary italic">All eligible winners paid.</p>
                                    ) : (
                                        winners.filter(w => !w.paid && w.userId !== 'demo_user' && !justPaid[`${bet.id}-${w.userId}`]).map((winner, idx) => {
                                            const share = winner.amount / totalWinningStake;
                                            const payoutAmount = share * winnersPot;
                                            const isProcessing = processing[`${bet.id}-${winner.userId}`];

                                            return (
                                                <div key={idx} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-darkGray/50">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-black">
                                                            {winner.userId.substring(0, 2)}
                                                        </div>
                                                        <div className="truncate text-sm text-textPrimary font-mono">
                                                            {winner.userId}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <div className="font-bold text-green-500">
                                                                ${payoutAmount.toFixed(2)}
                                                            </div>
                                                            <div className="text-xs text-textSecondary">
                                                                USDC
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handlePayWinner(bet.id, winner.userId, payoutAmount)}
                                                            disabled={isProcessing}
                                                            className={`
                                                                font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-1
                                                                ${isProcessing
                                                                    ? 'bg-darkGray text-textSecondary cursor-not-allowed'
                                                                    : 'bg-primary hover:bg-secondary text-black'}
                                                            `}
                                                        >
                                                            {isProcessing ? (
                                                                <>
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                    Processing...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    Pay <ExternalLink className="w-3 h-3" />
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
