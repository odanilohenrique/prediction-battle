'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, TrendingUp, Users, DollarSign, Clock, Save, Trash2, Search, Upload } from 'lucide-react';
import Link from 'next/link';

// Mock Top Handles
const TOP_100_HANDLES = [
    'jessepollak', 'dwr', 'vitalik', 'betashop.eth', 'pugson', 'ccarella', 'nonlinear.eth', '0xen',
    'brianjckim', 'limone.eth', 'yitong', 'ace', 'cameron', 'tyler', 'barmstrong', 'balajis',
    'cdixon.eth', 'fredwilson', 'naval', 'pb', 'w1nt3r', 'zachterrell', 'matthew',
    // ... add more if needed
];

interface Player {
    username: string;
    displayName: string;
    pfpUrl: string;
}

interface Bet {
    id: string;
    username: string;
    type: string;
    target: number;
    timeframe: string;
    status: 'active' | 'completed';
    totalPot: number;
    participantCount: number;
    expiresAt: number;
    optionA?: { label: string; imageUrl?: string };
    optionB?: { label: string; imageUrl?: string };
}

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'users'>('dashboard');
    const [bets, setBets] = useState<Bet[]>([]);

    // Player Management State
    const [players, setPlayers] = useState<Player[]>([]);
    const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingPlayer, setEditingPlayer] = useState<Partial<Player> | null>(null);
    const [loadingPlayers, setLoadingPlayers] = useState(false);
    const [stats, setStats] = useState({
        totalBets: 0,
        activeBets: 0,
        totalVolume: 0,
        totalFees: 0,
    });

    useEffect(() => {
        if (activeTab === 'dashboard') fetchAdminData();
        if (activeTab === 'users') fetchPlayers();
    }, [activeTab]);

    async function fetchPlayers() {
        setLoadingPlayers(true);
        try {
            const res = await fetch('/api/admin/players');
            const data = await res.json();
            if (data.success) {
                setPlayers(data.players || []);
                setFilteredPlayers(data.players || []);
            }
        } catch (e) {
            console.error('Failed to fetch players', e);
        } finally {
            setLoadingPlayers(false);
        }
    }

    // Filter players when search changes
    useEffect(() => {
        if (!searchQuery) {
            setFilteredPlayers(players);
        } else {
            setFilteredPlayers(players.filter(p =>
                p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.displayName.toLowerCase().includes(searchQuery.toLowerCase())
            ));
        }
    }, [searchQuery, players]);

    const handleLoadTop100 = () => {
        // Merge existing players with Top 100 list
        const newPlayers = [...players];
        TOP_100_HANDLES.forEach(handle => {
            if (!newPlayers.find(p => p.username.toLowerCase() === handle.toLowerCase())) {
                newPlayers.push({
                    username: handle,
                    displayName: handle, // Default display name Same as handle
                    pfpUrl: ''
                });
            }
        });
        setPlayers(newPlayers);
        alert(`Loaded template! Added missing profiles from Top 100 list. Please add photos and click Save All.`);
    };

    const handleSavePlayer = async (player: Player) => {
        try {
            const res = await fetch('/api/admin/players', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: player.username, displayName: player.displayName, pfpUrl: player.pfpUrl })
            });
            if (res.ok) {
                // Update local state
                const updated = players.map(p => p.username === player.username ? player : p);
                if (!updated.find(p => p.username === player.username)) updated.push(player);
                setPlayers(updated);
                setEditingPlayer(null);
            }
        } catch (e) {
            alert('Error saving player');
        }
    };

    const handleBulkSave = async () => {
        if (!confirm(`Save all ${players.length} players?`)) return;
        try {
            const res = await fetch('/api/admin/players', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ players })
            });
            if (res.ok) alert('Saved successfully!');
        } catch (e) {
            alert('Error saving');
        }
    };

    const handleDeletePlayer = (username: string) => {
        if (!confirm('Remove this player from the list? (Requires Save to persist)')) return;
        setPlayers(players.filter(p => p.username !== username));
    };

    async function fetchAdminData() {
        try {
            const response = await fetch('/api/admin/bets');
            const data = await response.json();

            if (data.success) {
                setBets(data.bets || []);
                setStats(data.stats || stats);
            }
        } catch (error) {
            console.error('Error fetching admin data:', error);
        }
    }

    // Modal State
    const [resolveModalOpen, setResolveModalOpen] = useState(false);
    const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
    const [isResolving, setIsResolving] = useState(false);
    const [isCreatingTest, setIsCreatingTest] = useState(false);

    const handleCreateTestBet = async () => {
        setIsCreatingTest(true);
        try {
            const response = await fetch('/api/admin/bets/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'betashop.eth',
                    displayName: 'betashop.eth',
                    pfpUrl: 'https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/486fd621-633b-4eb7-a13b-cb5cd118cb00/anim=false,fit=contain,f=auto,w=288',
                    betType: 'likes_total',
                    targetValue: 10,
                    timeframe: '30m',
                    castHash: '0x7678633e',
                    minBet: 0.1,
                    maxBet: 50,
                    rules: 'Automated test 30m'
                })
            });
            const data = await response.json();
            if (data.success) {
                alert('🚀 Test Bet Created Successfully!');
                fetchAdminData();
            } else {
                alert('❌ Error: ' + data.error);
            }
        } catch (e) {
            alert('❌ Request failed');
        } finally {
            setIsCreatingTest(false);
        }
    };

    const handleOpenResolveModal = (bet: Bet) => {
        setSelectedBet(bet);
        setResolveModalOpen(true);
    };

    const resolveBet = async (betId: string, result: 'yes' | 'no') => {
        if (!confirm(`Are you sure you want to declare ${result.toUpperCase()} as the winner? Payouts provided cannot be reversed.`)) return;

        setIsResolving(true);
        try {
            const response = await fetch('/api/admin/bets/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ betId, result })
            });
            const data = await response.json();
            if (data.success) {
                alert('✅ Bet resolved successfully!');
                setResolveModalOpen(false);
                fetchAdminData();
            } else {
                alert('❌ Error: ' + data.error);
            }
        } catch (e) {
            alert('❌ Request failed');
        } finally {
            setIsResolving(false);
        }
    };

    const formatTimeRemaining = (expiresAt: number) => {
        const remaining = expiresAt - Date.now();
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

        if (remaining <= 0) return 'Expirado';
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-textPrimary mb-2">
                        Admin Portal
                    </h1>
                    <div className="flex gap-4 mt-4">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'dashboard' ? 'bg-primary text-background' : 'text-textSecondary hover:text-white bg-white/5'}`}
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'users' ? 'bg-primary text-background' : 'text-textSecondary hover:text-white bg-white/5'}`}
                        >
                            User Management
                        </button>
                    </div>
                </div>

                {activeTab === 'dashboard' && (
                    <div className="flex items-center gap-2">
                        <Link
                            href="/admin/monitor"
                            className="hidden md:flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-medium px-4 py-3 rounded-xl transition-all border border-blue-500/30"
                        >
                            📊 Live Monitor
                        </Link>

                        <button
                            onClick={async () => {
                                if (!confirm('This will force check all expired bets. Continue?')) return;
                                try {
                                    const res = await fetch('/api/check', { method: 'POST' });
                                    const data = await res.json();
                                    alert(`Check Complete: ${data.checked} bets checked.`);
                                    fetchAdminData();
                                } catch (e) {
                                    alert('Check Failed');
                                }
                            }}
                            className="hidden md:flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 font-medium px-4 py-3 rounded-xl transition-all border border-yellow-500/30"
                        >
                            ⚡ Force Cron
                        </button>

                        <button
                            onClick={handleCreateTestBet}
                            disabled={isCreatingTest}
                            className="hidden md:flex items-center gap-2 bg-darkGray hover:bg-darkGray/70 text-textPrimary font-medium px-4 py-3 rounded-xl transition-all border border-white/10"
                        >
                            {isCreatingTest ? 'Criando...' : '🧪 Teste (30m)'}
                        </button>

                        <Link
                            href="/admin/create"
                            className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                        >
                            <Plus className="w-5 h-5" />
                            Criar Nova Aposta
                        </Link>
                    </div>
                )}
            </div>

            {/* USERS TAB */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="bg-surface border border-darkGray rounded-2xl p-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-textPrimary">User Database</h2>
                                <p className="text-textSecondary text-sm">Manage popular players for quick selection.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleLoadTop100}
                                    className="px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-bold hover:bg-purple-500/30 transition-all"
                                >
                                    📥 Load Top 100 Template
                                </button>
                                <button
                                    onClick={handleBulkSave}
                                    className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm font-bold hover:bg-green-500/30 transition-all flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> Save All Changes
                                </button>
                                <button
                                    onClick={() => setEditingPlayer({ username: '', displayName: '', pfpUrl: '' })}
                                    className="px-4 py-2 bg-primary text-background rounded-lg text-sm font-bold hover:opacity-90 transition-all"
                                >
                                    + Add User
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-textSecondary" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by username..."
                                className="w-full bg-darkGray border border-darkGray rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-primary"
                            />
                        </div>

                        {/* List */}
                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                            {/* Edit Form */}
                            {editingPlayer && (
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div>
                                        <label className="text-xs text-textSecondary mb-1 block">Username</label>
                                        <input
                                            value={editingPlayer.username}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, username: e.target.value })}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white"
                                            placeholder="handle"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-textSecondary mb-1 block">Display Name</label>
                                        <input
                                            value={editingPlayer.displayName}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, displayName: e.target.value })}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white"
                                            placeholder="Display Name"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-textSecondary mb-1 block">Avatar URL</label>
                                        <input
                                            value={editingPlayer.pfpUrl}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, pfpUrl: e.target.value })}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white"
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSavePlayer(editingPlayer as Player)}
                                            className="flex-1 bg-green-500/20 text-green-500 border border-green-500/30 rounded-lg py-2 font-bold hover:bg-green-500/30"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setEditingPlayer(null)}
                                            className="px-3 bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg py-2 hover:bg-red-500/30"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {filteredPlayers.map(player => (
                                <div key={player.username} className="flex items-center gap-4 bg-white/5 border border-white/5 p-3 rounded-xl hover:bg-white/10 transition-colors group">
                                    <div className="w-10 h-10 rounded-full bg-black/40 overflow-hidden flex-shrink-0 border border-white/10 relative">
                                        {player.pfpUrl ? (
                                            <img src={player.pfpUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs text-white/20">?</div>
                                        )}
                                        {/* Quick Upload Overlay */}
                                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                            <Upload className="w-4 h-4 text-white" />
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) {
                                                        const url = URL.createObjectURL(f);
                                                        const updated = { ...player, pfpUrl: url };
                                                        setPlayers(players.map(p => p.username === player.username ? updated : p));
                                                        // Auto-save just this one logic or let user bulk save? Let's rely on Bulk Save for speed.
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-white truncate">{player.displayName}</div>
                                        <div className="text-xs text-textSecondary truncate">@{player.username}</div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setEditingPlayer(player)}
                                            className="p-2 hover:bg-white/10 rounded-lg text-blue-400"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeletePlayer(player.username)}
                                            className="p-2 hover:bg-red-500/10 rounded-lg text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {filteredPlayers.length === 0 && (
                                <div className="text-center py-10 text-white/40">No players found. Load the template!</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-surface border border-darkGray rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-textSecondary">Total Apostas</span>
                                <TrendingUp className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-3xl font-bold text-textPrimary">
                                {stats.totalBets}
                            </div>
                        </div>

                        <div className="bg-surface border border-darkGray rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-textSecondary">Apostas Ativas</span>
                                <Clock className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-3xl font-bold text-textPrimary">
                                {stats.activeBets}
                            </div>
                        </div>

                        <div className="bg-surface border border-darkGray rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-textSecondary">Volume Total</span>
                                <DollarSign className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-3xl font-bold text-textPrimary">
                                ${stats.totalVolume.toFixed(2)}
                            </div>
                            <div className="text-xs text-textSecondary mt-1">USDC</div>
                        </div>

                        <div className="bg-surface border border-green-500/30 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-textSecondary">Suas Taxas (20%)</span>
                                <DollarSign className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="text-3xl font-bold text-green-500">
                                ${stats.totalFees.toFixed(2)}
                            </div>
                            <div className="text-xs text-textSecondary mt-1">USDC</div>
                        </div>
                    </div>

                    {/* Active Bets Table */}
                    <div className="bg-surface border border-darkGray rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-darkGray">
                            <h2 className="text-xl font-bold text-textPrimary">
                                Apostas Ativas
                            </h2>
                        </div>

                        {bets.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="text-6xl mb-4">📊</div>
                                <h3 className="text-xl font-bold text-textPrimary mb-2">
                                    Nenhuma Aposta Criada
                                </h3>
                                <p className="text-textSecondary mb-6">
                                    Crie sua primeira aposta para começar
                                </p>
                                <Link
                                    href="/admin/create"
                                    className="inline-flex items-center gap-2 bg-primary hover:bg-secondary text-background font-bold px-6 py-3 rounded-xl transition-all"
                                >
                                    <Plus className="w-5 h-5" />
                                    Criar Primeira Aposta
                                </Link>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-darkGray/30">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                                                Aposta
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                                                Alvo
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                                                Período
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                                                Pote
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                                                Participantes
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                                                Tempo Restante
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-darkGray">
                                        {bets.map((bet) => (
                                            <tr key={bet.id} className="hover:bg-darkGray/20 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="font-medium text-textPrimary">@{bet.username}</div>
                                                        <div className="text-sm text-textSecondary">{bet.type}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-textPrimary font-medium">{bet.target}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-textSecondary">
                                                    {bet.timeframe}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-primary font-bold">${bet.totalPot.toFixed(2)}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1">
                                                        <Users className="w-4 h-4 text-textSecondary" />
                                                        <span className="text-textPrimary">{bet.participantCount}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-textSecondary">
                                                        {formatTimeRemaining(bet.expiresAt)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-2">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-medium w-fit ${bet.status === 'active'
                                                            ? 'bg-primary/10 text-primary border border-primary/30'
                                                            : 'bg-green-500/10 text-green-500 border border-green-500/30'
                                                            }`}>
                                                            {bet.status === 'active' ? 'Active' : 'Finished'}
                                                        </span>

                                                        {/* Resolution Button for Active but Expired Bets */}
                                                        {(bet.status === 'active' && Date.now() > bet.expiresAt) && (
                                                            <button
                                                                onClick={() => handleOpenResolveModal(bet)}
                                                                className="text-xs bg-red-500/20 text-red-500 border border-red-500 rounded px-2 py-1 hover:bg-red-500/30 transition-colors font-bold"
                                                            >
                                                                ⚖️ Resolve
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Resolution Modal */}
                    {
                        resolveModalOpen && selectedBet && (
                            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-surface border border-darkGray rounded-3xl max-w-sm w-full p-6">
                                    <h3 className="text-xl font-bold text-textPrimary mb-2">Resolve Bet</h3>
                                    <p className="text-sm text-textSecondary mb-4">
                                        Select the winning outcome for <span className="font-bold text-white">@{selectedBet.username}</span>.
                                        <br /><span className="text-xs text-red-400">This action cannot be undone.</span>
                                    </p>

                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <button
                                            onClick={() => resolveBet(selectedBet.id, 'yes')}
                                            disabled={isResolving}
                                            className="p-4 rounded-xl border border-green-500/50 bg-green-500/10 hover:bg-green-500/20 text-green-500 font-bold transition-all flex flex-col items-center gap-2"
                                        >
                                            {selectedBet.optionA?.imageUrl && (
                                                <img src={selectedBet.optionA.imageUrl} alt="" className="w-10 h-10 rounded-full" />
                                            )}
                                            ✅ {selectedBet.optionA?.label || 'YES'}
                                        </button>
                                        <button
                                            onClick={() => resolveBet(selectedBet.id, 'no')}
                                            disabled={isResolving}
                                            className="p-4 rounded-xl border border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold transition-all flex flex-col items-center gap-2"
                                        >
                                            {selectedBet.optionB?.imageUrl && (
                                                <img src={selectedBet.optionB.imageUrl} alt="" className="w-10 h-10 rounded-full" />
                                            )}
                                            ❌ {selectedBet.optionB?.label || 'NO'}
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => setResolveModalOpen(false)}
                                        className="w-full bg-darkGray py-3 rounded-xl text-textPrimary font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )
                    }
                </>
            )}
        </div>
    );
}
