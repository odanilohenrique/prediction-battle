'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Wallet, Loader2, CheckCircle, Gift } from 'lucide-react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { getContractAddress } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';

export default function EarningsCard() {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync, isPending } = useWriteContract();

    const [isWithdrawingCreator, setIsWithdrawingCreator] = useState(false);
    const [isWithdrawingReferrer, setIsWithdrawingReferrer] = useState(false);
    const [txSuccess, setTxSuccess] = useState<string | null>(null);

    const contractAddress = getContractAddress();

    // Read creator balance
    const { data: creatorBalanceRaw, refetch: refetchCreator } = useReadContract({
        address: contractAddress,
        abi: PredictionBattleABI.abi,
        functionName: 'creatorBalance',
        args: [address],
        query: { enabled: !!address }
    });

    // Read referrer/rewards balance
    const { data: referrerBalanceRaw, refetch: refetchReferrer } = useReadContract({
        address: contractAddress,
        abi: PredictionBattleABI.abi,
        functionName: 'rewardsBalance',
        args: [address],
        query: { enabled: !!address }
    });

    const creatorBalance = creatorBalanceRaw ? Number(formatUnits(creatorBalanceRaw as bigint, 6)) : 0;
    const referrerBalance = referrerBalanceRaw ? Number(formatUnits(referrerBalanceRaw as bigint, 6)) : 0;

    const totalEarnings = creatorBalance + referrerBalance;

    async function handleWithdrawCreatorFees() {
        if (!address || creatorBalance <= 0) return;
        setIsWithdrawingCreator(true);
        setTxSuccess(null);

        try {
            const hash = await writeContractAsync({
                address: contractAddress,
                abi: PredictionBattleABI.abi,
                functionName: 'withdrawCreatorFees',
                args: [],
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
            }

            setTxSuccess('Creator fees withdrawn!');
            refetchCreator();
        } catch (error) {
            console.error('Error withdrawing creator fees:', error);
        } finally {
            setIsWithdrawingCreator(false);
        }
    }

    async function handleWithdrawReferrerFees() {
        if (!address || referrerBalance <= 0) return;
        setIsWithdrawingReferrer(true);
        setTxSuccess(null);

        try {
            const hash = await writeContractAsync({
                address: contractAddress,
                abi: PredictionBattleABI.abi,
                functionName: 'withdrawReferrerFees',
                args: [],
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
            }

            setTxSuccess('Referrer rewards withdrawn!');
            refetchReferrer();
        } catch (error) {
            console.error('Error withdrawing referrer fees:', error);
        } finally {
            setIsWithdrawingReferrer(false);
        }
    }

    // Don't render if not connected or no earnings
    if (!isConnected || totalEarnings <= 0) {
        return null;
    }

    return (
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/30 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-green-400" />
                    <h3 className="text-lg font-bold text-white">My Earnings</h3>
                </div>
                <div className="text-2xl font-bold text-green-400">
                    ${totalEarnings.toFixed(2)} USDC
                </div>
            </div>

            {txSuccess && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-3 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-300">{txSuccess}</span>
                </div>
            )}

            <div className="space-y-3">
                {/* Creator Fees */}
                {creatorBalance > 0 && (
                    <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                        <div>
                            <div className="text-sm text-gray-400 flex items-center gap-1">
                                <DollarSign className="w-3 h-3" /> Creator Fees
                            </div>
                            <div className="text-lg font-bold text-white">
                                ${creatorBalance.toFixed(2)} USDC
                            </div>
                        </div>
                        <button
                            onClick={handleWithdrawCreatorFees}
                            disabled={isWithdrawingCreator || isPending}
                            className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                        >
                            {isWithdrawingCreator ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Claiming...
                                </>
                            ) : (
                                'Claim'
                            )}
                        </button>
                    </div>
                )}

                {/* Referrer Rewards */}
                {referrerBalance > 0 && (
                    <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                        <div>
                            <div className="text-sm text-gray-400 flex items-center gap-1">
                                <Gift className="w-3 h-3" /> Referral Rewards
                            </div>
                            <div className="text-lg font-bold text-white">
                                ${referrerBalance.toFixed(2)} USDC
                            </div>
                        </div>
                        <button
                            onClick={handleWithdrawReferrerFees}
                            disabled={isWithdrawingReferrer || isPending}
                            className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                        >
                            {isWithdrawingReferrer ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Claiming...
                                </>
                            ) : (
                                'Claim'
                            )}
                        </button>
                    </div>
                )}
            </div>

            <p className="text-xs text-gray-500 mt-3">
                Creator fees: 5% of bets on markets you created. Referral rewards: 5% of bets from users you referred.
            </p>
        </div>
    );
}
