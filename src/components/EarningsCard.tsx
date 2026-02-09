'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Wallet, Loader2, CheckCircle, Gift, Shield, Landmark } from 'lucide-react';
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

    // Read claimable bonds (V6.1)
    const { data: claimableBondsRaw, refetch: refetchBonds } = useReadContract({
        address: contractAddress,
        abi: PredictionBattleABI.abi,
        functionName: 'claimableBonds',
        args: [address],
        query: { enabled: !!address }
    });

    // Read Admin Status & House Fees (V6.1)
    const { data: adminAddress } = useReadContract({
        address: contractAddress,
        abi: PredictionBattleABI.abi,
        functionName: 'admin',
    });

    const isAdmin = !!(address && adminAddress && address.toLowerCase() === (adminAddress as string).toLowerCase());

    const { data: houseBalanceRaw, refetch: refetchHouse } = useReadContract({
        address: contractAddress,
        abi: PredictionBattleABI.abi,
        functionName: 'houseBalance',
        query: { enabled: !!isAdmin } // Only fetch if admin
    });

    const creatorBalance = creatorBalanceRaw ? Number(formatUnits(creatorBalanceRaw as bigint, 6)) : 0;
    const referrerBalance = referrerBalanceRaw ? Number(formatUnits(referrerBalanceRaw as bigint, 6)) : 0;
    const bondBalance = claimableBondsRaw ? Number(formatUnits(claimableBondsRaw as bigint, 6)) : 0;
    const houseBalance = houseBalanceRaw ? Number(formatUnits(houseBalanceRaw as bigint, 6)) : 0;

    const totalEarnings = creatorBalance + referrerBalance + bondBalance; // House fees NOT included in personal earnings

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

    const [isWithdrawingBond, setIsWithdrawingBond] = useState(false);

    async function handleWithdrawBond() {
        if (!address || bondBalance <= 0) return;
        setIsWithdrawingBond(true);
        setTxSuccess(null);

        try {
            const hash = await writeContractAsync({
                address: contractAddress,
                abi: PredictionBattleABI.abi,
                functionName: 'withdrawBond',
                args: [],
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
            }

            setTxSuccess('Bond + Rewards withdrawn!');
            refetchBonds();
        } catch (error) {
            console.error('Error withdrawing bond:', error);
        } finally {
            setIsWithdrawingBond(false);
        }
    }

    const [isWithdrawingHouse, setIsWithdrawingHouse] = useState(false);

    async function handleWithdrawHouseFees() {
        if (!isAdmin || houseBalance <= 0) return;
        setIsWithdrawingHouse(true);
        setTxSuccess(null);

        try {
            const hash = await writeContractAsync({
                address: contractAddress,
                abi: PredictionBattleABI.abi,
                functionName: 'withdrawHouseFees', // V6.1 -> Sends to Treasury
                args: [],
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
            }

            setTxSuccess('Protocol Fees sent to Treasury!');
            refetchHouse();
        } catch (error) {
            console.error('Error withdrawing house fees:', error);
        } finally {
            setIsWithdrawingHouse(false);
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

                {/* Bond Returns (V6.1) */}
                {bondBalance > 0 && (
                    <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-yellow-500/20">
                        <div>
                            <div className="text-sm text-gray-400 flex items-center gap-1">
                                <Shield className="w-3 h-3 text-yellow-500" /> Bond Returns
                            </div>
                            <div className="text-lg font-bold text-white">
                                ${bondBalance.toFixed(2)} USDC
                            </div>
                        </div>
                        <button
                            onClick={handleWithdrawBond}
                            disabled={isWithdrawingBond || isPending}
                            className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                        >
                            {isWithdrawingBond ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Claiming...
                                </>
                            ) : (
                                'Withdraw'
                            )}
                        </button>
                    </div>
                )}
            </div>

            <p className="text-xs text-gray-500 mt-3">
                Creator fees: 5% of bets on markets you created. Referral rewards: 5% of bets from users you referred.
            </p>

            {/* Admin Section */}
            {isAdmin && (
                <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Landmark className="w-5 h-5 text-purple-400" />
                            <h3 className="text-lg font-bold text-white">Protocol Admin</h3>
                        </div>
                    </div>

                    <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                        <div>
                            <div className="text-sm text-gray-400 flex items-center gap-1">
                                <Landmark className="w-3 h-3 text-purple-400" /> Undistributed Fees
                            </div>
                            <div className="text-lg font-bold text-white">
                                ${houseBalance.toFixed(2)} USDC
                            </div>
                            <div className="text-xs text-purple-300 mt-1">
                                Sends to Treasury
                            </div>
                        </div>
                        <button
                            onClick={handleWithdrawHouseFees}
                            disabled={isWithdrawingHouse || isPending || houseBalance <= 0}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                        >
                            {isWithdrawingHouse ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                'Flush to Treasury'
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
