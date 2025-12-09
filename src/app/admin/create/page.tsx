'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Target, Calendar, DollarSign, Users } from 'lucide-react';
import Link from 'next/link';

type BetType = 'post_count' | 'likes_total' | 'followers_gain';
type Timeframe = '24h' | '7d';

export default function CreateBet() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        username: 'dwr',
        betType: 'post_count' as BetType,
        targetValue: 3,
        timeframe: '24h' as Timeframe,
        minBet: 0.05,
        maxBet: 10,
    });

    const betTypeLabels = {
        post_count: { label: 'Número de Posts', icon: '📝' },
        likes_total: { label: 'Total de Likes', icon: '❤️' },
        followers_gain: { label: 'Ganho de Seguidores', icon: '👥' },
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const response = await fetch('/api/admin/bets/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                alert('✅ Aposta criada com sucesso!');
                router.push('/admin');
            } else {
                alert('❌ Erro ao criar aposta: ' + (data.error || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('Error creating bet:', error);
            alert('❌ Falha ao criar aposta');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/admin"
                    className="inline-flex items-center gap-2 text-textSecondary hover:text-textPrimary transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao Dashboard
                </Link>

                <h1 className="text-3xl font-bold text-textPrimary mb-2">
                    Criar Nova Aposta
                </h1>
                <p className="text-textSecondary">
                    Configure a aposta que os usuários poderão participar
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Usuario */}
                <div className="bg-surface border border-darkGray rounded-2xl p-6">
                    <label className="block text-sm font-medium text-textPrimary mb-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-5 h-5 text-primary" />
                            Usuário Farcaster
                        </div>
                    </label>
                    <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                        placeholder="dwr"
                        required
                    />
                    <p className="text-xs text-textSecondary mt-2">
                        Username do Farcaster (sem @)
                    </p>
                </div>

                {/* Tipo de Aposta */}
                <div className="bg-surface border border-darkGray rounded-2xl p-6">
                    <label className="block text-sm font-medium text-textPrimary mb-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-5 h-5 text-primary" />
                            Tipo de Métrica
                        </div>
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {(Object.keys(betTypeLabels) as BetType[]).map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setFormData({ ...formData, betType: type })}
                                className={`p-4 rounded-xl border-2 transition-all ${formData.betType === type
                                        ? 'border-primary bg-primary/10'
                                        : 'border-darkGray hover:border-darkGray/50'
                                    }`}
                            >
                                <div className="text-3xl mb-2">{betTypeLabels[type].icon}</div>
                                <div className="text-sm font-medium text-textPrimary">
                                    {betTypeLabels[type].label}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Valor Alvo e Período */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Valor Alvo */}
                    <div className="bg-surface border border-darkGray rounded-2xl p-6">
                        <label className="block text-sm font-medium text-textPrimary mb-3">
                            Valor Alvo
                        </label>
                        <input
                            type="number"
                            value={formData.targetValue}
                            onChange={(e) => setFormData({ ...formData, targetValue: parseInt(e.target.value) || 0 })}
                            className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                            min={1}
                            required
                        />
                        <p className="text-xs text-textSecondary mt-2">
                            {formData.betType === 'post_count' && `${formData.targetValue} posts ou mais`}
                            {formData.betType === 'likes_total' && `${formData.targetValue} likes totais ou mais`}
                            {formData.betType === 'followers_gain' && `${formData.targetValue} novos seguidores ou mais`}
                        </p>
                    </div>

                    {/* Período */}
                    <div className="bg-surface border border-darkGray rounded-2xl p-6">
                        <label className="block text-sm font-medium text-textPrimary mb-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Período
                            </div>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, timeframe: '24h' })}
                                className={`p-3 rounded-xl border-2 transition-all ${formData.timeframe === '24h'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-darkGray hover:border-darkGray/50'
                                    }`}
                            >
                                <div className="text-sm font-medium text-textPrimary">24 Horas</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, timeframe: '7d' })}
                                className={`p-3 rounded-xl border-2 transition-all ${formData.timeframe === '7d'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-darkGray hover:border-darkGray/50'
                                    }`}
                            >
                                <div className="text-sm font-medium text-textPrimary">7 Dias</div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Limites de Aposta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-surface border border-darkGray rounded-2xl p-6">
                        <label className="block text-sm font-medium text-textPrimary mb-3">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="w-5 h-5 text-primary" />
                                Aposta Mínima (USDC)
                            </div>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.minBet}
                            onChange={(e) => setFormData({ ...formData, minBet: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                            min={0.01}
                            required
                        />
                    </div>

                    <div className="bg-surface border border-darkGray rounded-2xl p-6">
                        <label className="block text-sm font-medium text-textPrimary mb-3">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="w-5 h-5 text-primary" />
                                Aposta Máxima (USDC)
                            </div>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.maxBet}
                            onChange={(e) => setFormData({ ...formData, maxBet: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                            min={formData.minBet}
                            required
                        />
                    </div>
                </div>

                {/* Preview */}
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-2 border-primary/30 rounded-2xl p-6">
                    <h3 className="font-bold text-textPrimary mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Preview da Aposta
                    </h3>
                    <p className="text-textPrimary">
                        <span className="font-bold">@{formData.username}</span> vai{' '}
                        {formData.betType === 'post_count' && `postar ${formData.targetValue}+ vezes`}
                        {formData.betType === 'likes_total' && `receber ${formData.targetValue}+ likes`}
                        {formData.betType === 'followers_gain' && `ganhar ${formData.targetValue}+ seguidores`}
                        {' '}em {formData.timeframe === '24h' ? '24 horas' : '7 dias'}?
                    </p>
                    <p className="text-sm text-textSecondary mt-2">
                        Apostas entre ${formData.minBet.toFixed(2)} e ${formData.maxBet.toFixed(2)} USDC
                    </p>
                </div>

                {/* Submit */}
                <div className="flex gap-4">
                    <Link
                        href="/admin"
                        className="flex-1 bg-darkGray hover:bg-darkGray/70 text-textPrimary font-medium py-3 rounded-xl transition-colors text-center"
                    >
                        Cancelar
                    </Link>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-background font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? 'Criando...' : '🎯 Criar Aposta'}
                    </button>
                </div>
            </form>
        </div>
    );
}
