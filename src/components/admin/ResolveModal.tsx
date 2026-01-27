'use client';

import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { X, ExternalLink, check, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';
import { getContractAddress } from '@/lib/config';
import { formatUnits } from 'viem';

interface ResolveModalProps {
    isOpen: boolean;
    onClose: () => void;
    betId: string | undefined;
    username: string | undefined;
}

enum MarketState {
    OPEN = 0,
    LOCKED = 1,
    PROPOSED = 2,
    RESOLVED = 3
}

export default function ResolveModal({ isOpen, onClose, betId, username }: ResolveModalProps) {
    const [isResolving, setIsResolving] = useState(false);
    const contractAddress = getContractAddress();

    // 1. Read Market Data from Contract
    const { data: marketData, isLoading: isLoadingMarket, refetch } = useReadContract({
        address: contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'markets',
        args: betId ? [betId] : undefined,
        query: {
            enabled: !!betId && isOpen
        }
    });

    const { writeContractAsync } = useWriteContract();

    // Parse Market Data
    // Struct: id, question, deadline, totalYes, totalNo, state, result, isVoid, proposer, proposedResult, proposalTime, bondAmount, evidenceUrl
    const marketState = marketData ? Number(marketData[5]) : -1;
    const proposer = marketData ? String(marketData[8]) : '';
    const proposedResult = marketData ? Boolean(marketData[9]) : false;
    const evidenceUrl = marketData ? String(marketData[12]) : '';
    const bondAmount = marketData ? BigInt(marketData[11]) : 0n;

    const isProposed = marketState === MarketState.PROPOSED;

    const handleAction = async (action: 'finalize' | 'dispute' | 'void' | 'forceYes' | 'forceNo') => {
        if (!betId || !contractAddress) return;
        setIsResolving(true);

        try {
            let hash;

            if (action === 'finalize') {
                hash = await writeContractAsync({
                    address: contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'finalizeOutcome',
                    args: [betId]
                });
            } else if (action === 'dispute') {
                hash = await writeContractAsync({
                    address: contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'disputeOutcome',
                    args: [betId]
                });
            } else if (action === 'void') {
                hash = await writeContractAsync({
                    address: contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'voidMarket',
                    args: [betId]
                });
            } else if (action === 'forceYes') {
                hash = await writeContractAsync({
                    address: contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'adminResolve',
                    args: [betId, true]
                });
            } else if (action === 'forceNo') {
                hash = await writeContractAsync({
                    address: contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'adminResolve',
                    args: [betId, false]
                });
            }

            if (hash) {
                alert('Transaction Sent! please wait for confirmation.');
                onClose();
            }
        } catch (e: any) {
            console.error('Resolve error:', e);
            alert('Error: ' + (e.message || 'Transaction failed'));
        } finally {
            setIsResolving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-surface border border-darkGray rounded-3xl max-w-md w-full p-6 relative shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-textSecondary hover:text-white"
                >
                    <X className="w-6 h-6" />
                </button>

                <h3 className="text-xl font-bold text-textPrimary mb-1">
                    {isProposed ? '🛡️ Dispute Arbitration' : '⚡ Force Resolution'}
                </h3>
                <p className="text-sm text-textSecondary mb-6">
                    Manage market for <span className="font-bold text-white">@{username}</span>
                </p>

                {isLoadingMarket ? (
                    <div className="flex flex-col items-center py-8">
                        <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                        <p className="text-sm text-textSecondary">Fetching Contract State...</p>
                    </div>
                ) : (
                    <>
                        {isProposed ? (
                            <div className="bg-darkGray/50 rounded-xl p-4 mb-6 border border-white/5">
                                <div className="flex items-center gap-2 mb-3 text-yellow-500 font-bold text-sm uppercase tracking-wider">
                                    <AlertTriangle className="w-4 h-4" /> Active Proposal
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-textSecondary">Proposer:</span>
                                        <span className="font-mono text-white truncate max-w-[150px]" title={proposer}>
                                            {proposer.slice(0, 6)}...{proposer.slice(-4)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-textSecondary">Proposed Outcome:</span>
                                        <span className={`font-bold ${proposedResult ? 'text-green-500' : 'text-red-500'}`}>
                                            {proposedResult ? 'YES' : 'NO'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-textSecondary">Bond:</span>
                                        <span className="text-white">{formatUnits(bondAmount, 6)} USDC</span>
                                    </div>
                                    {evidenceUrl && (
                                        <a
                                            href={evidenceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-primary hover:underline mt-2 pt-2 border-t border-white/5"
                                        >
                                            <ExternalLink className="w-4 h-4" /> View Evidence
                                        </a>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-blue-500/10 rounded-xl p-4 mb-6 border border-blue-500/20 text-blue-200 text-sm">
                                <p className="flex items-start gap-2">
                                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                                    <span>
                                        No active proposal found on-chain. <br />
                                        You can force a result or void the market manually.
                                    </span>
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-3">
                            {isProposed ? (
                                <>
                                    <button
                                        onClick={() => handleAction('finalize')}
                                        disabled={isResolving}
                                        className="w-full p-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold transition-all shadow-lg shadow-green-500/20"
                                    >
                                        ✅ Confirm Proposal (Payout Proposer)
                                    </button>
                                    <button
                                        onClick={() => handleAction('dispute')}
                                        disabled={isResolving}
                                        className="w-full p-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-500/20"
                                    >
                                        ❌ Reject & Reopen (Slash Bond)
                                    </button>
                                </>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleAction('forceYes')}
                                        disabled={isResolving}
                                        className="p-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/50 text-green-500 font-bold transition-all"
                                    >
                                        Force YES
                                    </button>
                                    <button
                                        onClick={() => handleAction('forceNo')}
                                        disabled={isResolving}
                                        className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-500 font-bold transition-all"
                                    >
                                        Force NO
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={() => handleAction('void')}
                                disabled={isResolving}
                                className="w-full p-3 rounded-xl bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 font-bold transition-all"
                            >
                                ⛔ Void Market (Refund All)
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
