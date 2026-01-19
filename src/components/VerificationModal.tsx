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
    const [step, setStep] = useState<'select' | 'lock' | 'approve' | 'propose' | 'success'>('select');
    const [isLoading, setIsLoading] = useState(false);
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
        if (remaining <= 0) return 'Expirado';
        const hours = Number(remaining) / 3600;
        if (hours >= 1) return `${hours.toFixed(1)}h restantes`;
        const minutes = Number(remaining) / 60;
        return `${Math.floor(minutes)}min restantes`;
    };

    const handleApproveAndPropose = async () => {
        if (!address || !publicClient) return;

        setIsLoading(true);
        setError(null);

        try {
            // Step 0: Lock Market (if still OPEN)
            if (isMarketOpen) {
                setStep('lock');
                const lockTx = await writeContractAsync({
                    address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'lockMarket',
                    args: [marketId]
                });
                await publicClient.waitForTransactionReceipt({ hash: lockTx });
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

                await publicClient.waitForTransactionReceipt({ hash: approveTx });
            }

            // Step 2: Propose outcome
            setStep('propose');
            const proposeTx = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'proposeOutcome',
                args: [marketId, selectedResult === 'yes']
            });

            await publicClient.waitForTransactionReceipt({ hash: proposeTx });

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

            await publicClient.waitForTransactionReceipt({ hash: disputeTx });

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

            await publicClient.waitForTransactionReceipt({ hash: finalizeTx });

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
                            {isProposed ? 'Verificação em Andamento' : 'Verificar Resultado'}
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
                        <h4 className="text-lg font-bold text-white">Sucesso!</h4>
                        <p className="text-sm text-textSecondary">Transação confirmada</p>
                    </div>
                ) : isProposed && proposalInfo ? (
                    // Proposal View (for PROPOSED state)
                    <div className="space-y-4">
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-yellow-500" />
                                <span className="text-yellow-500 font-bold text-sm">Aguardando Finalização</span>
                            </div>
                            <p className="text-xs text-textSecondary">
                                Resultado proposto: <span className={`font-bold ${proposalInfo.proposedResult ? 'text-green-500' : 'text-red-500'}`}>
                                    {proposalInfo.proposedResult ? 'SIM' : 'NÃO'}
                                </span>
                            </p>
                            <p className="text-xs text-textSecondary mt-1">
                                Por: {proposalInfo.proposer.substring(0, 6)}...{proposalInfo.proposer.substring(38)}
                            </p>
                            <p className="text-xs text-white/40 mt-1">
                                Janela de disputa: {getTimeRemaining()}
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
                                Disputar (É Mentira)
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
                                Finalizar Verificação
                            </button>
                        )}
                    </div>
                ) : showProposeView ? (
                    // Propose View (for LOCKED or OPEN+Expired state)
                    <div className="space-y-4">
                        {/* Result Selection */}
                        <div>
                            <p className="text-xs text-textSecondary mb-2">Qual foi o resultado?</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setSelectedResult('yes')}
                                    disabled={isLoading}
                                    className={`py-3 rounded-xl font-bold transition-all ${selectedResult === 'yes'
                                        ? 'bg-green-500 text-black'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    SIM ✓
                                </button>
                                <button
                                    onClick={() => setSelectedResult('no')}
                                    disabled={isLoading}
                                    className={`py-3 rounded-xl font-bold transition-all ${selectedResult === 'no'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    NÃO ✗
                                </button>
                            </div>
                        </div>

                        {/* Bond Info */}
                        <div className="bg-black/30 rounded-xl p-4 border border-white/5 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-textSecondary flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" /> Garantia (Bond)
                                </span>
                                <span className="text-sm font-bold text-white">${bondFormatted} USDC</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-textSecondary flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Recompensa (se honesto)
                                </span>
                                <span className="text-sm font-bold text-green-500">+${rewardFormatted} USDC</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-textSecondary flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Janela de disputa
                                </span>
                                <span className="text-sm font-bold text-yellow-500">12 horas</span>
                            </div>
                        </div>

                        {/* Warning */}
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-500/80">
                                    Se você mentir e for disputado, perderá 100% da garantia.
                                </p>
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
                                Cancelar
                            </button>
                            <button
                                onClick={handleApproveAndPropose}
                                disabled={isLoading}
                                className="flex-1 py-3 bg-primary hover:bg-white text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {step === 'lock' ? 'Encerrando Mercado...' : step === 'approve' ? 'Aprovando...' : 'Enviando...'}
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-4 h-4" />
                                        Reportar & Ganhar
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
                            Este mercado não está pronto para verificação.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
