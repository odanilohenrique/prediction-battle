'use client';

import { useState, useEffect } from 'react';
import { Flame, TrendingUp, DollarSign } from 'lucide-react';
import CastCard from '@/components/CastCard';
import PredictionModal from '@/components/PredictionModal';
import ActiveBets from '@/components/ActiveBets';
import PastBets from '@/components/PastBets';
import { Cast, Prediction } from '@/lib/types';

export default function Home() {
    const [trendingCasts, setTrendingCasts] = useState<Cast[]>([]);
    const [selectedCast, setSelectedCast] = useState<Cast | null>(null);
    const [activeTab, setActiveTab] = useState<'trending' | 'active' | 'past'>('trending');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrendingCasts();
    }, []);

    async function fetchTrendingCasts() {
        try {
            setLoading(true);
            const response = await fetch('/api/casts/trending');
            const data = await response.json();
            setTrendingCasts(data.casts || []);
        } catch (error) {
            console.error('Error fetching trending casts:', error);
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
                                    Bet on cast performance. Win USDC.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                <span className="text-sm text-textSecondary">Live</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="border-b border-darkGray bg-surface/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex gap-1">
                        <button
                            onClick={() => setActiveTab('trending')}
                            className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'trending'
                                    ? 'text-primary'
                                    : 'text-textSecondary hover:text-textPrimary'
                                }`}
                        >
                            Trending Casts
                            {activeTab === 'trending' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'active'
                                    ? 'text-primary'
                                    : 'text-textSecondary hover:text-textPrimary'
                                }`}
                        >
                            My Active Bets
                            {activeTab === 'active' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('past')}
                            className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'past'
                                    ? 'text-primary'
                                    : 'text-textSecondary hover:text-textPrimary'
                                }`}
                        >
                            Past Bets
                            {activeTab === 'past' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                            )}
                        </button>
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'trending' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-textPrimary mb-2">
                                🔥 Trending Now
                            </h2>
                            <p className="text-textSecondary">
                                Pick a cast and predict if it will hit an engagement target in 24 hours
                            </p>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[...Array(6)].map((_, i) => (
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
                                        <div className="space-y-2 mb-4">
                                            <div className="h-3 bg-darkGray rounded w-full" />
                                            <div className="h-3 bg-darkGray rounded w-4/5" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : trendingCasts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {trendingCasts.map((cast) => (
                                    <CastCard
                                        key={cast.hash}
                                        cast={cast}
                                        onPredict={() => setSelectedCast(cast)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-textSecondary">
                                    No trending casts available. Check back soon!
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'active' && <ActiveBets />}
                {activeTab === 'past' && <PastBets />}
            </div>

            {/* Prediction Modal */}
            {selectedCast && (
                <PredictionModal
                    cast={selectedCast}
                    onClose={() => setSelectedCast(null)}
                />
            )}
        </main>
    );
}
