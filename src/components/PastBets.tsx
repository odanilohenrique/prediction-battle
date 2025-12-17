'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import BetCard from './BetCard';
import { UserBet } from '@/lib/types';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function PastBets() {
    const [bets, setBets] = useState<UserBet[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'completed' | 'payouts'>('completed');
    const { address, isConnected } = useAccount();

    useEffect(() => {
        if (isConnected && address) {
            fetchPastBets();
        } else {
            setLoading(false);
            setBets([]);
        }
    }, [isConnected, address]);

    async function fetchPastBets() {
        if (!address) return;

        try {
            const response = await fetch(`/api/predictions/list?userId=${address}&status=completed`);
            const data = await response.json();
            setBets(data.bets || []);
        } catch (error) {
            console.error('Error fetching past predictions:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className="bg-surface border border-darkGray rounded-2xl p-5 animate-pulse"
                    >
                        <div className="h-6 bg-darkGray rounded w-32 mb-4" />
                        <div className="space-y-2">
                            <div className="h-4 bg-darkGray rounded w-full" />
                            <div className="h-4 bg-darkGray rounded w-3/4" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (bets.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-textPrimary mb-2">No Past Predictions</h3>
                <p className="text-textSecondary">
                    Your completed predictions will appear here
                </p>
            </div>
        );
    }

    // Filter logic
    const wonBets = bets.filter((b) => b.status === 'won');
    const lostBets = bets.filter((b) => b.status === 'lost');
    const totalWinnings = wonBets.reduce((sum, b) => sum + (b.payout || 0), 0);
    const totalLost = lostBets.reduce((sum, b) => sum + b.amount, 0);
    const netProfit = totalWinnings - totalLost;

    // Tab content
    const displayedBets = activeTab === 'completed'
        ? bets
        : bets.filter(b => b.paid === true); // Payouts tab

    return (
        <div>
            {/* Header / Stats */}
            <div className="mb-6">
                <h2 className="text-xl font-bold text-textPrimary mb-4">
                    Your Prediction History
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-surface border border-darkGray rounded-xl p-4">
                        <div className="text-sm text-textSecondary mb-1">Total Predictions</div>
                        <div className="text-2xl font-bold text-textPrimary">
                            {bets.length}
                        </div>
                    </div>
                    <div className="bg-surface border border-green-500/30 rounded-xl p-4">
                        <div className="text-sm text-textSecondary mb-1 flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            Won
                        </div>
                        <div className="text-2xl font-bold text-green-500">
                            {wonBets.length}
                        </div>
                        <div className="text-xs text-textSecondary mt-1">
                            +${totalWinnings.toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-surface border border-red-500/30 rounded-xl p-4">
                        <div className="text-sm text-textSecondary mb-1 flex items-center gap-1">
                            <TrendingDown className="w-4 h-4 text-red-500" />
                            Lost
                        </div>
                        <div className="text-2xl font-bold text-red-500">
                            {lostBets.length}
                        </div>
                        <div className="text-xs text-textSecondary mt-1">
                            -${totalLost.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-Tabs */}
            <div className="flex gap-4 border-b border-white/10 mb-6">
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeTab === 'completed'
                        ? 'text-primary'
                        : 'text-textSecondary hover:text-textPrimary'
                        }`}
                >
                    Completed Predictions
                    {activeTab === 'completed' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('payouts')}
                    className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeTab === 'payouts'
                        ? 'text-primary'
                        : 'text-textSecondary hover:text-textPrimary'
                        }`}
                >
                    Received Payouts
                    {activeTab === 'payouts' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                </button>
            </div>

            {/* List */}
            {displayedBets.length === 0 ? (
                <div className="text-center py-12 bg-surface/30 rounded-xl border border-dashed border-darkGray">
                    <p className="text-textSecondary">
                        {activeTab === 'payouts'
                            ? "No payouts received yet. Win some bets!"
                            : "No predictions found."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayedBets.map((bet) => (
                        <div key={bet.predictionId} className="relative">
                            <BetCard
                                prediction={bet.prediction}
                                userChoice={bet.choice}
                                userAmount={bet.amount}
                                status={bet.status}
                                payout={bet.payout}
                            />
                            {/* Payout Badge Overlay for Payouts Tab */}
                            {activeTab === 'payouts' && (
                                <div className="absolute top-2 right-2 bg-green-500 text-black text-xs font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    PAID
                                </div>
                            )}
                            {activeTab === 'payouts' && bet.txHash && (
                                <div className="mt-2 text-right">
                                    <a
                                        href={`https://sepolia.basescan.org/tx/${bet.txHash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-primary underline hover:text-secondary"
                                    >
                                        View Transaction
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
