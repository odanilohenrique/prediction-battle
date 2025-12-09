'use client';

import { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import AdminBetCard from '@/components/AdminBetCard';
import ActiveBets from '@/components/ActiveBets';
import PastBets from '@/components/PastBets';
import WalletButton from '@/components/WalletButton';

export default function Home() {
    const [adminBets, setAdminBets] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'trending' | 'active' | 'past'>('trending');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAdminBets();
    }, []);

    async function fetchAdminBets() {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/bets');
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
                                    Aposte em casts. Ganhe USDC.
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
                    <nav className="flex gap-1">
                        <button
                            onClick={() => setActiveTab('trending')}
                            className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'trending'
                                    ? 'text-primary'
                                    : 'text-textSecondary hover:text-textPrimary'
                                }`}
                        >
                            Apostas Disponíveis
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
                            Minhas Apostas Ativas
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
                            Histórico
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
                            <h2 className="text-2xl font-bold text-textPrimary mb-2">
                                🔥 Apostas Disponíveis
                            </h2>
                            <p className="text-textSecondary">
                                Escolha uma aposta e preveja o resultado!
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
                        ) : adminBets.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {adminBets.map((bet) => (
                                    <AdminBetCard
                                        key={bet.id}
                                        bet={bet}
                                        onBet={fetchAdminBets}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-surface border border-darkGray rounded-2xl">
                                <div className="text-6xl mb-4">🎯</div>
                                <h3 className="text-xl font-bold text-textPrimary mb-2">
                                    Nenhuma Aposta Disponível
                                </h3>
                                <p className="text-textSecondary mb-4">
                                    Aguarde o admin criar novas apostas!
                                </p>
                                <p className="text-xs text-textSecondary">
                                    💡 Admin: acesse /admin para criar apostas
                                </p>
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
