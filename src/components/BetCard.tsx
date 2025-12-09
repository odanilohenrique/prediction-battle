'use client';

import { Clock, TrendingUp, Users } from 'lucide-react';
import { Prediction } from '@/lib/types';

interface BetCardProps {
    prediction: Prediction;
    userChoice: 'yes' | 'no';
    userAmount: number;
    status: 'pending' | 'won' | 'lost';
    payout?: number;
}

export default function BetCard({
    prediction,
    userChoice,
    userAmount,
    status,
    payout,
}: BetCardProps) {
    const timeRemaining = prediction.expiresAt - Date.now();
    const hours = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));
    const minutes = Math.max(0, Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)));

    const totalPot =
        prediction.pot.yes.reduce((sum, bet) => sum + bet.amount, 0) +
        prediction.pot.no.reduce((sum, bet) => sum + bet.amount, 0);

    const statusColors = {
        pending: 'bg-primary/10 text-primary border-primary/30',
        won: 'bg-green-500/10 text-green-500 border-green-500/30',
        lost: 'bg-red-500/10 text-red-500 border-red-500/30',
    };

    const statusIcons = {
        pending: '⏳',
        won: '🎉',
        lost: '😢',
    };

    return (
        <div className="bg-surface border border-darkGray rounded-2xl p-5 hover:border-primary/30 transition-all">
            {/* Status Badge */}
            <div className="flex items-center justify-between mb-4">
                <div
                    className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[status]}`}
                >
                    {statusIcons[status]} {status.toUpperCase()}
                </div>
                {prediction.status === 'active' && (
                    <div className="flex items-center gap-1.5 text-textSecondary text-sm">
                        <Clock className="w-4 h-4" />
                        {hours}h {minutes}m left
                    </div>
                )}
            </div>

            {/* Cast Preview */}
            <div className="mb-4 pb-4 border-b border-darkGray">
                <div className="text-sm text-textSecondary mb-1">
                    @{prediction.castAuthor}'s cast
                </div>
                <p className="text-textPrimary text-sm line-clamp-2">
                    {prediction.castText}
                </p>
            </div>

            {/* Prediction Details */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-textSecondary">Your Prediction</span>
                    <span
                        className={`font-bold ${userChoice === 'yes' ? 'text-green-500' : 'text-red-500'
                            }`}
                    >
                        {userChoice === 'yes' ? '✅ YES' : '❌ NO'}
                    </span>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-sm text-textSecondary">Target</span>
                    <span className="text-textPrimary font-medium">
                        {prediction.targetValue} {prediction.metric}
                    </span>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-sm text-textSecondary">Your Bet</span>
                    <span className="text-primary font-bold">${userAmount.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-sm text-textSecondary flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Total Pot
                    </span>
                    <span className="text-textPrimary font-bold">${totalPot.toFixed(2)}</span>
                </div>

                {payout !== undefined && (
                    <div className="flex items-center justify-between pt-3 border-t border-darkGray">
                        <span className="text-sm text-textSecondary">Your Payout</span>
                        <span className="text-green-500 font-bold text-lg">
                            +${payout.toFixed(2)}
                        </span>
                    </div>
                )}

                {prediction.finalValue !== undefined && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-textSecondary">Final Result</span>
                        <span className="text-textPrimary font-medium">
                            {prediction.finalValue} {prediction.metric}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
