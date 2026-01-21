'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Clock, Users, DollarSign, TrendingUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useWriteContract } from 'wagmi';
import AdminBetRow from '@/components/AdminBetRow';

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

// Helper to determine if a bet is expired by time
const isExpiredByTime = (expiresAt: number) => Date.now() > expiresAt;

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

// Start of Component
import { useModal } from '@/providers/ModalProvider';

// ... (keep surrounding code)

export default function MonitorPage() {
    const { showModal, showAlert, showConfirm } = useModal();
    const { writeContractAsync } = useWriteContract();

    // ... imports ...

    async function handleVoid(betId: string) {
        showConfirm('Confirm Void?', 'Are you sure you want to VOID this bet? This will refund all participants (minus fee).', async () => {
            try {
                const hash = await writeContractAsync({
                    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
                    abi: [{
                        name: 'voidMarket',
                        type: 'function',
                        stateMutability: 'nonpayable',
                        inputs: [{ name: '_id', type: 'string' }],
                        outputs: []
                    }],
                    functionName: 'voidMarket',
                    args: [betId],
                });
                showAlert('Void Tx Sent', `Hash: ${hash}`, 'success');
                fetchBets();
            } catch (e) {
                console.error(e);
                showAlert('Error', 'Error voiding bet: ' + (e as Error).message, 'error');
            }
        });
    }



    const [loading, setLoading] = useState(true);
    const [bets, setBets] = useState<BetMonitor[]>([]);
    const [selectedBet, setSelectedBet] = useState<BetMonitor | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [showExpired, setShowExpired] = useState(false);

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

    const now = Date.now();

    // 1. Live: Active Status + Future Date
    const liveBets = bets.filter(b => b.status === 'active' && new Date(b.expiresAt).getTime() > now);

    // 2. Pending Resolution: Active Status + Past Date (The "Zombies")
    const pendingBets = bets.filter(b => b.status === 'active' && new Date(b.expiresAt).getTime() <= now);

    // 3. Completed: Status not active
    const completedBets = bets.filter(b => b.status !== 'active');

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-surface border border-green-500/30 rounded-2xl p-4">
                    <div className="text-sm text-textSecondary mb-1">Live Bets</div>
                    <div className="text-2xl font-bold text-green-500">{liveBets.length}</div>
                </div>
                <div className="bg-surface border border-yellow-500/30 rounded-2xl p-4">
                    <div className="text-sm text-textSecondary mb-1">Awaiting Resolution</div>
                    <div className="text-2xl font-bold text-yellow-500 animate-pulse">{pendingBets.length}</div>
                </div>
                <div className="bg-surface border border-darkGray rounded-2xl p-4">
                    <div className="text-sm text-textSecondary mb-1">Total Participants</div>
                    <div className="text-2xl font-bold text-textPrimary">
                        {bets.reduce((sum, b) => sum + b.participantCount, 0)}
                    </div>
                </div>
                <div className="bg-surface border border-darkGray rounded-2xl p-4">
                    <div className="text-sm text-textSecondary mb-1">History (Resolved)</div>
                    <div className="text-2xl font-bold text-white/50">{completedBets.length}</div>
                </div>
            </div>

            {/* Bets Grid */}
            <div className="space-y-12">

                {/* 1. Pending Resolution (Highest Priority) */}
                {pendingBets.length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold text-yellow-500 mb-4 flex items-center gap-2">
                            <Clock className="w-6 h-6 animate-pulse" />
                            ⚠️ Pending Resolution (Action Required)
                        </h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 border border-yellow-500/20 rounded-2xl bg-yellow-500/5">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 border border-yellow-500/20 rounded-2xl bg-yellow-500/5">
                                {pendingBets.map(bet => (
                                    <AdminBetRow
                                        key={bet.id}
                                        bet={bet}
                                        selectedBet={selectedBet}
                                        setSelectedBet={setSelectedBet}
                                        fetchBets={fetchBets}
                                        handleVoid={handleVoid}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Live Bets */}
                <div>
                    <h2 className="text-xl font-bold text-green-500 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6" />
                        Live Battles
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {loading ? (
                            <div className="col-span-2 text-center py-12">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
                                <p className="text-textSecondary">Loading...</p>
                            </div>
                        ) : liveBets.length === 0 ? (
                            <div className="col-span-2 text-center py-12 bg-surface border border-darkGray rounded-2xl">
                                <div className="text-6xl mb-4">📭</div>
                                <h3 className="text-xl font-bold text-textPrimary mb-2">No Live Bets</h3>
                                <p className="text-textSecondary">All quiet on the front.</p>
                            </div>
                        ) : (
                            liveBets.map(bet => (
                                <AdminBetRow
                                    key={bet.id}
                                    bet={bet}
                                    selectedBet={selectedBet}
                                    setSelectedBet={setSelectedBet}
                                    fetchBets={fetchBets}
                                    handleVoid={handleVoid}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* 3. History */}
                {completedBets.length > 0 && (
                    <div className="opacity-60 hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setShowExpired(!showExpired)}
                            className="text-xl font-bold text-textSecondary mb-4 flex items-center gap-2 hover:text-white"
                        >
                            <Clock className="w-6 h-6" />
                            History / Resolved (Click to Toggle)
                        </button>
                        {showExpired && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {completedBets.slice(0, 10).map(bet => (
                                    <AdminBetRow
                                        key={bet.id}
                                        bet={bet}
                                        selectedBet={selectedBet}
                                        setSelectedBet={setSelectedBet}
                                        fetchBets={fetchBets}
                                        handleVoid={handleVoid}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

// Helper component extracted for cleaner rendering

