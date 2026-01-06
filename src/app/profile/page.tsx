'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, Skull, Activity, Users, Crown, Clock, Edit3, Save, X, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import WalletButton from '@/components/WalletButton';

interface UserBet {
    predictionId: string;
    prediction: any;
    choice: 'yes' | 'no';
    amount: number;
    timestamp: number;
    status: 'pending' | 'won' | 'lost';
    payout?: number;
}

export default function ProfilePage() {
    const { address, isConnected } = useAccount();
    const [activeBets, setActiveBets] = useState<UserBet[]>([]);
    const [historyBets, setHistoryBets] = useState<UserBet[]>([]);
    const [loading, setLoading] = useState(true);

    // Profile customization
    const [isEditing, setIsEditing] = useState(false);
    const [nickname, setNickname] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [expandedBetId, setExpandedBetId] = useState<string | null>(null);

    // Load saved profile from localStorage
    useEffect(() => {
        if (address) {
            const saved = localStorage.getItem(`profile_${address}`);
            if (saved) {
                const data = JSON.parse(saved);
                setNickname(data.nickname || '');
                setPhotoUrl(data.photoUrl || '');
            }
        }
    }, [address]);

    const saveProfile = () => {
        if (address) {
            localStorage.setItem(`profile_${address}`, JSON.stringify({ nickname, photoUrl }));
            setIsEditing(false);
        }
    };

    useEffect(() => {
        if (address) {
            fetchUserBets();
        }
    }, [address]);

    async function fetchUserBets() {
        try {
            setLoading(true);
            // Fetch active bets
            const activeRes = await fetch(`/api/predictions/list?userId=${address}&status=active`);
            const activeData = await activeRes.json();
            if (activeData.success) {
                setActiveBets(activeData.bets || []);
            }

            // Fetch completed bets
            const historyRes = await fetch(`/api/predictions/list?userId=${address}&status=completed`);
            const historyData = await historyRes.json();
            if (historyData.success) {
                setHistoryBets(historyData.bets || []);
            }
        } catch (error) {
            console.error('Error fetching user bets:', error);
        } finally {
            setLoading(false);
        }
    }

    // Calculate stats
    const wins = historyBets.filter(b => b.status === 'won').length;
    const losses = historyBets.filter(b => b.status === 'lost').length;
    const totalPayout = historyBets
        .filter(b => b.status === 'won')
        .reduce((sum, b) => sum + (b.payout || 0), 0);
    const totalLost = historyBets
        .filter(b => b.status === 'lost')
        .reduce((sum, b) => sum + b.amount, 0);
    const netProfit = totalPayout - totalLost;
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

    if (!isConnected) {
        return (
            <main className="min-h-screen bg-transparent">
                <header className="glass sticky top-0 z-40 border-b border-white/5">
                    <div className="max-w-2xl mx-auto px-4 py-4">
                        <div className="flex items-center justify-between">
                            <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                                <span className="font-bold">Back to Arena</span>
                            </Link>
                            <WalletButton />
                        </div>
                    </div>
                </header>
                <div className="max-w-2xl mx-auto px-4 py-20 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Users className="w-10 h-10 text-white/20" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">Connect Your Wallet</h2>
                    <p className="text-white/60">Connect to view your battle history and stats.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-transparent pb-20">
            {/* Header */}
            <header className="glass sticky top-0 z-40 border-b border-white/5">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-bold">Back to Arena</span>
                        </Link>
                        <WalletButton />
                    </div>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Profile Header */}
                <div className="glass-card rounded-3xl p-6 mb-8">
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                            {/* Profile Avatar */}
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-2xl font-black text-black overflow-hidden">
                                {photoUrl ? (
                                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    address?.slice(2, 4).toUpperCase()
                                )}
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white">
                                    {nickname || 'WARRIOR PROFILE'}
                                </h1>
                                <p className="text-sm text-white/60 font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        >
                            {isEditing ? <X className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Edit Profile Section */}
                    {isEditing && (
                        <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-4 border border-primary/20">
                            <div className="text-xs text-primary font-bold uppercase tracking-widest">Edit Profile</div>
                            <div>
                                <label className="text-xs text-white/60 mb-1 block">Nickname</label>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                    placeholder="Your warrior name..."
                                />
                            </div>
                            <div>
                                <label className="text-xs text-white/60 mb-1 block">Photo URL</label>
                                <input
                                    type="url"
                                    value={photoUrl}
                                    onChange={(e) => setPhotoUrl(e.target.value)}
                                    placeholder="https://..."
                                />
                                <div className="text-center text-xs text-white/40 my-2">- OR -</div>
                                <label className="block w-full text-center py-2 px-3 border border-dashed border-white/20 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                                    <span className="text-xs text-primary font-bold">Upload from Device</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                if (file.size > 500000) { // 500KB limit
                                                    alert('Image too large! Max 500KB.');
                                                    return;
                                                }
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setPhotoUrl(reader.result as string);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                            {photoUrl && (
                                <div className="flex items-center gap-2">
                                    <img src={photoUrl} alt="Preview" className="w-10 h-10 rounded-full object-cover border border-primary" />
                                    <span className="text-xs text-white/60">Preview</span>
                                </div>
                            )}
                            <button
                                onClick={saveProfile}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-black font-bold py-2 rounded-lg hover:opacity-90 transition-opacity"
                            >
                                <Save className="w-4 h-4" />
                                Save Profile
                            </button>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <Trophy className="w-6 h-6 text-green-500 mx-auto mb-2" />
                            <div className="text-2xl font-black text-green-500">{wins}</div>
                            <div className="text-xs text-white/40 uppercase">Wins</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <Skull className="w-6 h-6 text-red-500 mx-auto mb-2" />
                            <div className="text-2xl font-black text-red-500">{losses}</div>
                            <div className="text-xs text-white/40 uppercase">Losses</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <Activity className="w-6 h-6 text-primary mx-auto mb-2" />
                            <div className="text-2xl font-black text-white">{winRate.toFixed(0)}%</div>
                            <div className="text-xs text-white/40 uppercase">Win Rate</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <div className={`text-2xl font-black ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
                            </div>
                            <div className="text-xs text-white/40 uppercase mt-2">Net Profit</div>
                        </div>
                    </div>
                </div>

                {/* Leaderboard Section - MOVED UP */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Crown className="w-5 h-5 text-yellow-500 animate-pulse" />
                        <h2 className="text-lg font-bold text-white uppercase tracking-wider">Leaderboard</h2>
                        <span className="bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
                            SOON
                        </span>
                    </div>
                    <div className="glass-card rounded-2xl p-6 text-center border border-dashed border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors cursor-help">
                        <Crown className="w-10 h-10 text-yellow-500/50 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-white mb-1">Global Rankings</h3>
                        <p className="text-white/40 text-xs">
                            Compete for the top spot! Points system coming soon.
                        </p>
                    </div>
                </div>

                {/* Active Bets Section */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-primary animate-pulse" />
                        <h2 className="text-lg font-bold text-white uppercase tracking-wider">Active Battles</h2>
                        <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs font-bold">
                            {activeBets.length}
                        </span>
                    </div>

                    {loading ? (
                        <div className="glass-card rounded-2xl p-6 animate-pulse h-32" />
                    ) : activeBets.length === 0 ? (
                        <div className="glass-card rounded-2xl p-8 text-center border border-dashed border-white/10">
                            <p className="text-white/40">No active battles. Join one!</p>
                            <Link href="/" className="text-primary font-bold hover:underline">Go to Arena →</Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeBets.map((bet) => (
                                <div key={bet.predictionId} className="glass-card rounded-2xl p-4 border border-white/5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm text-white/60">@{bet.prediction.castAuthor}</div>
                                            <div className="text-white font-bold">{bet.prediction.castText?.slice(0, 50)}...</div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-bold ${bet.choice === 'yes' ? 'text-green-500' : 'text-red-500'}`}>
                                                {bet.choice === 'yes' ? '✅ YES' : '❌ NO'}
                                            </div>
                                            <div className="text-primary font-bold">${bet.amount.toFixed(2)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* History Section */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <h2 className="text-lg font-bold text-white uppercase tracking-wider">Battle History</h2>
                    </div>

                    {loading ? (
                        <div className="glass-card rounded-2xl p-6 animate-pulse h-32" />
                    ) : historyBets.length === 0 ? (
                        <div className="glass-card rounded-2xl p-8 text-center border border-dashed border-white/10">
                            <p className="text-white/40">No completed battles yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {historyBets.slice(0, 10).map((bet) => (
                                <div
                                    key={bet.predictionId}
                                    onClick={() => setExpandedBetId(expandedBetId === bet.predictionId ? null : bet.predictionId)}
                                    className={`glass-card rounded-xl p-4 border transition-all cursor-pointer hover:scale-[1.01] ${bet.status === 'won' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bet.status === 'won' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                            {bet.status === 'won' ? (
                                                <Trophy className="w-5 h-5 text-green-500" />
                                            ) : (
                                                <Skull className="w-5 h-5 text-red-500" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-white font-medium text-sm leading-tight truncate pr-2">
                                                    {bet.prediction.castText || `Bet on @${bet.prediction.castAuthor}`}
                                                </div>
                                                <div className="text-xs text-white/40 whitespace-nowrap">
                                                    {new Date(bet.timestamp).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${bet.choice === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    You: {bet.prediction.optionA && bet.choice === 'yes'
                                                        ? bet.prediction.optionA.label
                                                        : bet.prediction.optionB && bet.choice === 'no'
                                                            ? bet.prediction.optionB.label
                                                            : bet.choice.toUpperCase()}
                                                </span>
                                                <span className="text-xs text-white/40">•</span>
                                                <span className="text-xs text-white/60">${bet.amount.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className={`text-lg font-black ${bet.status === 'won' ? 'text-green-500' : 'text-red-500'}`}>
                                                {bet.status === 'won' ? `+$${(bet.payout || 0).toFixed(2)}` : `-$${bet.amount.toFixed(2)}`}
                                            </div>
                                            <div className="flex items-center justify-end gap-1">
                                                <span className={`text-xs font-bold ${bet.status === 'won' ? 'text-green-400' : 'text-red-400'}`}>
                                                    {bet.status === 'won' ? 'WON' : 'LOST'}
                                                </span>
                                                {expandedBetId === bet.predictionId ? <ChevronUp className="w-3 h-3 text-white/40" /> : <ChevronDown className="w-3 h-3 text-white/40" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedBetId === bet.predictionId && (
                                        <div className="mt-4 pt-4 border-t border-white/5 space-y-3 animate-fade-in text-sm">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-xs text-white/40 uppercase font-bold mb-1">Created</div>
                                                    <div className="text-white flex items-center gap-2">
                                                        <Calendar className="w-3 h-3 text-primary" />
                                                        {new Date(bet.timestamp).toLocaleString()}
                                                    </div>
                                                </div>
                                                {bet.prediction.expiresAt && (
                                                    <div>
                                                        <div className="text-xs text-white/40 uppercase font-bold mb-1">Expired</div>
                                                        <div className="text-white flex items-center gap-2">
                                                            <Clock className="w-3 h-3 text-red-500" />
                                                            {new Date(bet.prediction.expiresAt).toLocaleString()}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-xs text-white/40 uppercase font-bold mb-1">Full Details</div>
                                                <div className="bg-black/20 rounded-lg p-3 text-white/80 italic">
                                                    "{bet.prediction.castText || bet.prediction.question || bet.prediction.type}"
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>


            </div>
        </main>
    );
}
