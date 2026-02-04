
'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { useModal } from '@/providers/ModalProvider';
import { CURRENT_CONFIG } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';
import { ArrowLeft, Coins, Crown, Loader2 } from 'lucide-react';
import Link from 'next/link';

// New Components
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { StatsOverview } from '@/components/profile/StatsOverview';
import { BetHistoryList } from '@/components/profile/BetHistoryList';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { calculateUserStats, UserStats } from '@/lib/stats';
import { Bet } from '@/lib/store';

export default function ProfilePage() {
    const { address, isConnected } = useAccount();
    const { showAlert } = useModal();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    // Data State
    const [userProfile, setUserProfile] = useState<any>(null);
    const [allBets, setAllBets] = useState<Bet[]>([]);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // UI State
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isClaimingFees, setIsClaimingFees] = useState(false);

    // Creator Balance Read
    const { data: creatorBalance, refetch: refetchCreatorBalance } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'creatorBalance',
        args: [address || '0x0000000000000000000000000000000000000000'],
        query: {
            enabled: !!address,
        }
    }) as { data: bigint | undefined, refetch: () => void };

    useEffect(() => {
        if (address) {
            loadData();
        } else {
            setIsLoading(false);
        }
    }, [address]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Parallel Fetch: User Profile + Bets
            // Note: In a real app we'd have a specific endpoint for "my bets", 
            // but here we fetch all and filter client side as per store design.
            const [profileRes, betsRes] = await Promise.all([
                fetch(`/api/user?address=${address}`),
                fetch(`/api/predictions?limit=1000`) // Fetching large limit to get history
            ]);

            const profileData = await profileRes.json();
            const betsData = await betsRes.json();

            if (profileData.success) {
                setUserProfile(profileData.user);
            }

            if (betsData.predictions) {
                const bets = betsData.predictions as Bet[];
                setAllBets(bets);

                // Calculate Stats
                if (address) {
                    const computedStats = calculateUserStats(address, bets);
                    setStats(computedStats);
                }
            }

        } catch (error) {
            console.error('Failed to load profile data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClaimCreatorFees = async () => {
        if (!isConnected || !address) return;
        setIsClaimingFees(true);
        try {
            const hash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'claimCreatorRewards',
                args: [],
            });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash, timeout: 60000 });
            }
            showAlert('Success', 'Creator fees claimed successfully!', 'success');
            refetchCreatorBalance();
        } catch (error) {
            console.error('Claim Fees error:', error);
            showAlert('Error', (error as Error).message, 'error');
        } finally {
            setIsClaimingFees(false);
        }
    };

    if (!isConnected) {
        return (
            <main className="min-h-screen pt-24 pb-20 px-4 flex items-center justify-center">
                <div className="glass-card p-12 text-center rounded-3xl max-w-md w-full border border-white/10">
                    <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                    <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
                    <p className="text-white/40">Connect your wallet to view your battles and stats.</p>
                </div>
            </main>
        );
    }

    if (isLoading) {
        return (
            <main className="min-h-screen pt-24 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </main>
        );
    }

    // Filter bets for list
    const myBets = allBets.filter(b =>
        b.participants.yes.some(p => p.userId.toLowerCase() === address?.toLowerCase()) ||
        b.participants.no.some(p => p.userId.toLowerCase() === address?.toLowerCase())
    );

    const activeList = myBets.filter(b => b.status === 'active');
    const historyList = myBets.filter(b => b.status !== 'active');

    return (
        <main className="min-h-screen pb-24 pt-24 px-4 bg-[#0a0a0a]">
            {/* Background Ambience */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black pointer-events-none -z-10" />

            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Arena
                    </Link>
                </div>

                <ProfileHeader
                    address={address || ''}
                    displayName={userProfile?.display_name || ''}
                    pfpUrl={userProfile?.pfp_url || ''}
                    onEdit={() => setIsEditOpen(true)}
                />

                {stats && <div className="mb-10"><StatsOverview stats={stats} /></div>}

                {/* Creator Rewards Banner */}
                {creatorBalance && creatorBalance > BigInt(0) && (
                    <div className="mb-10 bg-gradient-to-r from-yellow-500/10 to-orange-600/10 border border-yellow-500/20 rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="p-3 bg-yellow-500/20 rounded-xl">
                                <Crown className="w-6 h-6 text-yellow-500" />
                            </div>
                            <div>
                                <h3 className="text-white font-black uppercase text-lg">Creator Rewards</h3>
                                <p className="text-white/50 text-xs">You have earnings available to claim.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="text-xl font-black text-white">
                                ${(Number(creatorBalance) / 1000000).toFixed(2)} <span className="text-xs text-yellow-500">USDC</span>
                            </div>
                            <button
                                onClick={handleClaimCreatorFees}
                                disabled={isClaimingFees}
                                className="bg-white text-black font-bold text-xs uppercase px-4 py-2.5 rounded-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                            >
                                {isClaimingFees && <Loader2 className="w-3 h-3 animate-spin" />}
                                Claim
                            </button>
                        </div>
                    </div>
                )}

                {/* Content Tabs */}
                <div className="flex items-center gap-8 mb-6 border-b border-white/5 pb-1">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`text-sm font-bold uppercase tracking-wider pb-3 border-b-2 transition-colors ${activeTab === 'active' ? 'text-white border-primary' : 'text-white/30 border-transparent hover:text-white'}`}
                    >
                        Active Bets ({activeList.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`text-sm font-bold uppercase tracking-wider pb-3 border-b-2 transition-colors ${activeTab === 'history' ? 'text-white border-primary' : 'text-white/30 border-transparent hover:text-white'}`}
                    >
                        History ({historyList.length})
                    </button>
                </div>

                {/* Tab Content */}
                <div className="animate-fade-in-up">
                    {activeTab === 'active' ? (
                        <BetHistoryList bets={activeList} address={address || ''} />
                    ) : (
                        <BetHistoryList bets={historyList} address={address || ''} />
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            <EditProfileModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                currentName={userProfile?.display_name || ''}
                currentPfp={userProfile?.pfp_url || ''}
                address={address || ''}
                onSaveSuccess={loadData}
            />
        </main>
    );
}
