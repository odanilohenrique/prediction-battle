'use client';

import { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import AdminBetCard from '@/components/AdminBetCard';
import ActiveBets from '@/components/ActiveBets';
import PastBets from '@/components/PastBets';
import WalletButton from '@/components/WalletButton';

export default function Home() {
    const [adminBets, setAdminBets] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'trending' | 'live' | 'active' | 'past'>('trending');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAdminBets();
    }, []);

    async function fetchAdminBets() {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/bets', { cache: 'no-store' });
            const data = await response.json();
            if (data.success) {
                // Only show active bets
                const activeBets = (data.bets || []).filter((b: any) => b.status === 'active');
                setAdminBets(activeBets);
            }
        } catch (error) {
            console.error('Error fetching admin bets:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-darkGray bg-surface/50 backdrop-blur-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                                <Flame className="w-6 h-6 text-background" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-textPrimary">
                                    Prediction Battle
                                </h1>
                                <p className="text-sm text-textSecondary">
                                    Predict on casts. Win USDC.
                                </p>
                            </div>
                        </div>
                        <WalletButton />
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="border-b border-darkGray bg-surface/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex gap-1 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('trending')}
                            className={`px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'trending'
                                ? 'text-primary'
                                : 'text-textSecondary hover:text-textPrimary'
                                }`}
                        >
                            All Predictions
                            {activeTab === 'trending' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('live')}
                            className={`px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'live'
                                ? 'text-primary'
                                : 'text-textSecondary hover:text-textPrimary'
                                }`}
                        >
                            ⚡ Live Only
                            {activeTab === 'live' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'active'
                                ? 'text-primary'
                                : 'text-textSecondary hover:text-textPrimary'
                                }`}
                        >
                            My Bets
                            {activeTab === 'active' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('past')}
                            className={`px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'past'
                                ? 'text-primary'
                                : 'text-textSecondary hover:text-textPrimary'
                                }`}
                        >
                            History
                            {activeTab === 'past' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                            )}
                        </button>
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {(activeTab === 'trending' || activeTab === 'live') && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-textPrimary mb-2">
                                {activeTab === 'live' ? '⚡ Live Predictions' : '🔥 All Available Predictions'}
                            </h2>
                            <p className="text-textSecondary">
                                {activeTab === 'live'
                                    ? 'Bet on active events before they expire!'
                                    : 'View results or place bets on active events.'}
                            </p>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[...Array(3)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="bg-surface border border-darkGray rounded-2xl p-6 animate-pulse"
                                    >
                                        <div className="flex items-start gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-full bg-darkGray" />
                                            <div className="flex-1">
                                                <div className="h-4 bg-darkGray rounded w-32 mb-2" />
                                                <div className="h-3 bg-darkGray rounded w-20" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {adminBets
                                    .filter(bet => activeTab === 'live' ? Date.now() < bet.expiresAt : true)
                                    .map((bet) => (
                                        <AdminBetCard
                                            key={bet.id}
                                            bet={bet}
                                            onBet={fetchAdminBets}
                                        />
                                    ))}
                                {adminBets.filter(bet => activeTab === 'live' ? Date.now() < bet.expiresAt : true).length === 0 && (
                                    <div className="col-span-1 md:col-span-2 text-center py-16 bg-surface border border-darkGray rounded-2xl">
                                        <div className="text-6xl mb-4">🎯</div>
                                        <h3 className="text-xl font-bold text-textPrimary mb-2">
                                            No {activeTab === 'live' ? 'Live' : ''} Predictions Found
                                        </h3>
                                        <p className="text-textSecondary">Check back later for new bets!</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'active' && <ActiveBets />}
                {activeTab === 'past' && <PastBets />}
            </div>
        </main>
    );
}
