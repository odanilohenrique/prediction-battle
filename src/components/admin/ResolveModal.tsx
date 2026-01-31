'use client';

import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { X, ExternalLink, Check, Loader2, AlertTriangle, ShieldAlert, Gavel, Scale } from 'lucide-react';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';
import { getContractAddress } from '@/lib/config';
import { formatUnits } from 'viem';

interface ResolveModalProps {
    isOpen: boolean;
    onClose: () => void;
    betId: string | undefined;
    username: string | undefined;
    knownOnChainState?: number; // Pass known state from admin page to ensure correct UI
}

enum MarketState {
    OPEN = 0,
    LOCKED = 1,
    PROPOSED = 2,
    DISPUTED = 3,
    RESOLVED = 4
}

export default function ResolveModal({ isOpen, onClose, betId, username, knownOnChainState }: ResolveModalProps) {
    const [isResolving, setIsResolving] = useState(false);
    const [shouldReopen, setShouldReopen] = useState(false);
    const contractAddress = getContractAddress();

    // 1. Read Market Data from V5 Contract (markets mapping)
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

    // Parse V5 Struct (Handle Array or Object return from Viem)
    // 0:id, 1:creator, 2:question, 3:creationTime, 4:bonusDuration, 5:deadline, 6:state
    // 7:result, 8:isVoid, 9:proposer, 10:proposedResult, 11:proposalTime, 12:bondAmount, 13:evidenceUrl
    // 14:challenger, 15:challengeBondAmount, 16:challengeEvidenceUrl, 17:challengeTime

    // Helper to get field by name or index
    const getField = (data: any, name: string, index: number, type: 'string' | 'number' | 'bool' | 'bigint') => {
        if (!data) {
            if (type === 'string') return '';
            if (type === 'number') return -1;
            if (type === 'bool') return false;
            if (type === 'bigint') return BigInt(0);
        }

        let val = data[name];
        if (val === undefined) val = data[index];

        if (type === 'string') return String(val || '');
        if (type === 'number') return Number(val || 0);
        if (type === 'bool') return Boolean(val);
        if (type === 'bigint') return BigInt(val || 0);
        return val;
    };

    const marketState = getField(marketData, 'state', 6, 'number');
    const proposer = getField(marketData, 'proposer', 9, 'string');
    const proposedResult = getField(marketData, 'proposedResult', 10, 'bool');
    const evidenceUrl = getField(marketData, 'evidenceUrl', 13, 'string');
    const bondAmount = getField(marketData, 'bondAmount', 12, 'bigint');

    // Challenger Info
    const challenger = getField(marketData, 'challenger', 14, 'string');
    const challengeBondAmount = getField(marketData, 'challengeBondAmount', 15, 'bigint');
    const challengeEvidenceUrl = getField(marketData, 'challengeEvidenceUrl', 16, 'string');

    // Use knownOnChainState if provided, otherwise fall back to contract read
    const effectiveState = knownOnChainState !== undefined ? knownOnChainState : marketState;
    const isProposed = effectiveState === MarketState.PROPOSED;
    const isDisputed = effectiveState === MarketState.DISPUTED;

    const handleAction = async (action: 'finalize' | 'resolveDispute' | 'void' | 'forceYes' | 'forceNo', winner?: string, finalResult?: boolean) => {
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
            } else if (action === 'resolveDispute') {
                if (!winner) throw new Error("Winner required for dispute resolution");
                // resolveDispute(string _marketId, address _winnerAddress, bool _finalResult)
                hash = await writeContractAsync({
                    address: contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'resolveDispute',
                    args: [betId, winner, finalResult]
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
                alert('Transaction Sent! Please wait for confirmation.');
                onClose();
            }
        } catch (e: any) {
            console.error('Resolve error:', e);
            alert('Error: ' + (e.message || 'Transaction failed'));
        } finally {
            setIsResolving(false);
        }
    };

    // Helper to extract image URL
    const getLink = (raw: string) => {
        if (!raw) return '';
        return raw.split('\nImage: ')[0];
    };
    const getImage = (raw: string) => {
        if (!raw) return '';
        const parts = raw.split('\nImage: ');
        return parts.length > 1 ? parts[1] : '';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-surface border border-darkGray rounded-3xl max-w-2xl w-full p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-textSecondary hover:text-white"
                >
                    <X className="w-6 h-6" />
                </button>

                <h3 className="text-xl font-bold text-textPrimary mb-1 flex items-center gap-2">
                    <Gavel className="w-6 h-6 text-purple-500" />
                    {isDisputed ? 'ARBITRATE DISPUTE' : isProposed ? 'Verify Proposal' : 'Force Resolution'}
                </h3>
                <p className="text-sm text-textSecondary mb-6">
                    Market ID: {betId} | Creator: <span className="font-bold text-white">@{username}</span>
                </p>

                {isLoadingMarket ? (
                    <div className="flex flex-col items-center py-8">
                        <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                        <p className="text-sm text-textSecondary">Fetching Contract State...</p>
                    </div>
                ) : (
                    <>
                        {/* DISPUTE UI */}
                        {isDisputed && (
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                {/* Proposer Side */}
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                    <h4 className="font-bold text-green-400 mb-2 flex items-center gap-2">
                                        <Check className="w-4 h-4" /> Proposer (Defendent)
                                    </h4>
                                    <p className="text-xs text-textSecondary mb-1">Address: {proposer.slice(0, 6)}...</p>
                                    <p className="text-sm text-white mb-2">Outcome: <span className={proposedResult ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>{proposedResult ? 'YES' : 'NO'}</span></p>

                                    <p className="text-xs text-textSecondary">Evidence:</p>
                                    {evidenceUrl ? (
                                        <div className="mt-1">
                                            <a href={getLink(evidenceUrl)} target="_blank" className="text-primary text-xs underline truncate block">{getLink(evidenceUrl)}</a>
                                            {getImage(evidenceUrl) && <img src={getImage(evidenceUrl)} alt="Proof" className="mt-2 rounded-lg border border-white/10 w-full h-24 object-cover" />}
                                        </div>
                                    ) : <span className="text-white/30 text-xs">None</span>}

                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                                            <input
                                                type="checkbox"
                                                checked={shouldReopen}
                                                onChange={(e) => setShouldReopen(e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm text-white">Reopen Market (Extends 1 Year)</span>
                                        </label>

                                        <button
                                            onClick={() => handleAction('resolveDispute', proposer, proposedResult)}
                                            className="w-full py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg text-sm"
                                            disabled={isResolving}
                                        >
                                            Win for Proposer
                                        </button>
                                    </div>
                                </div>

                                {/* Challenger Side */}
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                    <h4 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                                        <Scale className="w-4 h-4" /> Challenger (Plaintiff)
                                    </h4>
                                    <p className="text-xs text-textSecondary mb-1">Address: {challenger.slice(0, 6)}...</p>
                                    <p className="text-sm text-white mb-2">Claim: <span className={!proposedResult ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>OPPOSITE</span></p>

                                    <p className="text-xs text-textSecondary">Evidence:</p>
                                    {challengeEvidenceUrl ? (
                                        <div className="mt-1">
                                            <a href={getLink(challengeEvidenceUrl)} target="_blank" className="text-primary text-xs underline truncate block">{getLink(challengeEvidenceUrl)}</a>
                                            {getImage(challengeEvidenceUrl) && <img src={getImage(challengeEvidenceUrl)} alt="Proof" className="mt-2 rounded-lg border border-white/10 w-full h-24 object-cover" />}
                                        </div>
                                    ) : <span className="text-white/30 text-xs">None</span>}

                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                                            <input
                                                type="checkbox"
                                                checked={shouldReopen}
                                                onChange={(e) => setShouldReopen(e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm text-white">Reopen Market (Extends 1 Year)</span>
                                        </label>

                                        <button
                                            onClick={() => handleAction('resolveDispute', challenger, !proposedResult)}
                                            className="w-full py-2 bg-red-500 hover:bg-red-400 text-black font-bold rounded-lg text-sm"
                                            disabled={isResolving}
                                        >
                                            Win for Challenger
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PROPOSAL UI (Undisputed) */}
                        {isProposed && (
                            <div className="bg-darkGray/50 rounded-xl p-4 mb-6 border border-white/5">
                                <div className="flex items-center gap-2 mb-3 text-yellow-500 font-bold text-sm uppercase tracking-wider">
                                    <AlertTriangle className="w-4 h-4" /> Active Proposal (Undisputed)
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
                                    {evidenceUrl && (
                                        <a
                                            href={getLink(evidenceUrl)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-primary hover:underline mt-2 pt-2 border-t border-white/5"
                                        >
                                            <ExternalLink className="w-4 h-4" /> View Evidence
                                        </a>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-3 mt-4">
                                    <button
                                        onClick={() => handleAction('finalize')}
                                        disabled={isResolving}
                                        className="w-full p-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold transition-all shadow-lg shadow-green-500/20"
                                    >
                                        ✅ Confirm Information
                                    </button>
                                    <div className="text-xs text-center text-white/40">
                                        Note: Users should finalize this if window passed. Admin action here forces it.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Fallback / Force Actions */}
                        {!isDisputed && (
                            <div className="border-t border-white/10 pt-4">
                                <h4 className="text-xs text-textSecondary uppercase mb-2 font-bold">Override Actions</h4>
                                <div className="grid grid-cols-2 gap-3 mb-3">
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
                                <button
                                    onClick={() => handleAction('void')}
                                    disabled={isResolving}
                                    className="w-full p-3 rounded-xl bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 font-bold transition-all"
                                >
                                    ⛔ Void Market (Refund All)
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
