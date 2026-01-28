'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Plus, TrendingUp, Users, DollarSign, Clock, Save, Trash2, Search, Upload, Loader2, Link as LinkIcon, Shield } from 'lucide-react';
import Link from 'next/link';
import { CURRENT_CONFIG, getContractAddress } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';

// Mock Top Handles
const TOP_100_HANDLES = [
    'jessepollak', 'dwr', 'vitalik', 'betashop.eth', 'pugson', 'ccarella', 'nonlinear.eth', '0xen',
    'brianjckim', 'limone.eth', 'yitong', 'ace', 'cameron', 'tyler', 'barmstrong', 'balajis',
    'cdixon.eth', 'fredwilson', 'naval', 'pb', 'w1nt3r', 'zachterrell', 'matthew',
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
    createdAt: number;
    payout?: number;
    onChainState?: number; // 0=OPEN, 1=LOCKED, 2=PROPOSED, 3=DISPUTED, 4=RESOLVED
}

import { useModal } from '@/providers/ModalProvider';
import ResolveModal from '@/components/admin/ResolveModal';

export default function AdminDashboard() {
    const { showModal, showAlert, showConfirm } = useModal();
    const router = useRouter();

    // State definitions
    const [activeTab, setActiveTab] = useState('dashboard');
    const [players, setPlayers] = useState<Player[]>([]);
    const [bets, setBets] = useState<Bet[]>([]);
    const [stats, setStats] = useState({ totalBets: 0, activeBets: 0, disputedBets: 0, totalVolume: 0, totalFees: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
    const [resolveModalOpen, setResolveModalOpen] = useState(false);
    const [selectedBet, setSelectedBet] = useState<Bet | null>(null);


    const filteredPlayers = players
        .filter(p =>
            p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.displayName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => a.username.localeCompare(b.username));

    useEffect(() => {
        fetchAdminData();
        fetchPlayers();
    }, []);

    async function fetchPlayers() {
        try {
            const res = await fetch('/api/admin/players');
            const data = await res.json();
            if (data.success && data.players) {
                setPlayers(data.players);
            }
        } catch (e) {
            console.error('Failed to load players:', e);
        }
    }

    const handleLoadTop100 = () => {
        const newPlayers = TOP_100_HANDLES.map(username => ({
            username,
            displayName: username,
            pfpUrl: ''
        }));

        // Merge with existing avoiding duplicates
        const uniquePlayers = [...players];
        newPlayers.forEach(np => {
            if (!uniquePlayers.find(p => p.username === np.username)) {
                uniquePlayers.push(np);
            }
        });

        setPlayers(uniquePlayers);
        showAlert('Template Loaded', `Added missing profiles from Top 100 list. Please add photos and click Save All.`, 'success');
    };

    const handleSavePlayer = async (player: Player) => {
        // Optimistic update
        const exists = players.find(p => p.username === player.username);
        let newPlayers;
        if (exists) {
            newPlayers = players.map(p => p.username === player.username ? player : p);
        } else {
            newPlayers = [...players, player];
        }
        setPlayers(newPlayers);
        setEditingPlayer(null);

        // Persist immediately
        try {
            const res = await fetch('/api/admin/players', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(player)
            });

            if (res.ok) {
                showAlert('Saved', 'Player saved successfully!', 'success');
            } else {
                throw new Error('Save failed');
            }
        } catch (e) {
            showAlert('Error', 'Error saving to database', 'error');
            // Revert on error? For now, we keep optimistic state but warn.
        }
    };

    const handleBulkSave = async () => {
        showConfirm('Save All?', `Save all ${players.length} players?`, async () => {
            try {
                const res = await fetch('/api/admin/players', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ players })
                });
                if (res.ok) showAlert('Success', 'Saved successfully!', 'success');
            } catch (e) {
                showAlert('Error', 'Error saving', 'error');
            }
        });
    };

    const handleDeletePlayer = (username: string) => {
        showConfirm('Delete Player?', 'Remove this player from the list? This creates a save point immediately.', async () => {
            const newPlayers = players.filter(p => p.username !== username);
            setPlayers(newPlayers);

            try {
                // We use bulk save for deletion to override the set
                const res = await fetch('/api/admin/players', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ players: newPlayers })
                });
                if (res.ok) showAlert('Deleted', 'Player removed and list saved.', 'success');
            } catch (e) {
                showAlert('Error', 'Error saving deletion', 'error');
            }
        });
    };

    async function fetchAdminData() {
        try {
            const response = await fetch(`/api/admin/bets?t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache' }
            });
            const data = await response.json();

            if (data.success) {
                setBets(data.bets || []);
                setStats(data.stats || { totalBets: 0, activeBets: 0, totalVolume: 0, totalFees: 0 });
            }
        } catch (error) {
            console.error('Error fetching admin data:', error);
        }
    }

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
                showAlert('Test Bet Created', 'Test Bet Created Successfully!', 'success');
                fetchAdminData();
            } else {
                showAlert('Error', 'Error: ' + data.error, 'error');
            }
        } catch (e) {
            showAlert('Error', 'Request failed', 'error');
        } finally {
            setIsCreatingTest(false);
        }
    };

    const handleOpenResolveModal = (bet: Bet) => {
        setSelectedBet(bet);
        setResolveModalOpen(true);
    };



    const handleDeleteBet = async (betId: string) => {
        showConfirm('Delete Bet?', 'Are you sure you want to delete this bet? This cannot be undone.', async () => {
            try {
                const res = await fetch('/api/admin/bets/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ betId })
                });
                if (res.ok) {
                    showAlert('Deleted', 'Bet deleted successfully.', 'success');
                    fetchAdminData();
                } else {
                    showAlert('Error', 'Failed to delete bet.', 'error');
                }
            } catch (e) {
                showAlert('Error', 'Request failed', 'error');
            }
        });
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
            {/* Header Row */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-textPrimary mb-4">
                        Admin Portal
                    </h1>
                    <div className="flex flex-wrap gap-2">
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
                        <button
                            onClick={() => setActiveTab('disputes')}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'disputes' ? 'bg-red-500 text-white' : 'text-textSecondary hover:text-red-500 bg-white/5'}`}
                        >
                            ⚠️ Disputes ({bets.filter(b => b.onChainState === 3).length})
                        </button>
                    </div>
                </div>

                {/* Action Buttons - Only show on Dashboard */}
                {activeTab === 'dashboard' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={async () => {
                                showConfirm('Delete ALL Bets?', 'DANGER: This will wipe all bets from the database. This is irreversible. Continue?', async () => {
                                    try {
                                        const res = await fetch('/api/admin/bets/delete-all', { method: 'POST', body: JSON.stringify({}) });
                                        if (res.ok) {
                                            showAlert('NUKED', 'All bets deleted.', 'success');
                                            fetchAdminData();
                                        } else {
                                            showAlert('Error', 'Failed to delete.', 'error');
                                        }
                                    } catch (e) {
                                        showAlert('Error', 'Request failed', 'error');
                                    }
                                });
                            }}
                            className="hidden md:flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-medium px-4 py-3 rounded-xl transition-all border border-red-500/30"
                        >
                            ☢️ NUKE ALL
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

            {/* DISPUTES TAB CONTENT */}
            {activeTab === 'disputes' && (
                <div className="bg-surface border border-red-500/20 rounded-2xl overflow-hidden animate-fade-in mb-8">
                    <div className="px-6 py-4 border-b border-white/5 bg-red-500/5">
                        <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            Resolution Queue
                        </h2>
                        <p className="text-sm text-red-400/60">Markets that are active but expired/pending resolution.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-black/20">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Market</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Pot</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {bets.filter(b => b.onChainState === 3).map(bet => (
                                    <tr key={bet.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white">@{bet.username}</div>
                                            <div className="text-xs text-textSecondary">{bet.type}</div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-green-400 font-bold">${bet.totalPot.toFixed(2)}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                                🔴 DISPUTED
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleOpenResolveModal(bet)}
                                                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-500 transition-colors shadow-[0_0_10px_rgba(147,51,234,0.4)] flex items-center gap-2"
                                            >
                                                ⚖️ ARBITRAR DISPUTA
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {bets.filter(b => b.onChainState === 3).length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-textSecondary">
                                            <Shield className="w-12 h-12 text-white/10 mx-auto mb-3" />
                                            <p className="text-lg font-bold text-white/20">No Pending Disputes</p>
                                            <p className="text-sm">All markets are running smoothly.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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
                                        {[...bets].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((bet) => (
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
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex flex-col gap-2">
                                                            <span className={`px-3 py-1 rounded-full text-xs font-medium w-fit ${bet.status === 'active'
                                                                ? 'bg-primary/10 text-primary border border-primary/30'
                                                                : 'bg-green-500/10 text-green-500 border border-green-500/30'
                                                                }`}>
                                                                {bet.status === 'active' ? 'Active' : 'Finished'}
                                                            </span>

                                                            {/* Resolution Button for Active but Expired Bets */}
                                                            {(bet.status === 'active') && (
                                                                <button
                                                                    onClick={() => handleOpenResolveModal(bet)}
                                                                    className="text-xs bg-red-500/20 text-red-500 border border-red-500 rounded px-2 py-1 hover:bg-red-500/30 transition-colors font-bold"
                                                                >
                                                                    ⚖️ Resolve
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Individual Delete Button */}
                                                        <button
                                                            onClick={() => handleDeleteBet(bet.id)}
                                                            className="p-2 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-500 transition-colors"
                                                            title="Delete Bet"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
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

                </>
            )}
            {/* Resolution Modal Component */}
            <ResolveModal
                isOpen={resolveModalOpen}
                onClose={() => setResolveModalOpen(false)}
                betId={selectedBet?.id}
                username={selectedBet?.username}
            />
        </div>
    );
}

