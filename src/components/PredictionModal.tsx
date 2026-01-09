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
import { useAccount, useWriteContract, usePublicClient, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';
import { CURRENT_CONFIG } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';
import ViralReceipt from './ViralReceipt';

// ... (interface)
// ...

export default function PredictionModal({ cast, onClose }: PredictionModalProps) {
    const { showAlert, showModal } = useModal();
    const [step, setStep] = useState<1 | 2 | 3>(1);

    const [metric, setMetric] = useState<MetricType>('likes');
    const [targetValue, setTargetValue] = useState<number>(0);
    const [choice, setChoice] = useState<PredictionChoice>('yes');
    const [betAmount, setBetAmount] = useState<number>(0.1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    // Calculate current value based on metric
    const currentValue = (() => {
        switch (metric) {
            case 'likes': return cast.reactions.likes_count;
            case 'recasts': return cast.reactions.recasts_count;
            case 'replies': return cast.reactions.replies_count;
            default: return 0;
        }
    })();

    // Initialize target value when metric changes or on load
    if (targetValue === 0 && currentValue > 0) {
        setTargetValue(Math.ceil(currentValue * 1.5));
    }

    // Wagmi hooks
    const { address, isConnected, chainId } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const { switchChainAsync } = useSwitchChain();
    const publicClient = usePublicClient();

    // Config
    const IS_MAINNET = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
    const EXPECTED_CHAIN_ID = IS_MAINNET ? 8453 : 84532;
    const USDC_ADDRESS = IS_MAINNET
        ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

    const handleSubmit = async () => {
        if (!isConnected || !address) {
            showAlert('Wallet Required', 'Please connect your wallet first.', 'warning');
            return;
        }

        setIsSubmitting(true);

        try {
            // 0. Verify Network
            if (chainId !== EXPECTED_CHAIN_ID) {
                try {
                    if (switchChainAsync) {
                        await switchChainAsync({ chainId: EXPECTED_CHAIN_ID });
                    }
                } catch (error) {
                    showAlert('Wrong Network', 'Please switch to Base.', 'error');
                    setIsSubmitting(false);
                    return;
                }
            }

            // 1. Create Prediction on Backend first to get ID
            // Note: We do this before payment to ensure we have a valid ID to bet on
            const response = await fetch('/api/predictions/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    betAmount: betAmount,
                    userAddress: address,
                    initialValue: currentValue,
                    maxEntrySize: 100, // Default max
                    minBet: 0.1,
                    displayName: cast.author.displayName,
                    pfpUrl: cast.author.pfp.url,
                    timeframe: '24h',
                    castHash: cast.hash,
                    castAuthor: cast.author.username,
                    castText: cast.text,
                    metric: metric,
                    targetValue: targetValue,
                    choice: choice,
                    isVersus: false,
                    castUrl: `https://warpcast.com/${cast.author.username}/${cast.hash}`,
                }),
            });

            const data = await response.json();

            if (!data.success || !data.predictionId) {
                throw new Error(data.error || 'Failed to create prediction record');
            }

            const predictionId = data.predictionId;

            // 2. Create on Chain
            console.log('Creating prediction on-chain:', predictionId);
            if (CURRENT_CONFIG.contractAddress) {
                try {
                    const duration = 86400; // 24h
                    const createHash = await writeContractAsync({
                        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                        abi: PredictionBattleABI.abi,
                        functionName: 'createPrediction',
                        args: [predictionId, BigInt(targetValue), BigInt(duration)],
                        gas: BigInt(500000),
                    });

                    if (publicClient) {
                        await publicClient.waitForTransactionReceipt({ hash: createHash });
                    }
                    console.log('On-chain creation confirmed');
                } catch (e) {
                    console.error('Contract creation failed:', e);
                    // We might continue if checking for existence isn't strict, but usually we should stop.
                    // However, letting it fail for now if contract is optional in dev.
                    if (IS_MAINNET) throw e;
                }
            }

            // 3. Approve USDC
            console.log('Approving USDC...');
            const amountInWei = parseUnits(betAmount.toString(), 6);
            const approveHash = await writeContractAsync({
                address: USDC_ADDRESS as `0x${string}`,
                abi: [{
                    name: 'approve',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
                    outputs: [{ name: '', type: 'bool' }]
                }],
                functionName: 'approve',
                args: [CURRENT_CONFIG.contractAddress as `0x${string}`, amountInWei],
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
            }

            // 4. Place Bet
            console.log('Placing bet...');
            const betHash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'placeBet',
                args: [predictionId, choice === 'yes', amountInWei],
                gas: BigInt(300000),
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash: betHash });
            }

            // 5. Update Backend with TxHash (Bet Registration)
            await fetch('/api/predictions/bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    betId: predictionId,
                    choice,
                    amount: betAmount,
                    txHash: betHash,
                    userAddress: address
                }),
            });

            setReceiptData({
                predictionId: predictionId,
                avatarUrl: cast.author.pfp.url,
                username: cast.author.username,
                action: "INITIATED BATTLE", // Different action text for creator
                amount: betAmount,
                potentialWin: betAmount * 2, // Creator creates the market, usually 2x if matched
                multiplier: 2.0,
                choice: choice === 'yes' ? 'YES' : 'NO',
                targetName: `hit ${targetValue} ${metric}`,
                variant: 'standard' // PredictionModal creates standard predictions mostly
            });

            setShowReceipt(true);

        } catch (error: any) {
            console.error('Error:', error);
            const msg = error.shortMessage || error.message || 'Failed to create prediction';
            showAlert('Error', msg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReceiptClose = () => {
        setShowReceipt(false);
        onClose(); // Close the modal when receipt is closed
    };

    if (showReceipt && receiptData) {
        return <ViralReceipt isOpen={true} onClose={handleReceiptClose} data={receiptData} />;
    }

    const handleShare = () => {
        const shareText = `I just bet ${betAmount} USDC that @${cast.author.username}'s cast will ${choice === 'yes' ? 'hit' : 'NOT hit'} ${targetValue} ${metric} in 24h! Join me on Prediction Battle 🔥`;
        const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent('https://prediction-battle.vercel.app')}`;
        window.open(url, '_blank');
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
