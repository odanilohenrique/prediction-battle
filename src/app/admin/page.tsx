'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, TrendingUp, Users, DollarSign, Clock } from 'lucide-react';
import Link from 'next/link';

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
}

export default function AdminDashboard() {
    const router = useRouter();
    const [bets, setBets] = useState<Bet[]>([]);
    const [stats, setStats] = useState({
        totalBets: 0,
        activeBets: 0,
        totalVolume: 0,
        totalFees: 0,
    });

    useEffect(() => {
        fetchAdminData();
    }, []);

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
                        Dashboard Admin
                    </h1>
                    <p className="text-textSecondary">
                        Gerencie apostas e monitore métricas
                    </p>
                </div>

                <Link
                    href="/admin/create"
                    className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus className="w-5 h-5" />
                    Criar Nova Aposta
                </Link>
            </div>

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
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${bet.status === 'active'
                                                    ? 'bg-primary/10 text-primary border border-primary/30'
                                                    : 'bg-green-500/10 text-green-500 border border-green-500/30'
                                                }`}>
                                                {bet.status === 'active' ? 'Ativa' : 'Finalizada'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
