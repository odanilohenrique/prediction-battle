'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useModal } from '@/providers/ModalProvider';
import { useAccount, useWriteContract, usePublicClient, useSwitchChain, useConnect, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { CURRENT_CONFIG } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';
import ViralReceipt from './ViralReceipt';

interface PredictionModalProps {
    predictionId: string;
    onClose: () => void;
    optionA?: { label: string };
    optionB?: { label: string };
    minBet?: number;
    maxBet?: number;
}

const BET_AMOUNTS = [0.05, 0.1, 0.5, 1];

export default function PredictionModal({ predictionId, onClose, optionA, optionB, minBet = 0.05, maxBet = 100 }: PredictionModalProps) {
    const { showAlert } = useModal();
    const { address, isConnected, chainId } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const { switchChainAsync } = useSwitchChain();
    const { connectors, connect } = useConnect();
    const publicClient = usePublicClient();

    const [choice, setChoice] = useState<'yes' | 'no'>('yes');
    const [betAmount, setBetAmount] = useState<string>(minBet.toString());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    // Referral State
    const [referrerAddress, setReferrerAddress] = useState<string | null>(null);
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);

    // Resolve incoming referral
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
                        .then(data => { if (data.success && data.address) setReferrerAddress(data.address); })
                        .catch(err => console.error('Referral resolve error:', err));
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
                .then(data => { if (data.success) setReferralCode(data.code); })
                .catch(err => console.error('Failed to get referral code:', err));
        }
    }, [address, isConnected, referralCode]);

    // Fetch Market Data for Slippage Calculation
    const { data: marketData } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'markets',
        args: [predictionId],
    }) as { data: any[] | undefined };

    const calculateMinShares = (amountInWei: bigint, isYes: boolean) => {
        if (!marketData) return BigInt(0);

        const totalYes = BigInt(marketData[18] || 0); // Index 18: totalYes (V7 Secure)
        const totalNo = BigInt(marketData[19] || 0);  // Index 19: totalNo (V7 Secure)

        const targetPool = isYes ? totalYes : totalNo;
        const oppositePool = isYes ? totalNo : totalYes;
        const SHARE_PRECISION = BigInt(10 ** 18);
        const MIN_WEIGHT = BigInt(100);
        const MAX_WEIGHT = BigInt(150);

        if (targetPool === BigInt(0) || oppositePool === BigInt(0)) {
            // Initial odds 1:1 (Weight 100%)
            // Shares = amount * 1e18
            return (amountInWei * SHARE_PRECISION * BigInt(99)) / BigInt(100); // 1% Slippage
        }

        const ratio = (oppositePool * SHARE_PRECISION) / targetPool;
        let weight = (ratio * BigInt(100)) / SHARE_PRECISION;

        if (weight < MIN_WEIGHT) weight = MIN_WEIGHT;
        if (weight > MAX_WEIGHT) weight = MAX_WEIGHT;

        const expectedShares = (amountInWei * SHARE_PRECISION * weight) / BigInt(100);

        // Apply 1% Slippage Tolerance
        return (expectedShares * BigInt(99)) / BigInt(100);
    };

    const handleSubmit = async () => {
        if (!isConnected) {
            const coinbaseConnector = connectors.find(c => c.id === 'coinbaseWalletSDK');
            if (coinbaseConnector) connect({ connector: coinbaseConnector });
            return;
        }

        const amount = parseFloat(betAmount);
        if (isNaN(amount) || amount < minBet || amount > maxBet) {
            showAlert('Invalid Amount', `Bet amount must be between ${minBet} and ${maxBet} USDC.`, 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            // Chain check
            if (chainId !== CURRENT_CONFIG.chainId) {
                await switchChainAsync({ chainId: CURRENT_CONFIG.chainId });
            }

            // Approve USDC
            const amountInWei = parseUnits(amount.toFixed(6), 6);
            const approveHash = await writeContractAsync({
                address: CURRENT_CONFIG.usdcAddress as `0x${string}`,
                abi: [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }] as const,
                functionName: 'approve',
                args: [CURRENT_CONFIG.contractAddress as `0x${string}`, amountInWei],
            });
            if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 60000 });

            // Calculate Min Shares
            const minSharesOut = calculateMinShares(amountInWei, choice === 'yes');
            console.log(`Slippage Protection: Amount=${amountInWei}, MinShares=${minSharesOut}`);

            // Place Bet
            const betHash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'placeBet',
                args: [
                    predictionId,
                    choice === 'yes',
                    amountInWei,
                    minSharesOut, // [NEW] Slippage Protection
                    (referrerAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`
                ],
                gas: BigInt(350000),
            });
            if (publicClient) await publicClient.waitForTransactionReceipt({ hash: betHash, timeout: 60000 });

            showAlert('Success!', 'Your bet has been placed.', 'success');
            setReceiptData({ betId: predictionId, choice, amount, txHash: betHash });
            setShowReceipt(true);

        } catch (error) {
            console.error('Bet error:', error);
            showAlert('Error', (error as Error).message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (showReceipt && receiptData) {
        return <ViralReceipt isOpen={true} data={receiptData} onClose={onClose} />;
    }

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-white to-primary opacity-50"></div>

                <div className="px-6 py-6 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-xl font-black text-white uppercase tracking-wider">Place Bet</h2>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Choice Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setChoice('yes')}
                            className={`py-4 rounded-xl font-black uppercase transition-all ${choice === 'yes' ? 'bg-green-500 text-white scale-105 shadow-lg shadow-green-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                        >
                            {optionA?.label || 'YES'}
                        </button>
                        <button
                            onClick={() => setChoice('no')}
                            className={`py-4 rounded-xl font-black uppercase transition-all ${choice === 'no' ? 'bg-red-500 text-white scale-105 shadow-lg shadow-red-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                        >
                            {optionB?.label || 'NO'}
                        </button>
                    </div>

                    {/* Amount Input */}
                    <div>
                        <label className="block text-sm font-bold text-white/60 mb-2">BET AMOUNT (USDC)</label>
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            min={minBet}
                            max={maxBet}
                            step="0.01"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-lg focus:outline-none focus:border-primary"
                        />
                        <div className="flex gap-2 mt-2">
                            {BET_AMOUNTS.map((amt) => (
                                <button
                                    key={amt}
                                    onClick={() => setBetAmount(amt.toString())}
                                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 font-medium text-sm transition-colors"
                                >
                                    ${amt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full bg-primary hover:bg-white hover:text-black text-black font-black py-4 rounded-xl transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(255,95,31,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'PROCESSING...' : isConnected ? 'PLACE BET' : 'CONNECT WALLET'}
                    </button>

                    {/* Invite Friends Button */}
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
                                    Link Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Invite Friends (5% Referral) {referralCode ? `[${referralCode}]` : ''}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
