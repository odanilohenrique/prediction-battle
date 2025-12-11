'use client';

import { useEffect, useState } from 'react';
import BetCard from './BetCard';
import { UserBet } from '@/lib/types';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function PastBets() {
    const [bets, setBets] = useState<UserBet[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPastBets();
    }, []);

    async function fetchPastBets() {
        try {
            // TODO: Replace with actual user ID from MiniKit auth
            const userId = 'demo_user';
            const response = await fetch(`/api/predictions/list?userId=${userId}&status=completed`);
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

    const wonBets = bets.filter((b) => b.status === 'won');
    const lostBets = bets.filter((b) => b.status === 'lost');
    const totalWinnings = wonBets.reduce((sum, b) => sum + (b.payout || 0), 0);
    const totalLost = lostBets.reduce((sum, b) => sum + b.amount, 0);
    const netProfit = totalWinnings - totalLost;

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-xl font-bold text-textPrimary mb-4">
                    Your Prediction History
                </h2>

                {/* Stats Cards */}
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

                {/* Net Profit/Loss */}
                <div
                    className={`p-4 rounded-xl border ${netProfit >= 0
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                        }`}
                >
                    <div className="text-sm text-textSecondary mb-1">Net Profit/Loss</div>
                    <div
                        className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}
                    >
                        {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bets.map((bet) => (
                    <BetCard
                        key={bet.predictionId}
                        prediction={bet.prediction}
                        userChoice={bet.choice}
                        userAmount={bet.amount}
                        status={bet.status}
                        payout={bet.payout}
                    />
                ))}
            </div>
        </div>
    );
}
