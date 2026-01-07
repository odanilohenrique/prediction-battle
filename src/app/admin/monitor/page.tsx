'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Clock, Users, DollarSign, TrendingUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface BetMonitor {
    id: string;
    username: string;
    displayName?: string;
    pfpUrl?: string;
    type: string;
    target: number;
    timeframe: string;
    expiresAt: number;
    createdAt: number;
    totalPot: number;
    participantCount: number;
    participants: {
        yes: { userId: string; amount: number; timestamp: number }[];
        no: { userId: string; amount: number; timestamp: number }[];
    };
    castUrl?: string;
    castHash?: string;
    castText?: string;
    status: 'active' | 'completed';
    result?: 'yes' | 'no';
}

export default function MonitorPage() {
    const [bets, setBets] = useState<BetMonitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBet, setSelectedBet] = useState<BetMonitor | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    useEffect(() => {
        fetchBets();
        if (autoRefresh) {
            const interval = setInterval(fetchBets, 10000); // Refresh every 10 seconds
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    async function fetchBets() {
        try {
            const response = await fetch(`/api/admin/bets?t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache' }
            });
            const data = await response.json();
            if (data.success) {
                setBets(data.bets || []);
            }
        } catch (error) {
            console.error('Error fetching bets:', error);
        } finally {
            setLoading(false);
        }
    }

    const formatTimeRemaining = (expiresAt: number) => {
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) return { text: 'Expired', isExpired: true };

        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return { text: `${days}d ${hours % 24}h`, isExpired: false };
        }
        return { text: `${hours}h ${minutes}m ${seconds}s`, isExpired: false };
    };

    const formatTimestamp = (ts: number) => {
        return new Date(ts).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const activeBets = bets.filter(b => b.status === 'active');
    const expiredBets = bets.filter(b => b.status === 'active' && Date.now() > b.expiresAt);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/admin"
                    className="inline-flex items-center gap-2 text-textSecondary hover:text-textPrimary transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-textPrimary mb-2">
                            📊 Live Monitor
                        </h1>
                        <p className="text-textSecondary">
                            Real-time tracking of all predictions
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-textSecondary">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="rounded border-darkGray bg-darkGray"
                            />
                            Auto-refresh (10s)
                        </label>
                        <button
                            onClick={fetchBets}
                            className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl transition-all"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-surface border border-darkGray rounded-2xl p-4">
                    <div className="text-sm text-textSecondary mb-1">Active Bets</div>
                    <div className="text-2xl font-bold text-primary">{activeBets.length}</div>
                </div>
                <div className="bg-surface border border-yellow-500/30 rounded-2xl p-4">
                    <div className="text-sm text-textSecondary mb-1">Awaiting Resolution</div>
                    <div className="text-2xl font-bold text-yellow-500">{expiredBets.length}</div>
                </div>
                <div className="bg-surface border border-darkGray rounded-2xl p-4">
                    <div className="text-sm text-textSecondary mb-1">Total Participants</div>
                    <div className="text-2xl font-bold text-textPrimary">
                        {bets.reduce((sum, b) => sum + b.participantCount, 0)}
                    </div>
                </div>
                <div className="bg-surface border border-green-500/30 rounded-2xl p-4">
                    <div className="text-sm text-textSecondary mb-1">Total Volume</div>
                    <div className="text-2xl font-bold text-green-500">
                        ${bets.reduce((sum, b) => sum + b.totalPot, 0).toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Bets Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {loading ? (
                    <div className="col-span-2 text-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
                        <p className="text-textSecondary">Loading...</p>
                    </div>
                ) : bets.length === 0 ? (
                    <div className="col-span-2 text-center py-12 bg-surface border border-darkGray rounded-2xl">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-xl font-bold text-textPrimary mb-2">No Bets Found</h3>
                        <p className="text-textSecondary">Create a bet to start monitoring</p>
                    </div>
                ) : (
                    bets.map((bet) => {
                        const timeInfo = formatTimeRemaining(bet.expiresAt);
                        const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                        const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);

                        return (
                            <div
                                key={bet.id}
                                className={`bg-surface border rounded-2xl p-6 transition-all cursor-pointer hover:border-primary/50 ${timeInfo.isExpired ? 'border-yellow-500/50' : 'border-darkGray'
                                    } ${selectedBet?.id === bet.id ? 'ring-2 ring-primary' : ''}`}
                                onClick={() => setSelectedBet(selectedBet?.id === bet.id ? null : bet)}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        {bet.pfpUrl ? (
                                            <img
                                                src={bet.pfpUrl}
                                                alt={bet.username}
                                                className="w-12 h-12 rounded-full object-cover border-2 border-primary/30"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
                                                🎯
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-bold text-textPrimary">
                                                {bet.displayName || `@${bet.username}`}
                                            </h3>
                                            <p className="text-sm text-textSecondary">@{bet.username}</p>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${timeInfo.isExpired
                                        ? 'bg-yellow-500/20 text-yellow-500 animate-pulse'
                                        : 'bg-green-500/20 text-green-500'
                                        }`}>
                                        {timeInfo.isExpired ? '⏰ NEEDS RESOLUTION' : '🟢 LIVE'}
                                    </div>
                                </div>

                                {/* Question/Type */}
                                {bet.castText && (
                                    <p className="text-textPrimary font-medium mb-3 bg-darkGray/30 p-3 rounded-xl">
                                        "{bet.castText}"
                                    </p>
                                )}

                                {/* Time & Stats */}
                                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-textSecondary" />
                                        <span className={timeInfo.isExpired ? 'text-yellow-500' : 'text-textPrimary'}>
                                            {timeInfo.text}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-textSecondary" />
                                        <span className="text-textPrimary">{bet.participantCount} bettors</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-primary" />
                                        <span className="text-primary font-bold">${bet.totalPot.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Pool Distribution */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-green-500 font-bold">YES: ${yesPool.toFixed(2)} ({bet.participants.yes.length})</span>
                                        <span className="text-red-500 font-bold">NO: ${noPool.toFixed(2)} ({bet.participants.no.length})</span>
                                    </div>
                                    <div className="h-3 bg-darkGray rounded-full overflow-hidden flex">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-500 to-green-400"
                                            style={{ width: `${yesPool + noPool > 0 ? (yesPool / (yesPool + noPool)) * 100 : 50}%` }}
                                        />
                                        <div
                                            className="h-full bg-gradient-to-r from-red-400 to-red-500"
                                            style={{ width: `${yesPool + noPool > 0 ? (noPool / (yesPool + noPool)) * 100 : 50}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Cast Link */}
                                {(bet.castUrl || bet.castHash) && (
                                    <a
                                        href={bet.castUrl || `https://warpcast.com/${bet.username}/${bet.castHash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-4 inline-flex items-center gap-2 text-primary hover:text-secondary text-sm"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        View Original Cast
                                    </a>
                                )}

                                {/* Expanded Details */}
                                {selectedBet?.id === bet.id && (
                                    <div className="mt-6 pt-6 border-t border-darkGray space-y-4">
                                        <h4 className="font-bold text-textPrimary">📋 Participant History</h4>

                                        {/* YES Bets */}
                                        {bet.participants.yes.length > 0 && (
                                            <div>
                                                <h5 className="text-sm font-bold text-green-500 mb-2">✅ YES Bets</h5>
                                                <div className="space-y-1">
                                                    {bet.participants.yes.map((p, i) => (
                                                        <div key={i} className="flex justify-between text-xs bg-green-500/10 px-3 py-2 rounded-lg">
                                                            <span className="text-textSecondary font-mono">{p.userId.slice(0, 10)}...</span>
                                                            <span className="text-green-500 font-bold">${p.amount.toFixed(2)}</span>
                                                            <span className="text-textSecondary">{formatTimestamp(p.timestamp)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* NO Bets */}
                                        {bet.participants.no.length > 0 && (
                                            <div>
                                                <h5 className="text-sm font-bold text-red-500 mb-2">❌ NO Bets</h5>
                                                <div className="space-y-1">
                                                    {bet.participants.no.map((p, i) => (
                                                        <div key={i} className="flex justify-between text-xs bg-red-500/10 px-3 py-2 rounded-lg">
                                                            <span className="text-textSecondary font-mono">{p.userId.slice(0, 10)}...</span>
                                                            <span className="text-red-500 font-bold">${p.amount.toFixed(2)}</span>
                                                            <span className="text-textSecondary">{formatTimestamp(p.timestamp)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {bet.participantCount === 0 && (
                                            <p className="text-textSecondary text-sm text-center py-4">
                                                No participants yet
                                            </p>
                                        )}

                                        {/* Timeline Info */}
                                        <div className="bg-darkGray/30 rounded-xl p-4 text-sm">
                                            <div className="flex justify-between mb-2">
                                                <span className="text-textSecondary">Created:</span>
                                                <span className="text-textPrimary">{formatTimestamp(bet.createdAt)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-textSecondary">Expires:</span>
                                                <span className="text-textPrimary">{formatTimestamp(bet.expiresAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
