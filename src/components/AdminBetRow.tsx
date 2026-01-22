'use client';

import { useState } from 'react';
import { Clock, Users, DollarSign, ExternalLink, Shield, AlertTriangle } from 'lucide-react';
import { useReadContract, useWriteContract, usePublicClient, useAccount } from 'wagmi';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';
import { CURRENT_CONFIG } from '@/lib/config';
import { useModal } from '@/providers/ModalProvider';
import VerificationModal from './VerificationModal';

interface BetMonitor {
    id: string;
    username: string;
    displayName?: string;
    pfpUrl?: string;
    type: string;
    target: number;
    timeframe: string;
    expiresAt: number;
    createdAt: number;
    totalPot: number;
    participantCount: number;
    participants: {
        yes: { userId: string; amount: number; timestamp: number }[];
        no: { userId: string; amount: number; timestamp: number }[];
    };
    castUrl?: string;
    castHash?: string;
    castText?: string;
    status: 'active' | 'completed';
    result?: 'yes' | 'no';
}

interface AdminBetRowProps {
    bet: BetMonitor;
    selectedBet: BetMonitor | null;
    setSelectedBet: (bet: BetMonitor | null) => void;
    fetchBets: () => void;
    handleVoid: (id: string) => void;
}

const formatTimeRemaining = (expiresAt: number) => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return { text: 'Expired', isExpired: true };

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return { text: `${days}d ${hours % 24}h`, isExpired: false };
    }
    return { text: `${hours}h ${minutes}m ${seconds}s`, isExpired: false };
};

export default function AdminBetRow({ bet, selectedBet, setSelectedBet, fetchBets, handleVoid }: AdminBetRowProps) {
    const { showConfirm, showAlert } = useModal();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const { address } = useAccount();

    const [showVerificationModal, setShowVerificationModal] = useState(false);

    // V3: Get Market State
    const { data: marketInfoV3 } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'getMarketInfo',
        args: [bet.id],
        query: {
            enabled: true,
            refetchInterval: 10000,
        }
    }) as { data: [string, bigint, number, boolean, bigint, bigint, bigint, bigint] | undefined };

    // MarketInfo V3: [creator, deadline, state, result, totalYes, totalNo, totalSharesYes, totalSharesNo]
    const marketStateV3 = marketInfoV3 ? Number(marketInfoV3[2]) : 0;
    const isMarketProposed = marketStateV3 === 2; // PROPOSED
    const isMarketResolved = marketStateV3 === 3; // RESOLVED
    const isMarketOpen = marketStateV3 === 0;

    // V3: Get Proposal Info
    const { data: proposalInfo } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'getProposalInfo',
        args: [bet.id],
        query: {
            enabled: isMarketProposed,
        }
    }) as { data: [string, boolean, bigint, bigint, bigint, boolean, string] | undefined };

    // V3: Get Required Bond
    const { data: requiredBond } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'getRequiredBond',
        args: [bet.id],
    }) as { data: bigint | undefined };

    // V3: Get Reporter Reward
    const { data: reporterReward } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'getReporterReward',
        args: [bet.id],
    }) as { data: bigint | undefined };

    const parsedProposalInfo = proposalInfo ? {
        proposer: proposalInfo[0],
        proposedResult: proposalInfo[1],
        proposalTime: proposalInfo[2],
        bondAmount: proposalInfo[3],
        disputeDeadline: proposalInfo[4],
        canFinalize: proposalInfo[5],
        evidenceUrl: proposalInfo[6],
    } : null;

    // Admin Actions
    const handleDispute = async () => {
        showConfirm('Confirm Dispute', 'Reject the current proposal properly? This will slash the proposer bond.', async () => {
            try {
                const hash = await writeContractAsync({
                    address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'disputeOutcome',
                    args: [bet.id],
                });
                showAlert('Dispute Initiated', `Tx: ${hash}`, 'success');
                if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
                fetchBets();
            } catch (error) {
                console.error(error);
                showAlert('Error', (error as Error).message, 'error');
            }
        });
    };

    const handleFinalize = async () => {
        try {
            const hash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'finalizeOutcome',
                args: [bet.id],
            });
            showAlert('Payouts Unlocked', `Tx: ${hash}`, 'success');
            if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
            fetchBets();
        } catch (error) {
            console.error(error);
            showAlert('Error', (error as Error).message, 'error');
        }
    };

    const timeInfo = formatTimeRemaining(bet.expiresAt);
    const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
    const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
    const isExpired = Date.now() > bet.expiresAt;

    // Mock AdminBet object for ValidationModal (it expects different shape)
    const mockBetForModal: any = {
        ...bet,
        minBet: 0,
        maxBet: 0,
        participants: { yes: [], no: [] } // Simplify for modal props if needed
    };

    return (
        <>
            <div
                className={`bg-surface border rounded-2xl p-6 transition-all cursor-pointer hover:border-primary/50 relative overflow-hidden ${isExpired && bet.status === 'active' ? 'border-yellow-500/50' : 'border-darkGray'
                    } ${selectedBet?.id === bet.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedBet(selectedBet?.id === bet.id ? null : bet)}
            >
                {/* Status Badge */}
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${bet.status === 'completed' || isMarketResolved ? 'bg-white/10 text-white' :
                    isMarketProposed ? 'bg-purple-500/20 text-purple-500 animate-pulse' :
                        isExpired ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'
                    }`}>
                    {bet.status === 'completed' || isMarketResolved ? 'RESOLVED' : isMarketProposed ? (parsedProposalInfo?.canFinalize ? 'RESOLVED (LOCKED)' : 'VERIFYING') : isExpired ? 'PENDING' : 'LIVE'}
                </div>

                {/* Header */}
                <div className="flex items-start justify-between mb-4 pr-20">
                    <div className="flex items-center gap-3">
                        {bet.pfpUrl ? (
                            <img
                                src={bet.pfpUrl}
                                alt={bet.username}
                                className="w-12 h-12 rounded-full object-cover border-2 border-primary/30"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
                                🎯
                            </div>
                        )}
                        <div>
                            <h3 className="font-bold text-textPrimary">
                                {bet.displayName || `@${bet.username}`}
                            </h3>
                            <p className="text-sm text-textSecondary">@{bet.username}</p>
                        </div>
                    </div>
                </div>

                {/* Question */}
                {bet.castText && (
                    <p className="text-textPrimary font-medium mb-3 bg-darkGray/30 p-3 rounded-xl">
                        "{bet.castText}"
                    </p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-textSecondary" />
                        <span className={isExpired ? 'text-yellow-500' : 'text-textPrimary'}>
                            {isExpired ? 'Expired' : timeInfo.text}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-textSecondary" />
                        <span className="text-textPrimary">{bet.participantCount} bettors</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <span className="text-primary font-bold">${bet.totalPot.toFixed(2)}</span>
                    </div>
                </div>

                {/* Expanded Actions */}
                {selectedBet?.id === bet.id && (
                    <div className="mt-6 pt-6 border-t border-darkGray space-y-4">

                        {/* V3 ACTIONS */}
                        {!isMarketResolved && (
                            <div className="grid grid-cols-1 gap-3">
                                {/* If PROPOSED: Show Dispute Logic */}
                                {isMarketProposed && parsedProposalInfo && (
                                    <div className={`border rounded-xl p-4 ${parsedProposalInfo.canFinalize ? 'bg-green-500/10 border-green-500/20' : 'bg-purple-500/10 border-purple-500/20'}`}>
                                        <h4 className={`font-bold mb-2 flex items-center gap-2 ${parsedProposalInfo.canFinalize ? 'text-green-500' : 'text-purple-400'}`}>
                                            <Shield className="w-4 h-4" />
                                            {parsedProposalInfo.canFinalize ? 'Resolution Confirmed' : 'Active Proposal'}
                                        </h4>
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-white/60">Proposed Result:</span>
                                            <span className={`font-black ${parsedProposalInfo.proposedResult ? 'text-green-500' : 'text-red-500'}`}>
                                                {parsedProposalInfo.proposedResult ? 'YES' : 'NO'}
                                            </span>
                                        </div>
                                        {parsedProposalInfo.evidenceUrl && (
                                            <a
                                                href={parsedProposalInfo.evidenceUrl.startsWith('http') ? parsedProposalInfo.evidenceUrl : `https://${parsedProposalInfo.evidenceUrl}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block w-full text-center py-2 mb-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-xs"
                                            >
                                                View Evidence ↗
                                            </a>
                                        )}
                                        {parsedProposalInfo.canFinalize ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleFinalize(); }}
                                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                            >
                                                <DollarSign className="w-4 h-4" />
                                                🔓 UNLOCK PAYOUTS
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDispute(); }}
                                                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                            >
                                                <AlertTriangle className="w-4 h-4" />
                                                DISPUTE / REJECT
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* If OPEN/LOCKED (Not Proposed): Show Propose Logic */}
                                {!isMarketProposed && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowVerificationModal(true); }}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <Shield className="w-4 h-4" />
                                            {isMarketOpen ? 'Early Resolution (Propose)' : 'Finalize (Propose)'}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleVoid(bet.id); }}
                                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-all"
                                        >
                                            Force Void
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Verification Modal for Admins (Proposing) */}
            {showVerificationModal && (
                <VerificationModal
                    isOpen={showVerificationModal}
                    onClose={() => setShowVerificationModal(false)}
                    marketId={bet.id}
                    marketQuestion={bet.castText || 'Market Verification'}
                    requiredBond={requiredBond || BigInt(0)}
                    reporterReward={reporterReward || BigInt(0)}
                    currentState={marketStateV3}
                    proposalInfo={parsedProposalInfo}
                    onSuccess={() => {
                        setShowVerificationModal(false);
                        fetchBets();
                    }}
                />
            )}
        </>
    );
}
