'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Sword, Flame, Trophy, Crown, Users, Plus, Clock } from 'lucide-react';
import AdminBetCard from '@/components/AdminBetCard';
import WalletButton from '@/components/WalletButton';
import { isAdmin } from '@/lib/config';

export default function Home() {
    const [battles, setBattles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'official' | 'community' | 'expired'>('official');

    useEffect(() => {
        fetchBattles();
    }, []);

    async function fetchBattles() {
        try {
            setLoading(true);
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
            setLoading(false);
        }
    }

    // Debug logging - CRITICAL for fixing visibility
    console.log('[HOME] Filtering Battles...');
    console.log(`[HOME] Total raw bets: ${battles.length}`);

    battles.forEach(b => {
        const isOfficial = b.status === 'active' && (!b.creatorAddress || isAdmin(b.creatorAddress));
        const hasCreator = !!b.creatorAddress;
        const isCommunity = b.status === 'active' && hasCreator;

        console.log(`[HOME] Bet ${b.id.slice(0, 8)}:
            - Status: ${b.status}
            - Creator: ${b.creatorAddress || 'None'}
            - Is Admin? ${b.creatorAddress ? isAdmin(b.creatorAddress) : 'N/A'}
            - Expires: ${new Date(b.expiresAt).toISOString()} (${b.expiresAt > Date.now() ? 'Future' : 'Expired'})
            - -> Official? ${isOfficial}
            - -> Community? ${isCommunity}
        `);
    });

    const officialBattles = battles.filter(b => b.status === 'active' && (!b.creatorAddress || isAdmin(b.creatorAddress)));
    // Community: Show ONLY non-admin active battles
    const communityBattles = battles.filter(b => b.status === 'active' && b.creatorAddress && !isAdmin(b.creatorAddress));

    // Expired bets: Status is 'expired' OR 'resolved' OR just past deadline?
    // User requested "last 3 expired".
    const expiredBattles = battles
        .filter(b => Date.now() >= b.expiresAt || b.status === 'expired' || b.status === 'resolved')
        .sort((a, b) => b.expiresAt - a.expiresAt)
        .slice(0, 3);

    const displayedBattles = activeTab === 'official'
        ? officialBattles
        : activeTab === 'community'
            ? communityBattles
            : expiredBattles;

    return (
        <main className="min-h-screen bg-transparent pb-20">
            {/* Header */}
            <header className="glass sticky top-0 z-40 border-b border-white/5">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden">
                                <Image
                                    src="/icon.png"
                                    alt="Logo"
                                    width={40}
                                    height={40}
                                    className="object-cover"
                                />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white italic tracking-wide uppercase">
                                    BATTLE ARENA
                                </h1>
                                <p className="text-xs text-primary font-bold tracking-widest uppercase">
                                    Live War Room
                                </p>
                            </div>
                        </div>
                        <WalletButton />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-2xl mx-auto px-4 py-8">

                {/* Tabs */}
                <div className="flex p-1 bg-white/5 rounded-xl mb-8 border border-white/5">
                    <button
                        onClick={() => setActiveTab('official')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'official'
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Crown className="w-4 h-4" />
                        Official Battles
                        <span className="bg-black/20 px-2 py-0.5 rounded-full text-xs">
                            {officialBattles.filter(b => Date.now() < b.expiresAt).length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('community')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'community'
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Users className="w-4 h-4" />
                        Community
                        <span className="bg-black/20 px-2 py-0.5 rounded-full text-xs">
                            {communityBattles.filter(b => Date.now() < b.expiresAt).length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('expired')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'expired'
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Clock className="w-4 h-4" />
                        Expired
                    </button>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-primary animate-pulse" />
                        <h2 className="text-lg font-bold text-white uppercase tracking-wider">
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
                            .filter(battle => Date.now() < battle.expiresAt)
                            .map((battle) => (
                                <AdminBetCard
                                    key={battle.id}
                                    bet={battle}
                                    onBet={fetchBattles}
                                />
                            ))}

                        {displayedBattles.filter(battle => Date.now() < battle.expiresAt).length === 0 && (
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
            </div>
        </main>
    );
}
