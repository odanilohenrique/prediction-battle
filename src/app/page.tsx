'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { Flame, Trophy, Crown, Users, Plus, Clock } from 'lucide-react';
import AdminBetCard from '@/components/AdminBetCard';
import { isAdmin } from '@/lib/config';

export default function Home() {
    const [battles, setBattles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { address } = useAccount();
    const [activeTab, setActiveTab] = useState<'official' | 'community' | 'expired'>('official');

    useEffect(() => {
        fetchBattles();
        // Polling every 10 seconds (background update)
        const interval = setInterval(() => fetchBattles(true), 10000);
        return () => clearInterval(interval);
    }, [address]);

    async function fetchBattles(isBackground = false) {
        try {
            if (!isBackground) setLoading(true);
            // Add timestamp to bust any caching
            const response = await fetch(`/api/admin/bets?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await response.json();
            console.log('[HOME] API Response:', data._fetchedAt, 'bets:', data.bets?.length);
            if (data.success) {
                // Store all bets, filtering client-side for tabs
                setBattles(data.bets || []);
            }
        } catch (error) {
            console.error('Error fetching battles:', error);
        } finally {
            if (!isBackground) setLoading(false);
        }
    }

    // Debug logging - CRITICAL for fixing visibility
    // console.log('[HOME] Filtering Battles...');

    // Helper to determine if a bet is truly active (status active AND time remaining)
    const isTrulyActive = (b: any) => b.status === 'active' && Date.now() < new Date(b.expiresAt).getTime();

    const officialBattles = battles.filter(b => isTrulyActive(b) && (!b.creatorAddress || isAdmin(b.creatorAddress)));
    const communityBattles = battles.filter(b => isTrulyActive(b) && b.creatorAddress && !isAdmin(b.creatorAddress));

    // Expired: Everything else (Resolved, Completed, Expired Time, or Status !== active)
    const expiredBattles = battles
        .filter(b => !isTrulyActive(b))
        .sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime())
        .slice(0, 50);

    const displayedBattles = activeTab === 'official'
        ? officialBattles
        : activeTab === 'community'
            ? communityBattles
            : expiredBattles;

    return (
        <main className="bg-transparent">
            {/* Header was removed as it's now in Navigation/Layout */}

            {/* Main Content */}
            <div className="max-w-3xl mx-auto px-4 py-8">

                {/* Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={() => setActiveTab('official')}
                        className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${activeTab === 'official'
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                            : 'bg-white/5 text-white/40 border-white/5 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        <Crown className="w-3.5 h-3.5" />
                        <span>Official</span>
                        <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-[10px]">
                            {officialBattles.filter(b => Date.now() < b.expiresAt).length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('community')}
                        className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${activeTab === 'community'
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                            : 'bg-white/5 text-white/40 border-white/5 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        <span>Community</span>
                        <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-[10px]">
                            {communityBattles.filter(b => Date.now() < b.expiresAt).length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('expired')}
                        className={`flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${activeTab === 'expired'
                            ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                            : 'bg-white/5 text-white/40 border-white/5 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Expired</span>
                    </button>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-primary animate-pulse" />
                        <h2 className="text-lg font-display font-bold text-white uppercase tracking-wider">
                            {activeTab === 'official' ? 'Official Events' : activeTab === 'community' ? 'Community Battles' : 'Recently Expired'}
                        </h2>
                    </div>
                    {activeTab === 'community' && (
                        <Link
                            href="/create"
                            className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-neon"
                        >
                            <Plus className="w-4 h-4" />
                            Create Battle
                        </Link>
                    )}
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div
                                key={i}
                                className="glass border border-white/5 rounded-2xl p-6 animate-pulse h-48"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {displayedBattles
                            .map((battle) => (
                                <AdminBetCard
                                    key={battle.id}
                                    bet={battle}
                                    onBet={fetchBattles}
                                />
                            ))}

                        {displayedBattles.length === 0 && (
                            <div className="text-center py-20 glass rounded-2xl border-white/5 border-dashed border-2">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Trophy className="w-8 h-8 text-white/20" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1">
                                    The Arena is Quiet
                                </h3>
                                <p className="text-white/40 text-sm">
                                    No independent battles running. Why not start one?
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Roadmap Section Removed */}
            </div>
        </main>
    );
}
