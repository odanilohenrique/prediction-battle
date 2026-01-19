'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { TrendingUp, Wallet, CheckCircle, Clock, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useModal } from '@/providers/ModalProvider';
import { CURRENT_CONFIG } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';

export default function PayoutsPage() {
    const { showAlert, showConfirm } = useModal();
    const { address } = useAccount();

    const [payouts, setPayouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState<'unclaimed' | 'fully_claimed'>('unclaimed');

    useEffect(() => {
        fetchPayouts();
    }, []);

    const fetchPayouts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/bets?status=resolved');
            const data = await res.json();
            if (data.success && data.bets) {
                setPayouts(data.bets);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Determine if all winners have claimed
    const isBetFullyClaimed = (bet: any) => {
        const winningOption = bet.result;
        if (!['yes', 'no'].includes(winningOption)) return false; // Not resolved correctly?

        const winners = bet.participants?.[winningOption] || [];
        if (winners.length === 0) return true; // No winners to claim

        return winners.every((w: any) => w.paid === true); // 'paid' flag in V2 means 'claimed'
    };

    const pendingBets = payouts.filter(b => !isBetFullyClaimed(b));
    const claimedBets = payouts.filter(b => isBetFullyClaimed(b));
    const displayedBets = activeTab === 'unclaimed' ? pendingBets : claimedBets;

    // Function to check chain status for a specific user
    const checkClaimStatus = async (bet: any, user: any) => {
        const key = `${bet.id}-${user.userId}`;
        setVerifying(prev => ({ ...prev, [key]: true }));

        try {
            // Create a client manually to avoid hook limitations in loop/callback
            const client = createPublicClient({
                chain: process.env.NEXT_PUBLIC_USE_MAINNET === 'true' ? base : baseSepolia,
                transport: http()
            });

            const side = bet.result === 'yes'; // true for Yes

            const data = await client.readContract({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'getUserBet',
                args: [bet.id, user.userId, side]
            }) as [bigint, bigint, string, boolean];

            const [amount, shares, referrer, claimed] = data;

            if (claimed) {
                // Update DB
                await updateClaimStatus(bet.id, user.userId);
                showAlert('Updated', `User ${user.userId.substring(0, 6)}... marked as CLAIMED.`, 'success');
            } else {
                showAlert('Info', `User has NOT claimed yet.`, 'info');
            }

        } catch (error) {
            console.error('Check failed:', error);
            showAlert('Error', 'Failed to check chain status', 'error');
        } finally {
            setVerifying(prev => ({ ...prev, [key]: false }));
        }
    };

    const updateClaimStatus = async (betId: string, userId: string) => {
        try {
            const res = await fetch('/api/predictions/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ betId, userAddress: userId })
            });

            if (res.ok) {
                // Local update
                setPayouts(prev => prev.map(b => {
                    if (b.id === betId) {
                        const side = b.result;
                        const winners = b.participants[side].map((w: any) =>
                            w.userId.toLowerCase() === userId.toLowerCase() ? { ...w, paid: true } : w
                        );
                        return { ...b, participants: { ...b.participants, [side]: winners } };
                    }
                    return b;
                }));
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Sync all winners for a bet
    const syncBet = async (bet: any) => {
        const side = bet.result;
        const winners = bet.participants?.[side] || [];

        for (const winner of winners) {
            if (!winner.paid) {
                await checkClaimStatus(bet, winner);
            }
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Wallet className="w-6 h-6 text-primary" />
                    Claims Monitor (V2)
                </h1>
                <button
                    onClick={fetchPayouts}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Data
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-surface border border-white/5 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('unclaimed')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'unclaimed'
                        ? 'bg-yellow-500 text-black shadow-lg'
                        : 'text-textSecondary hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Clock className="w-4 h-4" />
                    Pending Claims ({pendingBets.length})
                </button>
                <button
                    onClick={() => setActiveTab('fully_claimed')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'fully_claimed'
                        ? 'bg-green-500 text-black shadow-lg'
                        : 'text-textSecondary hover:text-white hover:bg-white/5'
                        }`}
                >
                    <CheckCircle className="w-4 h-4" />
                    Fully Claimed ({claimedBets.length})
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            ) : (
                <div className="grid gap-6">
                    {displayedBets.length === 0 && (
                        <div className="text-center py-12 text-textSecondary bg-surface border border-white/5 rounded-xl">
                            <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No bets found in this category.</p>
                        </div>
                    )}

                    {displayedBets.map(bet => {
                        const winningOption = bet.result; // 'yes' | 'no'
                        const winners = bet.participants?.[winningOption] || [];
                        const totalWinningStake = winners.reduce((acc: number, p: any) => acc + p.amount, 0);
                        const totalLosingStake = bet.participants?.[winningOption === 'yes' ? 'no' : 'yes']?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                        const winnersPot = totalWinningStake + totalLosingStake;

                        return (
                            <div key={bet.id} className="bg-surface border border-white/5 rounded-xl p-6">
                                <div className="flex flex-col md:flex-row justify-between mb-4 gap-4">
                                    <div>
                                        <div className="text-xs text-white/40 font-mono mb-1">ID: {bet.id}</div>
                                        <h3 className="text-lg font-bold text-white">{bet.title || bet.question || bet.castText || 'Untitled Prediction'}</h3>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${bet.result === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                Winner: {bet.result?.toUpperCase()}
                                            </span>
                                            <span className="text-textSecondary text-sm">Pot: ${winnersPot.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <button
                                            onClick={() => syncBet(bet)}
                                            className="px-3 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold hover:bg-blue-500/20 transition-all flex items-center gap-2"
                                        >
                                            <RefreshCw className="w-3 h-3" /> Check All Claims
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 bg-black/20 rounded-xl p-4 border border-white/5">
                                    {/* Filter out Creator/Seed wallet to prevent confusion about "Unpaid Service Fees" */}
                                    {(() => {
                                        const visibleWinners = winners.filter((w: any) => {
                                            const creator = (bet.creatorAddress || bet.creator || '').toLowerCase();
                                            return w.userId.toLowerCase() !== creator;
                                        });

                                        return (
                                            <>
                                                <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">
                                                    Winners List ({visibleWinners.length})
                                                    <span className="text-[10px] text-white/20 ml-1">(Seed Hidden)</span>
                                                </h4>

                                                {visibleWinners.length === 0 ? (
                                                    <p className="text-sm text-textSecondary italic">No winners (or only seed liquidity).</p>
                                                ) : (
                                                    visibleWinners.map((winner: any, i: number) => {
                                                        const isPaid = winner.paid; // claimed
                                                        const key = `${bet.id}-${winner.userId}`;

                                                        return (
                                                            <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${isPaid ? 'bg-green-900/10 border-green-500/20' : 'bg-white/5 border-white/5'}`}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isPaid ? 'bg-green-500/20 text-green-500' : 'bg-white/10 text-white/40'}`}>
                                                                        {i + 1}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-mono text-white">{winner.userId}</div>
                                                                        <div className="text-xs text-textSecondary">Bet: ${winner.amount}</div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    {isPaid ? (
                                                                        <span className="flex items-center gap-1 text-green-500 text-xs font-bold bg-green-500/10 px-2 py-1 rounded">
                                                                            <CheckCircle className="w-3 h-3" /> CLAIMED
                                                                        </span>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-yellow-500 text-xs font-bold bg-yellow-500/10 px-2 py-1 rounded flex items-center gap-1">
                                                                                <Clock className="w-3 h-3" /> UNCLAIMED
                                                                            </span>
                                                                            <button
                                                                                onClick={() => checkClaimStatus(bet, winner)}
                                                                                disabled={verifying[key]}
                                                                                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/60 hover:text-white transition-colors"
                                                                                title="Verify on Blockchain"
                                                                            >
                                                                                <RefreshCw className={`w-3 h-3 ${verifying[key] ? 'animate-spin' : ''}`} />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                                );
                    })}
                            </div>
                        )
                    }
        </div>
            );
}
