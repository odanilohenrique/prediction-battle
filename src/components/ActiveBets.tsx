'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import BetCard from './BetCard';
import { UserBet } from '@/lib/types';

export default function ActiveBets() {
    const [bets, setBets] = useState<UserBet[]>([]);
    const [loading, setLoading] = useState(true);
    const { address, isConnected } = useAccount();

    useEffect(() => {
        if (isConnected && address) {
            fetchActiveBets();
            const interval = setInterval(fetchActiveBets, 30000);
            return () => clearInterval(interval);
        } else {
            setLoading(false);
            setBets([]);
        }
    }, [isConnected, address]);

    async function fetchActiveBets() {
        if (!address) return;

        try {
            setLoading(true);
            const response = await fetch(`/api/predictions/list?userId=${address}&status=active`, { cache: 'no-store' });
            const data = await response.json();
            setBets(data.bets || []);
        } catch (error) {
            console.error('Error fetching active bets:', error);
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
                <div className="text-6xl mb-4">🎲</div>
                <h3 className="text-xl font-bold text-textPrimary mb-2">No Active Predictions</h3>
                <p className="text-textSecondary">
                    Place your first prediction on a trending cast!
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-xl font-bold text-textPrimary mb-2">
                    Your Active Predictions
                </h2>
                <p className="text-textSecondary">
                    {bets.length} active prediction{bets.length !== 1 ? 's' : ''}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bets.map((bet) => (
                    <BetCard
                        key={bet.predictionId}
                        prediction={bet.prediction}
                        userChoice={bet.choice}
                        userAmount={bet.amount}
                        status={bet.status}
                    />
                ))}
            </div>
        </div>
    );
}
