'use client';

import { useState, useEffect } from 'react';
import { X, Heart, Repeat2, MessageCircle, DollarSign, TrendingUp, Share2, Zap, Copy, Check } from 'lucide-react';
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
// ... (interface)
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

export default function PredictionModal({ cast, onClose }: PredictionModalProps) {
    const { showAlert, showModal } = useModal();
    const [step, setStep] = useState<1 | 2 | 3>(1);

    const [metric, setMetric] = useState<MetricType>('likes');
    const [targetValue, setTargetValue] = useState<number>(0);
    const [choice, setChoice] = useState<PredictionChoice>('yes');
    const [timeframe, setTimeframe] = useState<Timeframe>('24h');
    const [betAmount, setBetAmount] = useState<number>(0.1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    // Referral & Boost State
    const [referrerAddress, setReferrerAddress] = useState<string | null>(null); // The resolved address
    const [referralCode, setReferralCode] = useState<string | null>(null); // The user's code to share
    const [boostMultiplier, setBoostMultiplier] = useState<number>(1.5);
    const [linkCopied, setLinkCopied] = useState(false);
    const [isLoadingCode, setIsLoadingCode] = useState(false);

    // 1. Consumer Side: Resolve incoming referral code to address
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const ref = params.get('ref');

            if (ref) {
                // Optimization: If it looks like an address, use it directly (legacy support)
                if (ref.startsWith('0x') && ref.length === 42) {
                    setReferrerAddress(ref);
                } else {
                    // Resolve short code
                    fetch(`/api/referral/resolve?code=${ref}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.success && data.address) {
                                console.log('Resolved referral:', ref, '->', data.address);
                                setReferrerAddress(data.address);
                            }
                        })
                        .catch(err => console.error('Failed to resolve referral:', err));
                }
            }
        }
    }, []);

    // 2. Creator Side: Fetch my short code when wallet connects
    useEffect(() => {
        if (address && isConnected && !referralCode) {
            // Fetch/Generate code (lazy load or on mount? Let's do on mount if connected)
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
    }, [address, isConnected]);

    // ... (boost simulation) ...

    // ... (handleSubmit using referrerAddress) ...

    // 4. Place Bet with Referrer
    console.log('Placing bet with referrer:', referrerAddress || 'none');
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

    // ...

    {/* Invite Friends Button */ }
    {
        address && (
            <button
                onClick={() => {
                    // Use short code if available, else fallback to address (should rarely happen if API works)
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
        )
    }
                        </div >
                    )
}
                </div >
            </div >
        </div >
    );
}
