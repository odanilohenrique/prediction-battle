'use client';

import { useState } from 'react';
import { X, Heart, Repeat2, MessageCircle, DollarSign, TrendingUp, Share2 } from 'lucide-react';
import { Cast, MetricType, PredictionChoice } from '@/lib/types';

interface PredictionModalProps {
    cast: Cast;
    onClose: () => void;
}

const BET_AMOUNTS = [0.05, 0.1, 0.5, 1];

import { useModal } from '@/providers/ModalProvider';

// ... (interface)
// ...

export default function PredictionModal({ cast, onClose }: PredictionModalProps) {
    const { showAlert, showModal } = useModal();
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // ... (state)

    const handleSubmit = async () => {
        setIsSubmitting(true);

        try {
            // ... (fetch)
            // ...
            const data = await response.json();

            if (data.success) {
                // TODO: Trigger MiniKit payment
                showModal({
                    title: 'Prediction Created!',
                    message: 'Prediction created! Payment integration coming soon.',
                    type: 'success',
                    onConfirm: onClose
                });
            } else {
                showAlert('Error', 'Error creating prediction: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('Error', 'Failed to create prediction', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleShare = () => {
        const shareText = `I just bet ${betAmount} USDC that @${cast.author.username}'s cast will ${choice === 'yes' ? 'hit' : 'NOT hit'} ${targetValue} ${metric} in 24h! Join me on Prediction Battle 🔥`;
        // TODO: Integrate with MiniKit composeCast
        showAlert('Coming Soon', 'Share feature coming soon!', 'info');
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-darkGray rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-surface border-b border-darkGray px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-textPrimary">Create Prediction</h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-darkGray hover:bg-darkGray/70 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-textSecondary" />
                    </button>
                </div>

                {/* Cast Preview */}
                <div className="px-6 py-4 border-b border-darkGray">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="text-2xl">👤</div>
                        <div>
                            <div className="font-semibold text-textPrimary">
                                {cast.author.displayName}
                            </div>
                            <div className="text-sm text-textSecondary">@{cast.author.username}</div>
                        </div>
                    </div>
                    <p className="text-textPrimary text-sm line-clamp-3">{cast.text}</p>
                </div>

                {/* Step Indicator */}
                <div className="px-6 py-4 flex items-center gap-2">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-darkGray'
                                }`}
                        />
                    ))}
                </div>

                <div className="px-6 py-6">
                    {/* Step 1: Choose Metric & Target */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-textPrimary mb-4">
                                    Choose Metric
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        onClick={() => {
                                            setMetric('likes');
                                            setTargetValue(currentValue + 100);
                                        }}
                                        className={`p-4 rounded-xl border-2 transition-all ${metric === 'likes'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-darkGray hover:border-darkGray/50'
                                            }`}
                                    >
                                        <Heart className="w-6 h-6 mx-auto mb-2 text-primary" />
                                        <div className="text-sm font-medium text-textPrimary">Likes</div>
                                        <div className="text-xs text-textSecondary">
                                            Current: {currentValue}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setMetric('recasts');
                                            setTargetValue(cast.reactions.recasts_count + 50);
                                        }}
                                        className={`p-4 rounded-xl border-2 transition-all ${metric === 'recasts'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-darkGray hover:border-darkGray/50'
                                            }`}
                                    >
                                        <Repeat2 className="w-6 h-6 mx-auto mb-2 text-primary" />
                                        <div className="text-sm font-medium text-textPrimary">Recasts</div>
                                        <div className="text-xs text-textSecondary">
                                            Current: {cast.reactions.recasts_count}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setMetric('replies');
                                            setTargetValue(cast.reactions.replies_count + 20);
                                        }}
                                        className={`p-4 rounded-xl border-2 transition-all ${metric === 'replies'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-darkGray hover:border-darkGray/50'
                                            }`}
                                    >
                                        <MessageCircle className="w-6 h-6 mx-auto mb-2 text-primary" />
                                        <div className="text-sm font-medium text-textPrimary">Replies</div>
                                        <div className="text-xs text-textSecondary">
                                            Current: {cast.reactions.replies_count}
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-textPrimary mb-2">
                                    Target Value (in 24 hours)
                                </label>
                                <input
                                    type="number"
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(parseInt(e.target.value) || 0)}
                                    className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                                    min={currentValue}
                                />
                                <p className="text-xs text-textSecondary mt-2">
                                    Current: {currentValue} → Target: {targetValue} (+{targetValue - currentValue})
                                </p>
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                className="w-full bg-primary hover:bg-secondary text-background font-bold py-3 rounded-xl transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {/* Step 2: Choose Prediction */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-textPrimary">
                                Your Prediction
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setChoice('yes')}
                                    className={`p-6 rounded-xl border-2 transition-all ${choice === 'yes'
                                        ? 'border-green-500 bg-green-500/10'
                                        : 'border-darkGray hover:border-darkGray/50'
                                        }`}
                                >
                                    <div className="text-4xl mb-2">✅</div>
                                    <div className="text-lg font-bold text-textPrimary mb-1">YES</div>
                                    <div className="text-sm text-textSecondary">
                                        Will hit {targetValue} {metric}
                                    </div>
                                </button>
                                <button
                                    onClick={() => setChoice('no')}
                                    className={`p-6 rounded-xl border-2 transition-all ${choice === 'no'
                                        ? 'border-red-500 bg-red-500/10'
                                        : 'border-darkGray hover:border-darkGray/50'
                                        }`}
                                >
                                    <div className="text-4xl mb-2">❌</div>
                                    <div className="text-lg font-bold text-textPrimary mb-1">NO</div>
                                    <div className="text-sm text-textSecondary">
                                        Won't hit {targetValue} {metric}
                                    </div>
                                </button>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 bg-darkGray hover:bg-darkGray/70 text-textPrimary font-medium py-3 rounded-xl transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex-1 bg-primary hover:bg-secondary text-background font-bold py-3 rounded-xl transition-colors"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Choose Bet Amount */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-textPrimary">
                                Bet Amount (USDC)
                            </h3>
                            <div className="grid grid-cols-4 gap-3">
                                {BET_AMOUNTS.map((amount) => (
                                    <button
                                        key={amount}
                                        onClick={() => setBetAmount(amount)}
                                        className={`p-4 rounded-xl border-2 transition-all ${betAmount === amount
                                            ? 'border-primary bg-primary/10'
                                            : 'border-darkGray hover:border-darkGray/50'
                                            }`}
                                    >
                                        <DollarSign className="w-6 h-6 mx-auto mb-1 text-primary" />
                                        <div className="text-lg font-bold text-textPrimary">{amount}</div>
                                    </button>
                                ))}
                            </div>

                            {/* Summary */}
                            <div className="bg-darkGray rounded-xl p-4 space-y-2">
                                <div className="text-sm font-medium text-textSecondary">Summary</div>
                                <div className="text-textPrimary">
                                    Betting <span className="text-primary font-bold">{betAmount} USDC</span>
                                    {' '}that this cast will{' '}
                                    <span className="font-bold">
                                        {choice === 'yes' ? 'HIT' : 'NOT HIT'}
                                    </span>
                                    {' '}{targetValue} {metric} in 24 hours
                                </div>

                                {/* Potential Return / Odds Display */}
                                <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                                    <div className="text-sm text-textSecondary">
                                        Est. Return
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-green-500">
                                            ${betAmount.toFixed(2)} - ${(betAmount * 2).toFixed(2)}
                                        </div>
                                        <div className="text-xs text-textSecondary">
                                            1.0x (Refund) to ~2.0x (if matched)
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(2)}
                                    className="flex-1 bg-darkGray hover:bg-darkGray/70 text-textPrimary font-medium py-3 rounded-xl transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-background font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        'Creating...'
                                    ) : (
                                        <>
                                            <TrendingUp className="w-5 h-5" />
                                            Place Bet
                                        </>
                                    )}
                                </button>
                            </div>

                            <button
                                onClick={handleShare}
                                className="w-full bg-surface border border-darkGray hover:border-primary/30 text-textPrimary font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <Share2 className="w-4 h-4" />
                                Share Prediction
                            </button>
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
}
