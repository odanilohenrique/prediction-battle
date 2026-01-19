'use client';

import { useState, useEffect } from 'react';
import { Coins, ArrowLeft, Trophy, Skull, Activity, Users, Crown, Clock, Edit3, Save, X, Calendar, ChevronDown, ChevronUp, Link as LinkIcon, Upload, ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { useModal } from '@/providers/ModalProvider';
import { CURRENT_CONFIG } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';
import { parseEther } from 'viem';

export default function ProfilePage() {
    const { showAlert } = useModal();
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    // Creator Fees Logic
    const [isClaimingFees, setIsClaimingFees] = useState(false);

    const { data: creatorBalance, refetch: refetchCreatorBalance } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'creatorBalance',
        args: [address || '0x0000000000000000000000000000000000000000'],
        query: {
            enabled: !!address,
        }
    }) as { data: bigint | undefined, refetch: () => void };

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

    // Profile Data
    const [displayName, setDisplayName] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Photo Editing State
    const [showPhotoEdit, setShowPhotoEdit] = useState(false);
    const [photoMode, setPhotoMode] = useState<'upload' | 'url'>('url');
    const [tempPhotoUrl, setTempPhotoUrl] = useState(''); // For URL input preview

    // Stats (Mocked or Partial for now)
    const [wins, setWins] = useState(0);
    const [losses, setLosses] = useState(0);
    const [winRate, setWinRate] = useState(0);
    const [netProfit, setNetProfit] = useState(0);
    const [activeBets, setActiveBets] = useState<any[]>([]);
    const [historyBets, setHistoryBets] = useState<any[]>([]);
    const [expandedBetId, setExpandedBetId] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        if (address) {
            loadProfile();
            // TODO: Load real stats here if API exists
        }
    }, [address]);

    const loadProfile = async () => {
        setIsLoadingProfile(true);
        try {
            const res = await fetch(`/api/user?address=${address}`);
            const data = await res.json();
            if (data.success && data.user) {
                setDisplayName(data.user.display_name || '');
                setPhotoUrl(data.user.pfp_url || '');
            }
        } catch (e) {
            console.error('Failed to load profile', e);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!address) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    displayName,
                    pfpUrl: photoUrl
                })
            });
            const data = await res.json();
            if (data.success) {
                showAlert('Profile Saved', 'Your profile has been updated.', 'success');
                setShowPhotoEdit(false);
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            showAlert('Save Failed', 'Could not save profile.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit
                showAlert('File Too Large', 'Image must be under 1MB.', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPhotoUrl(result);
                setTempPhotoUrl(''); // Clear URL input if file is chosen
            };
            reader.readAsDataURL(file);
        }
    };

    const applyUrlPhoto = () => {
        if (!tempPhotoUrl) return;
        setPhotoUrl(tempPhotoUrl);
        setTempPhotoUrl('');
    };

    return (
        <main className="min-h-screen bg-transparent pb-20 pt-24 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/5">
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase italic">User Profile</h1>
                            <p className="text-xs text-white/40 font-mono tracking-widest">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not Connected'}</p>
                        </div>
                    </div>
                </div>

                {!isConnected ? (
                    <div className="glass-card p-12 text-center rounded-2xl border border-white/10">
                        <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Wallet Not Connected</h3>
                        <p className="text-white/40">Please connect your wallet to view and edit your profile.</p>
                    </div>
                ) : (
                    <>
                        {/* Profile Editor Card */}
                        <div className="glass-card p-6 md:p-8 rounded-3xl mb-8 border border-white/5 bg-gradient-to-br from-surface to-black relative overflow-hidden group">
                            {/* Background Glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

                            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                                {/* Photo Section */}
                                <div className="flex flex-col items-center gap-3">
                                    <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white/5 bg-black overflow-hidden shadow-2xl">
                                        {photoUrl ? (
                                            <img src={photoUrl} className="w-full h-full object-cover" alt="Profile" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                                                <Users className="w-10 h-10 text-white/20" />
                                            </div>
                                        )}
                                        {/* Edit Overlay */}
                                        <button
                                            onClick={() => setShowPhotoEdit(!showPhotoEdit)}
                                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity cursor-pointer"
                                        >
                                            <Edit3 className="w-6 h-6 text-white mb-1" />
                                            <span className="text-[10px] text-white font-bold uppercase tracking-wide">Change</span>
                                        </button>
                                    </div>
                                    <div className="text-xs text-white/30 uppercase tracking-widest font-bold">Avatar</div>
                                </div>

                                {/* Info Section */}
                                <div className="flex-1 w-full space-y-6">
                                    {/* Name Input */}
                                    <div>
                                        <label className="text-xs text-textSecondary uppercase font-bold mb-2 block flex items-center gap-2">
                                            Display Name
                                            <Edit3 className="w-3 h-3 text-white/20" />
                                        </label>
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            placeholder="Enter your display name..."
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-lg md:text-xl font-bold text-white focus:outline-none focus:border-primary placeholder:text-white/10 focus:bg-black/40 transition-all"
                                        />
                                    </div>

                                    {/* Enhanced Photo Editor (Collapsible) */}
                                    {showPhotoEdit && (
                                        <div className="bg-black/30 rounded-xl p-4 border border-white/10 animate-fade-in-up">
                                            <div className="flex items-center gap-4 mb-4 border-b border-white/5 pb-2">
                                                <button
                                                    onClick={() => setPhotoMode('url')}
                                                    className={`text-xs font-bold uppercase px-2 py-1 transition-colors ${photoMode === 'url' ? 'text-primary' : 'text-white/40 hover:text-white'}`}
                                                >
                                                    Use URL
                                                </button>
                                                <button
                                                    onClick={() => setPhotoMode('upload')}
                                                    className={`text-xs font-bold uppercase px-2 py-1 transition-colors ${photoMode === 'upload' ? 'text-primary' : 'text-white/40 hover:text-white'}`}
                                                >
                                                    Upload File
                                                </button>
                                            </div>

                                            {photoMode === 'url' ? (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={tempPhotoUrl}
                                                        onChange={(e) => setTempPhotoUrl(e.target.value)}
                                                        placeholder="https://..."
                                                        className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                                                    />
                                                    <button
                                                        onClick={applyUrlPhoto}
                                                        className="bg-white/10 hover:bg-white/20 text-white px-3 rounded-lg text-xs font-bold uppercase"
                                                    >
                                                        Apply
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-lg hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer">
                                                    <Upload className="w-6 h-6 text-white/40 mb-2" />
                                                    <span className="text-xs text-white/40 font-bold uppercase">Click to Upload Image</span>
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                                </label>
                                            )}
                                        </div>
                                    )}

                                    {/* Save Button */}
                                    <div className="flex justify-end pt-2">
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={isSaving}
                                            className={`
                                                flex items-center gap-2 bg-primary text-black font-black px-6 py-3 rounded-xl 
                                                hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20
                                                ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}
                                            `}
                                        >
                                            {isSaving ? (
                                                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                            ) : (
                                                <Save className="w-5 h-5" />
                                            )}
                                            {isSaving ? 'SAVING...' : 'SAVE PROFILE'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Creator Earnings Section */}
                        {creatorBalance && creatorBalance > BigInt(0) && (
                            <div className="mb-8">
                                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

                                    <div className="flex items-center gap-6 relative z-10">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                                            <Crown className="w-8 h-8 text-black" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white italic uppercase tracking-wide">Creator Earnings</h3>
                                            <p className="text-white/60 text-sm">Accumulated fees from your prediction markets (5%)</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 relative z-10 w-full md:w-auto">
                                        <div className="text-3xl font-black text-white flex items-center gap-2">
                                            <span className="text-yellow-500">$</span>
                                            {(Number(creatorBalance) / 1000000).toFixed(2)}
                                            <span className="text-sm font-bold text-white/40 uppercase tracking-widest mt-2">USDC</span>
                                        </div>
                                        <button
                                            onClick={handleClaimCreatorFees}
                                            disabled={isClaimingFees}
                                            className="w-full md:w-auto px-8 py-3 bg-white text-black font-black uppercase tracking-wider rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isClaimingFees ? (
                                                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                            ) : (
                                                <Coins className="w-5 h-5" />
                                            )}
                                            {isClaimingFees ? 'Claiming...' : 'Claim Winnings'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center group hover:bg-white/10 transition-colors">
                                <Trophy className="w-6 h-6 text-green-500 mx-auto mb-2 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                                <div className="text-2xl font-black text-green-500">{wins}</div>
                                <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Wins</div>
                            </div>
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center group hover:bg-white/10 transition-colors">
                                <Skull className="w-6 h-6 text-red-500 mx-auto mb-2 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                                <div className="text-2xl font-black text-red-500">{losses}</div>
                                <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Losses</div>
                            </div>
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center group hover:bg-white/10 transition-colors">
                                <Activity className="w-6 h-6 text-primary mx-auto mb-2 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                                <div className="text-2xl font-black text-white">{winRate.toFixed(0)}%</div>
                                <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Win Rate</div>
                            </div>
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center group hover:bg-white/10 transition-colors">
                                <div className={`text-2xl font-black mb-1 ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Net Profit</div>
                            </div>
                        </div>

                        {/* Recent Activity (Placeholder) */}
                        <div className="border border-white/10 rounded-3xl p-6 bg-black/20">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary" />
                                RECENT HISTORY
                            </h3>

                            <div className="text-center py-12">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                                    <Clock className="w-8 h-8 text-white/20" />
                                </div>
                                <p className="text-white/40 font-medium">No recent battles found.</p>
                                <Link href="/" className="inline-block mt-4 text-primary text-sm font-bold hover:underline">
                                    GO TO ARENA
                                </Link>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
