'use client';

import { useState, useEffect } from 'react';
import { X, Shield, AlertTriangle, Clock, DollarSign, CheckCircle, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CURRENT_CONFIG, isAdmin } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';

// USDC Contract ABI (minimal for approve)
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

interface VerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    marketId: string;
    marketQuestion: string;
    requiredBond: bigint;       // V3: Bond amount in USDC (6 decimals)
    reporterReward: bigint;     // V3: 1% reward
    currentState: number;       // MarketState enum
    proposalInfo?: {
        proposer: string;
        proposedResult: boolean;
        disputeDeadline: bigint;
        canFinalize: boolean;
        evidenceUrl?: string; // V3.1
    } | null;
    onSuccess: () => void;
}

export default function VerificationModal({
    isOpen,
    onClose,
    marketId,
    marketQuestion,
    requiredBond,
    reporterReward,
    currentState,
    proposalInfo,
    onSuccess
}: VerificationModalProps) {
    const [mounted, setMounted] = useState(false);
    const [selectedResult, setSelectedResult] = useState<'yes' | 'no'>('yes');
    const [evidenceLink, setEvidenceLink] = useState(''); // Evidence State
    const [evidenceImage, setEvidenceImage] = useState<File | null>(null); // Image State
    const [step, setStep] = useState<'select' | 'approve' | 'propose' | 'success'>('select');
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const isAdminUser = address ? isAdmin(address) : false;
    const isLocked = currentState === 1;  // LOCKED
    const isProposed = currentState === 2; // PROPOSED
    const isMarketOpen = currentState === 0; // OPEN (but expired if modal is open)

    // Treat OPEN as LOCKED for UI purposes (initial verification step)
    const showProposeView = isLocked || isMarketOpen;

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setStep('select');
            setError(null);
            setEvidenceImage(null);
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!mounted || !isOpen) return null;

    const bondFormatted = formatUnits(requiredBond, 6);
    const rewardFormatted = formatUnits(reporterReward, 6);

    // Calculate time remaining for dispute
    const getTimeRemaining = () => {
        if (!proposalInfo?.disputeDeadline) return null;
        const now = BigInt(Math.floor(Date.now() / 1000));
        const remaining = proposalInfo.disputeDeadline - now;
        if (remaining <= 0) return 'Expired';
        const hours = Number(remaining) / 3600;
        if (hours >= 1) return `${hours.toFixed(1)}h remaining`;
        const minutes = Number(remaining) / 60;
        return `${Math.floor(minutes)}min remaining`;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setEvidenceImage(e.target.files[0]);
        }
    };

    const uploadImage = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('Failed to upload image');
        }

        const data = await response.json();
        return data.url;
    };

    const handleApproveAndPropose = async () => {
        if (!address || !publicClient) return;

        setIsLoading(true);
        setError(null);

        try {
            // Upload Image first if exists
            let finalEvidence = evidenceLink;
            if (evidenceImage) {
                setIsUploading(true);
                try {
                    const imageUrl = await uploadImage(evidenceImage);
                    finalEvidence = `${evidenceLink}\nImage: ${imageUrl}`;
                } catch (uploadErr) {
                    console.error('Upload failed:', uploadErr);
                    // Decide if we want to block or continue. Let's warn but continue with just link if user wants? 
                    // No, fail safe.
                    throw new Error('Image upload failed. Please try again or remove the image.');
                } finally {
                    setIsUploading(false);
                }
            }

            // Step 1: Check current allowance
            setStep('approve');
            const allowance = await publicClient.readContract({
                address: CURRENT_CONFIG.usdcAddress as `0x${string}`,
                abi: USDC_ABI,
                functionName: 'allowance',
                args: [address, CURRENT_CONFIG.contractAddress as `0x${string}`]
            }) as bigint;

            // If allowance is insufficient, approve
            if (allowance < requiredBond) {
                const approveTx = await writeContractAsync({
                    address: CURRENT_CONFIG.usdcAddress as `0x${string}`,
                    abi: USDC_ABI,
                    functionName: 'approve',
                    args: [CURRENT_CONFIG.contractAddress as `0x${string}`, requiredBond * BigInt(2)]
                });

                const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx });
                if (approveReceipt.status !== 'success') {
                    throw new Error('USDC Approval failed on-chain');
                }
            }

            // Step 2: Propose outcome
            setStep('propose');
            const proposeTx = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'proposeOutcome',
                args: [marketId, selectedResult === 'yes', finalEvidence] // V3.1: Add evidence
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash: proposeTx });

            if (receipt.status !== 'success') {
                throw new Error('Transaction execution failed on-chain. The proposal was reverted.');
            }

            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);

        } catch (err: any) {
            console.error('Verification failed:', err);
            setError(err.message || 'Transação falhou');
            setStep('select');
        } finally {
            setIsLoading(false);
            setIsUploading(false);
        }
    };

    const handleDispute = async () => {
        if (!address || !publicClient) return;

        setIsLoading(true);
        setError(null);

        try {
            const disputeTx = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'disputeOutcome',
                args: [marketId]
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash: disputeTx });
            if (receipt.status !== 'success') {
                throw new Error('Dispute transaction failed on-chain.');
            }

            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);

        } catch (err: any) {
            console.error('Dispute failed:', err);
            setError(err.message || 'Disputa falhou');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalize = async () => {
        if (!address || !publicClient) return;

        setIsLoading(true);
        setError(null);

        try {
            const finalizeTx = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'finalizeOutcome',
                args: [marketId]
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash: finalizeTx });
            if (receipt.status !== 'success') {
                throw new Error('Finalize transaction failed on-chain.');
            }

            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);

        } catch (err: any) {
            console.error('Finalize failed:', err);
            setError(err.message || 'Finalização falhou');
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to extract image URL from evidence string if present
    const parseEvidence = (evidence: string) => {
        if (!evidence) return { link: '', image: '' };
        const parts = evidence.split('\nImage: ');
        return {
            link: parts[0],
            image: parts.length > 1 ? parts[1] : ''
        };
    };

    const EvidenceDisplay = ({ evidenceUrl }: { evidenceUrl: string }) => {
        const { link, image } = parseEvidence(evidenceUrl);
        return (
            <div className="flex flex-col gap-1">
                {link && (
                    <p className="text-xs text-textSecondary mt-1 truncate">
                        Evidence: <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{link}</a>
                    </p>
                )}
                {image && (
                    <p className="text-xs text-textSecondary mt-1 truncate">
                        Image: <a href={image} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Image</a>
                    </p>
                )}
            </div>
        );
    };

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
                {/* Glow Effect */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors disabled:opacity-50"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-8 h-8 text-primary" />
                    <div>
                        <h3 className="text-xl font-black text-white">
                            {isProposed ? 'Verification in Progress' : 'Verify Outcome'}
                        </h3>
                        <p className="text-xs text-textSecondary">ID: {marketId}</p>
                    </div>
                </div>

                {/* Market Question */}
                <div className="bg-black/30 rounded-xl p-3 mb-4 border border-white/5">
                    <p className="text-sm text-white">{marketQuestion}</p>
                </div>

                {/* Different Views Based on State */}
                {step === 'success' ? (
                    <div className="flex flex-col items-center py-8">
                        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                        <h4 className="text-lg font-bold text-white">Success!</h4>
                        <p className="text-sm text-textSecondary">Transaction confirmed</p>
                    </div>
                ) : isProposed && proposalInfo ? (
                    // Proposal View (for PROPOSED state)
                    <div className="space-y-4">
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-yellow-500" />
                                <span className="text-yellow-500 font-bold text-sm">Dispute Window Open</span>
                            </div>
                            <p className="text-xs text-textSecondary">
                                Proposed Result: <span className={`font-bold ${proposalInfo.proposedResult ? 'text-green-500' : 'text-red-500'}`}>
                                    {proposalInfo.proposedResult ? 'YES' : 'NO'}
                                </span>
                            </p>
                            <p className="text-xs text-textSecondary mt-1">
                                By: {proposalInfo.proposer.substring(0, 6)}...{proposalInfo.proposer.substring(38)}
                            </p>
                            {proposalInfo.evidenceUrl && <EvidenceDisplay evidenceUrl={proposalInfo.evidenceUrl} />}
                            <p className="text-xs text-white/40 mt-1">
                                Time Remaining: {getTimeRemaining()}
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                <p className="text-red-400 text-xs">{error}</p>
                            </div>
                        )}

                        {/* Admin Actions */}
                        {isAdminUser && (
                            <button
                                onClick={handleDispute}
                                disabled={isLoading}
                                className="w-full py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                                Dispute (It's Fake/Wrong)
                            </button>
                        )}

                        {/* Finalize Button (anyone can call after window) */}
                        {proposalInfo.canFinalize && (
                            <button
                                onClick={handleFinalize}
                                disabled={isLoading}
                                className="w-full py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Finalize Verification
                            </button>
                        )}
                    </div>
                ) : showProposeView ? (
                    // Propose View (for OPEN, LOCKED or REFUNDED state)
                    <div className="space-y-4">
                        {/* Result Selection */}
                        <div>
                            <p className="text-xs text-textSecondary mb-2">What was the outcome?</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setSelectedResult('yes')}
                                    disabled={isLoading}
                                    className={`py-3 rounded-xl font-bold transition-all ${selectedResult === 'yes'
                                        ? 'bg-green-500 text-black'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    YES ✓
                                </button>
                                <button
                                    onClick={() => setSelectedResult('no')}
                                    disabled={isLoading}
                                    className={`py-3 rounded-xl font-bold transition-all ${selectedResult === 'no'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    NO ✗
                                </button>
                            </div>
                        </div>

                        {/* Bond Info */}
                        <div className="bg-black/30 rounded-xl p-4 border border-white/5 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-textSecondary flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" /> Bond Required
                                </span>
                                <span className="text-sm font-bold text-white">${bondFormatted} USDC</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-textSecondary flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Reward (if honest)
                                </span>
                                <span className="text-sm font-bold text-green-500">+${rewardFormatted} USDC</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-textSecondary flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Dispute Window
                                </span>
                                <span className="text-sm font-bold text-yellow-500">12 hours</span>
                            </div>
                        </div>

                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-500/80">
                                    If you lie and get disputed, you will lose 100% of your bond.
                                </p>
                            </div>
                        </div>

                        {/* Evidence Input */}
                        <div>
                            <label className="text-xs text-textSecondary mb-1 block">Proof / Evidence Link (Required)</label>
                            <div className="space-y-2">
                                <input
                                    type="url"
                                    placeholder="https://warpcast.com/..."
                                    value={evidenceLink}
                                    onChange={(e) => setEvidenceLink(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                                />
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="text-white text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-black hover:file:bg-white transition-all w-full bg-black/40 rounded-lg border border-white/10"
                                    />
                                </div>
                                {evidenceImage && (
                                    <p className="text-xs text-green-400">Image selected: {evidenceImage.name}</p>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                <p className="text-red-400 text-xs">{error}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={isLoading}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 font-bold hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApproveAndPropose}
                                disabled={isLoading || !evidenceLink} // Require at least link
                                className="flex-1 py-3 bg-primary hover:bg-white text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {isUploading ? 'Uploading...' : step === 'approve' ? 'Approving...' : 'Sending...'}
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-4 h-4" />
                                        Report & Earn
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    // Not in correct state
                    <div className="text-center py-8">
                        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <p className="text-textSecondary text-sm">
                            This market is not ready for verification.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
