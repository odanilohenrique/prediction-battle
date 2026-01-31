'use client';

import { useState, useEffect } from 'react';
import { Clock, Users, Trophy, Skull, Coins, gavel } from 'lucide-react'; // gavel might not exist, checking imports
import { Gavel } from 'lucide-react';
import { Prediction } from '@/lib/types';
import ResultReveal from './ResultReveal';
import { useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';
import { CURRENT_CONFIG } from '@/lib/config';

interface BetCardProps {
    prediction: Prediction;
    userChoice: 'yes' | 'no';
    userAmount: number;
    status: 'pending' | 'won' | 'lost' | 'void';
    payout?: number;
}

// Human-readable labels for bet types
const BET_TYPE_LABELS: Record<string, string> = {
    'likes_total': 'Total Likes',
    'recasts_total': 'Total Recasts',
    'replies_total': 'Total Replies',
    'post_count': 'Posts',
    'reply_marathon': 'Reply Marathon',
    'mentions': 'Mentions',
    'quotes': 'Quotes',
    'emoji_count': 'Emoji Count',
    'custom_text': 'Custom',
};

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
    const isNoLimit = timeRemaining > 365 * 24 * 60 * 60 * 1000 * 50; // > 50 years
    const isExpired = !isNoLimit && timeRemaining <= 0;

    const totalPot =
        prediction.pot.yes.reduce((sum, bet) => sum + bet.amount, 0) +
        prediction.pot.no.reduce((sum, bet) => sum + bet.amount, 0);

    const [showReveal, setShowReveal] = useState(false);
    const [hasViewedResult, setHasViewedResult] = useState(false);

    // --- CONTRACT INTEGRATION (Smart Timer) ---
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [disputeTimer, setDisputeTimer] = useState<string>('');
    const [canFinalize, setCanFinalize] = useState(false);

    // Fetch live market state if pending & expired (to check for Proposed/Dispute phase)
    const { data: marketData, refetch } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'markets',
        args: [prediction.id],
        query: {
            enabled: status === 'pending' && isExpired,
            refetchInterval: 10000, // Check periodically
        }
    }) as { data: any[] | undefined, refetch: () => void };

    // Extract State info
    const marketState = marketData ? Number(marketData[6]) : 0; // Index 6 is State
    const proposalTime = marketData ? Number(marketData[11]) : 0; // Index 11 is ProposalTime
    const DISPUTE_WINDOW = 12 * 60 * 60; // 12 hours in seconds

    // Countdown Logic
    useEffect(() => {
        if (marketState !== 2 || !proposalTime) { // 2 = PROPOSED
            setDisputeTimer('');
            setCanFinalize(false);
            return;
        }

        const interval = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const endTime = proposalTime + DISPUTE_WINDOW;
            const remaining = endTime - now;

            if (remaining <= 0) {
                setCanFinalize(true);
                setDisputeTimer('00:00:00');
                clearInterval(interval);
            } else {
                const h = Math.floor(remaining / 3600);
                const m = Math.floor((remaining % 3600) / 60);
                const s = remaining % 60;
                setDisputeTimer(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                setCanFinalize(false);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [marketState, proposalTime]);

    const handleFinalize = async () => {
        setIsFinalizing(true);
        try {
            const hash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'finalizeOutcome',
                args: [prediction.id],
            });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                refetch(); // Refresh state
            }
        } catch (error) {
            console.error('Finalize failed:', error);
            // Optional: alert user
        } finally {
            setIsFinalizing(false);
        }
    };
    // -------------------------------------------

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

    // Human-readable metric
    const metricLabel = BET_TYPE_LABELS[prediction.metric] || prediction.metric;

    // Determine if bet is resolved (has result)
    const isResolved = prediction.result !== undefined;

    // Show View Result button when: bet is resolved AND user hasn't viewed yet
    const showViewResultButton = isResolved && !hasViewedResult;

    // Status display
    const getStatusDisplay = () => {
        // [NEW] Smart Status based on Chain State
        if (marketState === 2) { // PROPOSED
            return { label: 'VERIFYING', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', icon: '⚖️' };
        }
        if (marketState === 3) { // DISPUTED
            return { label: 'DISPUTED', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50', icon: '🚨' };
        }

        if (!isResolved && isExpired) {
            return { label: 'AWAITING RESULT', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30', icon: '⏰' };
        }
        if (!isResolved) {
            return { label: 'ACTIVE', color: 'bg-primary/10 text-primary border-primary/30', icon: '⏳' };
        }
        if (status === 'won') {
            return { label: 'YOU WON! 🎉', color: 'bg-green-500/20 text-green-400 border-green-500/50', icon: '🏆' };
        }
        if (status === 'lost') {
            return { label: 'YOU LOST', color: 'bg-red-500/20 text-red-400 border-red-500/50', icon: '💀' };
        }
        if (status === 'void') {
            return { label: 'REFUNDED', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50', icon: '↩️' };
        }
        return { label: 'PENDING', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30', icon: '⏳' };
    };

    const statusDisplay = getStatusDisplay();

    return (
        <>
            <div className={`bg-surface border rounded-2xl p-5 transition-all relative overflow-hidden ${status === 'won' ? 'border-green-500/50 shadow-lg shadow-green-500/10' :
                status === 'lost' ? 'border-red-500/30' :
                    'border-darkGray hover:border-primary/30'
                }`}>

                {/* Win/Loss Banner */}
                {isResolved && (
                    <div className={`absolute top-0 left-0 right-0 h-1 ${status === 'won' ? 'bg-green-500' : 'bg-red-500'}`} />
                )}

                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                    <div className={`px-3 py-1.5 rounded-full text-sm font-bold border ${statusDisplay.color}`}>
                        {statusDisplay.icon} {statusDisplay.label}
                    </div>
                    {!isResolved && (
                        <div className="flex items-center gap-1.5 text-textSecondary text-sm">
                            <Clock className="w-4 h-4" />
                            {isNoLimit ? (
                                <span className="text-primary font-bold">Indefinite ♾️</span>
                            ) : (
                                isExpired ? 'Expired' : `${hours}h ${minutes}m left`
                            )}
                        </div>
                    )}
                </div>

                {/* [NEW] Public Dispute Timer / Finalize Button */}
                {!isResolved && marketState === 2 && (
                    <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 animate-fade-in">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Gavel className="w-4 h-4 text-yellow-500" />
                                <span className="text-sm font-bold text-yellow-500">Observation Period</span>
                            </div>
                            <span className="text-mono font-bold text-white">{disputeTimer || 'Calculando...'}</span>
                        </div>

                        {canFinalize ? (
                            <button
                                onClick={handleFinalize}
                                disabled={isFinalizing}
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                {isFinalizing ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>✅ Enable Payouts</>
                                )}
                            </button>
                        ) : (
                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500 animate-pulse w-full origin-left" style={{ animationDuration: '2s' }} />
                            </div>
                        )}
                        <p className="text-[10px] text-white/40 mt-2 text-center">
                            {canFinalize ? "Window closed. Anyone can finalize." : "Market is being verified. Only dispute if result is wrong."}
                        </p>
                    </div>
                )}


                {/* Cast Preview */}
                <div className="mb-4 pb-4 border-b border-darkGray">
                    <div className="text-sm text-textSecondary mb-1">
                        @{prediction.castAuthor}'s cast
                    </div>
                    <p className="text-textPrimary text-sm line-clamp-2">
                        {prediction.castText || `Prediction on @${prediction.castAuthor}`}
                    </p>
                </div>

                {/* Prediction Details */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-textSecondary">Your Prediction</span>
                        <span className={`font-bold flex items-center gap-2 ${userChoice === 'yes' ? 'text-green-500' : 'text-red-500'}`}>
                            {prediction.optionA && prediction.optionB ? (
                                <>
                                    {userChoice === 'yes' ? (
                                        <>
                                            {prediction.optionA.imageUrl && (
                                                <img src={prediction.optionA.imageUrl} className="w-5 h-5 rounded-full" alt="" />
                                            )}
                                            {prediction.optionA.label || 'Option A'}
                                        </>
                                    ) : (
                                        <>
                                            {prediction.optionB.imageUrl && (
                                                <img src={prediction.optionB.imageUrl} className="w-5 h-5 rounded-full" alt="" />
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
                            {prediction.targetValue} {metricLabel}
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

                    {/* Result Section */}
                    {isResolved && (
                        <div className={`mt-4 p-4 rounded-xl ${status === 'won' ? 'bg-green-500/10 border border-green-500/30' :
                            status === 'void' ? 'bg-blue-500/10 border border-blue-500/30' :
                                'bg-red-500/10 border border-red-500/30'
                            }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {status === 'won' ? <Trophy className="w-5 h-5 text-green-500" /> :
                                        status === 'void' ? <Coins className="w-5 h-5 text-blue-500" /> :
                                            <Skull className="w-5 h-5 text-red-500" />}
                                    <span className={`font-bold ${status === 'won' ? 'text-green-400' :
                                        status === 'void' ? 'text-blue-400' :
                                            'text-red-400'
                                        }`}>
                                        {status === 'won' ? 'You Won!' : status === 'void' ? 'Refunded' : 'You Lost'}
                                    </span>
                                </div>
                                <span className={`text-xl font-black ${status === 'won' ? 'text-green-400' :
                                    status === 'void' ? 'text-blue-400' :
                                        'text-red-400'
                                    }`}>
                                    {status === 'won' ? `+$${(payout || 0).toFixed(2)}` :
                                        status === 'void' ? `$${(payout || userAmount).toFixed(2)}` :
                                            `-$${userAmount.toFixed(2)}`}
                                </span>
                            </div>

                            {/* Redirect for Fee Earners (Creators/Proposers) who 'Lost' the bet */}
                            {status === 'lost' && (
                                <div className="mt-3 pt-3 border-t border-white/10">
                                    <div className="text-xs text-textSecondary mb-2">
                                        Created this market or won a dispute?
                                    </div>
                                    <a
                                        href="/earnings"
                                        className="block w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                                    >
                                        <Coins className="w-4 h-4 text-yellow-400" />
                                        Check Earnings
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* View Result Button */}
                    {showViewResultButton && (
                        <button
                            onClick={handleViewResult}
                            className="w-full mt-4 bg-gradient-to-r from-primary to-secondary text-background font-bold py-3 rounded-xl animate-pulse hover:opacity-90 transition-opacity"
                        >
                            🎁 View Result with Effects!
                        </button>
                    )}

                    {/* Final Value if available */}
                    {prediction.finalValue !== undefined && (
                        <div className="flex items-center justify-between pt-2 border-t border-darkGray">
                            <span className="text-sm text-textSecondary">Final Result</span>
                            <span className="text-textPrimary font-medium">
                                {prediction.finalValue} {metricLabel}
                            </span>
                        </div>
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
