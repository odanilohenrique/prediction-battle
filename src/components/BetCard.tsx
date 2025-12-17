'use client';

import { useState, useEffect } from 'react';
import { Clock, TrendingUp, Users } from 'lucide-react';
import { Prediction } from '@/lib/types';
import ResultReveal from './ResultReveal';

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

    const [showReveal, setShowReveal] = useState(false);
    const [hasViewedResult, setHasViewedResult] = useState(false);

    // Check if result has been viewed before
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const viewed = localStorage.getItem(`viewed_${prediction.id}_${userChoice}`);
            setHasViewedResult(!!viewed);
        }
    }, [prediction.id, userChoice]);

    const handleViewResult = () => {
        setShowReveal(true);
        localStorage.setItem(`viewed_${prediction.id}_${userChoice}`, 'true');
        setHasViewedResult(true);
    };

    // Determine if we should show the "View Result" button
    // Only show if: Status is 'won' or 'lost' AND user hasn't viewed it yet
    const showViewResultButton = (status === 'won' || status === 'lost') && !hasViewedResult;

    return (
        <>
            <div className="bg-surface border border-darkGray rounded-2xl p-5 hover:border-primary/30 transition-all relative overflow-hidden">
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                    <div
                        className={`px-3 py-1 rounded-full text-sm font-medium border ${Date.now() > prediction.expiresAt
                            ? 'bg-red-500/10 text-red-500 border-red-500/30'
                            : statusColors[status]
                            }`}
                    >
                        {Date.now() > prediction.expiresAt ? '🚫 EXPIRED' : (statusIcons[status] + ' ' + status.toUpperCase())}
                    </div>
                    {prediction.status === 'active' && Date.now() <= prediction.expiresAt && (
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
                            className={`font-bold flex items-center gap-2 ${userChoice === 'yes' ? 'text-green-500' : 'text-red-500'
                                }`}
                        >
                            {prediction.optionA && prediction.optionB ? (
                                <>
                                    {userChoice === 'yes' ? (
                                        <>
                                            {prediction.optionA.imageUrl && (
                                                <img src={prediction.optionA.imageUrl} className="w-5 h-5 rounded-full" />
                                            )}
                                            {prediction.optionA.label || 'Option A'}
                                        </>
                                    ) : (
                                        <>
                                            {prediction.optionB.imageUrl && (
                                                <img src={prediction.optionB.imageUrl} className="w-5 h-5 rounded-full" />
                                            )}
                                            {prediction.optionB.label || 'Option B'}
                                        </>
                                    )}
                                </>
                            ) : (
                                userChoice === 'yes' ? '✅ YES' : '❌ NO'
                            )}
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

                    {showViewResultButton ? (
                        <button
                            onClick={handleViewResult}
                            className="w-full mt-4 bg-gradient-to-r from-primary to-secondary text-background font-bold py-3 rounded-xl animate-pulse hover:opacity-90 transition-opacity"
                        >
                            🎁 View Result
                        </button>
                    ) : (
                        <>
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
                        </>
                    )}
                </div>
            </div>

            {/* Result Reveal Animation */}
            {showReveal && (
                <ResultReveal
                    isWin={status === 'won'}
                    amount={status === 'won' ? (payout || 0) : userAmount}
                    betId={prediction.id}
                    onComplete={() => setShowReveal(false)}
                />
            )}
        </>
    );
}
