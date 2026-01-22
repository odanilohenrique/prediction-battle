'use client';

import { useState, useEffect } from 'react';
import { X, Heart, Repeat2, MessageCircle, DollarSign, TrendingUp, Share2, Zap, Copy, Check } from 'lucide-react';
import { Cast, MetricType, PredictionChoice } from '@/lib/types';
import { useModal } from '@/providers/ModalProvider';
import { useAccount, useWriteContract, usePublicClient, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';
import { CURRENT_CONFIG } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattleV4.json';
import ViralReceipt from './ViralReceipt';

interface PredictionModalProps {
    cast: Cast;
    onClose: () => void;
}

const BET_AMOUNTS = [0.05, 0.1, 0.5, 1];

type Timeframe = '30m' | '6h' | '12h' | '24h' | '7d' | 'none';

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
    '30m': 30 * 60,
    '6h': 6 * 60 * 60,
    '12h': 12 * 60 * 60,
    '24h': 24 * 60 * 60,
    '7d': 7 * 24 * 60 * 60,
    'none': 100 * 365 * 24 * 60 * 60,
};

const TIMEFRAME_CONFIG: Record<Timeframe, { label: string; shortLabel: string }> = {
    '30m': { label: '30 Minutes', shortLabel: '30m' },
    '6h': { label: '6 Hours', shortLabel: '6h' },
    '12h': { label: '12 Hours', shortLabel: '12h' },
    '24h': { label: '24 Hours', shortLabel: '24h' },
    '7d': { label: '7 Days', shortLabel: '7d' },
    'none': { label: 'Indefinite', shortLabel: '∞' },
};

// USDC ABI for approve
const USDC_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ type: 'bool' }]
    },
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
        ],
        outputs: [{ type: 'uint256' }]
    }
] as const;

export default function PredictionModal({ cast, onClose }: PredictionModalProps) {
    const { showAlert, showModal } = useModal();
    const { address, isConnected, chain } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const { switchChainAsync } = useSwitchChain();

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [metric, setMetric] = useState<MetricType>('likes');
    const [targetValue, setTargetValue] = useState<number>(0);
    const [choice, setChoice] = useState<PredictionChoice>('yes');
    const [timeframe, setTimeframe] = useState<Timeframe>('24h');
    const [betAmount, setBetAmount] = useState<number>(0.1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    // Referral State
    const [referrerAddress, setReferrerAddress] = useState<string | null>(null);
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);

    // Resolve incoming referral code
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const ref = params.get('ref');

            if (ref) {
                if (ref.startsWith('0x') && ref.length === 42) {
                    setReferrerAddress(ref);
                } else {
                    fetch(`/api/referral/resolve?code=${ref}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.success && data.address) {
                                setReferrerAddress(data.address);
                            }
                        })
                        .catch(err => console.error('Failed to resolve referral:', err));
                }
            }
        }
    }, []);

    // Fetch user's referral code
    useEffect(() => {
        if (address && isConnected && !referralCode) {
            fetch('/api/referral/code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) setReferralCode(data.code);
                })
                .catch(err => console.error('Failed to get referral code:', err));
        }
    }, [address, isConnected, referralCode]);

    // Set default target based on current engagement
    useEffect(() => {
        const currentValue = metric === 'likes' ? cast.likes :
            metric === 'recasts' ? cast.recasts : cast.replies;
        setTargetValue(Math.ceil(currentValue * 1.5));
    }, [metric, cast]);

    const handleSubmit = async () => {
        if (!isConnected || !address) {
            showAlert('Please connect your wallet first');
            return;
        }

        // Check network
        if (chain?.id !== CURRENT_CONFIG.chainId) {
            try {
                await switchChainAsync({ chainId: CURRENT_CONFIG.chainId });
            } catch {
                showAlert('Please switch to Base Sepolia network');
                return;
            }
        }

        setIsSubmitting(true);

        try {
            const predictionId = `${cast.hash}-${metric}-${targetValue}-${Date.now()}`;
            const amountInWei = parseUnits(betAmount.toString(), 6);
            const durationSeconds = TIMEFRAME_SECONDS[timeframe];

            // 1. Approve USDC
            const seedAmount = parseUnits((betAmount * 2).toString(), 6);

            const approveHash = await writeContractAsync({
                address: CURRENT_CONFIG.usdcAddress as `0x${string}`,
                abi: USDC_ABI,
                functionName: 'approve',
                args: [CURRENT_CONFIG.contractAddress as `0x${string}`, seedAmount],
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 60000 });
            }

            // 2. Create prediction and seed
            const createHash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'createPrediction',
                args: [predictionId, BigInt(targetValue), BigInt(durationSeconds), seedAmount],
                gas: BigInt(500000),
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash: createHash, timeout: 60000 });
            }

            // 3. Place bet with referrer
            const betHash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'placeBet',
                args: [
                    predictionId,
                    choice === 'yes',
                    amountInWei,
                    (referrerAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`
                ],
                gas: BigInt(350000),
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash: betHash, timeout: 60000 });
            }

            // 4. Register in backend
            await fetch('/api/predictions/user/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    predictionId,
                    castHash: cast.hash,
                    castUrl: `https://warpcast.com/${cast.username}/${cast.hash}`,
                    metric,
                    targetValue,
                    choice,
                    betAmount,
                    timeframe,
                    creatorAddress: address,
                }),
            });

            setReceiptData({
                prediction: { id: predictionId },
                choice,
                amount: betAmount,
                targetValue,
                metric,
            });
            setShowReceipt(true);

        } catch (error: any) {
            console.error('Prediction error:', error);
            showAlert(error.shortMessage || error.message || 'Transaction failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (showReceipt && receiptData) {
        return (
            <ViralReceipt
                prediction={receiptData.prediction}
                userChoice={receiptData.choice}
                betAmount={receiptData.amount}
                onClose={onClose}
            />
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-textPrimary">Create Prediction</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-textSecondary" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6">
                    {/* Cast Preview */}
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                        <p className="text-sm text-textSecondary line-clamp-2">{cast.text}</p>
                        <div className="flex gap-4 mt-2 text-xs text-textSecondary">
                            <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {cast.likes}</span>
                            <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" /> {cast.recasts}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {cast.replies}</span>
                        </div>
                    </div>

                    {/* Metric Selection */}
                    <div>
                        <label className="text-sm font-medium text-textSecondary mb-2 block">Metric</label>
                        <div className="flex gap-2">
                            {(['likes', 'recasts', 'replies'] as MetricType[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setMetric(m)}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${metric === m
                                        ? 'bg-primary text-black'
                                        : 'bg-white/5 text-textSecondary hover:bg-white/10'
                                        }`}
                                >
                                    {m.charAt(0).toUpperCase() + m.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target Value */}
                    <div>
                        <label className="text-sm font-medium text-textSecondary mb-2 block">Target Value</label>
                        <input
                            type="number"
                            value={targetValue}
                            onChange={(e) => setTargetValue(Number(e.target.value))}
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-textPrimary"
                        />
                    </div>

                    {/* Choice */}
                    <div>
                        <label className="text-sm font-medium text-textSecondary mb-2 block">Your Prediction</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setChoice('yes')}
                                className={`flex-1 py-3 rounded-lg font-bold transition-all ${choice === 'yes'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white/5 text-textSecondary hover:bg-white/10'
                                    }`}
                            >
                                YES - Will Hit
                            </button>
                            <button
                                onClick={() => setChoice('no')}
                                className={`flex-1 py-3 rounded-lg font-bold transition-all ${choice === 'no'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-white/5 text-textSecondary hover:bg-white/10'
                                    }`}
                            >
                                NO - Won't Hit
                            </button>
                        </div>
                    </div>

                    {/* Timeframe */}
                    <div>
                        <label className="text-sm font-medium text-textSecondary mb-2 block">Timeframe</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(Object.keys(TIMEFRAME_CONFIG) as Timeframe[]).map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`py-2 rounded-lg text-sm font-medium transition-all ${timeframe === tf
                                        ? 'bg-primary text-black'
                                        : 'bg-white/5 text-textSecondary hover:bg-white/10'
                                        }`}
                                >
                                    {TIMEFRAME_CONFIG[tf].shortLabel}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bet Amount */}
                    <div>
                        <label className="text-sm font-medium text-textSecondary mb-2 block">Bet Amount (USDC)</label>
                        <div className="flex gap-2">
                            {BET_AMOUNTS.map((amount) => (
                                <button
                                    key={amount}
                                    onClick={() => setBetAmount(amount)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${betAmount === amount
                                        ? 'bg-primary text-black'
                                        : 'bg-white/5 text-textSecondary hover:bg-white/10'
                                        }`}
                                >
                                    ${amount}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Referral Info */}
                    {referrerAddress && (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-xs text-purple-400">
                            <Zap className="w-4 h-4 inline mr-1" />
                            Referred by: {referrerAddress.slice(0, 6)}...{referrerAddress.slice(-4)}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !isConnected}
                        className="w-full bg-gradient-to-r from-primary to-purple-500 text-black font-bold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Processing...' : `Bet $${betAmount} on ${choice.toUpperCase()}`}
                    </button>

                    {/* Invite Friends */}
                    {address && (
                        <button
                            onClick={() => {
                                const codeToShare = referralCode || address;
                                const url = `${window.location.origin}${window.location.pathname}?ref=${codeToShare}`;
                                navigator.clipboard.writeText(url);
                                setLinkCopied(true);
                                setTimeout(() => setLinkCopied(false), 2000);
                            }}
                            className="w-full bg-surface border border-primary/30 hover:border-primary/50 text-textSecondary hover:text-textPrimary font-medium py-2 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            {linkCopied ? (
                                <>
                                    <Check className="w-4 h-4 text-green-500" />
                                    Link Copiado!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Convidar Amigos (5% Referral) {referralCode ? `[${referralCode}]` : ''}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
