'use client';

import { useState } from 'react';
import { X, User as UserIcon, Target, Calendar, DollarSign } from 'lucide-react';

interface UserPredictionModalProps {
    username: string;
    onClose: () => void;
}

const BET_AMOUNTS = [0.05, 0.1, 0.5, 1];

type PredictionType = 'post_count' | 'likes_total' | 'followers_gain';

import { useModal } from '@/providers/ModalProvider';

// ...

export default function UserPredictionModal({ username, onClose }: UserPredictionModalProps) {
    const { showAlert, showModal } = useModal();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [predictionType, setPredictionType] = useState<PredictionType>('post_count');
    const [targetValue, setTargetValue] = useState<string>('3');
    const [timeframe, setTimeframe] = useState<'24h' | '7d'>('24h');
    const [choice, setChoice] = useState<'yes' | 'no'>('yes');
    const [betAmount, setBetAmount] = useState<string>('0.1');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const predictionTypeLabels = {
        post_count: {
            label: 'Número de Posts',
            description: 'Quantos casts o usuário vai publicar',
            icon: '📝',
        },
        likes_total: {
            label: 'Total de Likes',
            description: 'Soma de likes em todos os casts',
            icon: '❤️',
        },
        followers_gain: {
            label: 'Ganho de Seguidores',
            description: 'Novos seguidores no período',
            icon: '👥',
        },
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const targetValNum = parseFloat(targetValue) || 0;
        const betAmountNum = parseFloat(betAmount) || 0;

        try {
            const response = await fetch('/api/predictions/user/create', {
                // ...
            });

            const data = await response.json();

            if (data.success) {
                showModal({
                    type: 'success',
                    title: 'PREVISÃO CRIADA!',
                    message: `${choice === 'yes' ? 'SIM' : 'NÃO'}, @${username} ${choice === 'yes' ? 'VAI' : 'NÃO VAI'} ${predictionType === 'post_count' ? `postar ${targetValNum}+ vezes` :
                        predictionType === 'likes_total' ? `receber ${targetValNum}+ likes` :
                            `ganhar ${targetValNum}+ seguidores`
                        } em ${timeframe === '24h' ? '24 horas' : '7 dias'}`,
                    confirmText: 'Show!',
                    onConfirm: onClose
                });
            } else {
                showAlert('ERRO', data.error || 'Erro desconhecido', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('ERRO FATAL', 'Falha ao criar previsão. Tente novamente.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-darkGray rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-surface border-b border-darkGray px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-textPrimary">
                        Criar Previsão sobre @{username}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-darkGray hover:bg-darkGray/70 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-textSecondary" />
                    </button>
                </div>

                {/* Step Indicator */}
                <div className="px-6 py-4 flex items-center gap-2">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-darkGray'
                                }`}
                        />
                    ))}
                </div>

                <div className="px-6 py-6">
                    {/* Step 1: Choose Prediction Type */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-textPrimary mb-4">
                                    O que você quer prever?
                                </h3>
                                <div className="space-y-3">
                                    {Object.entries(predictionTypeLabels).map(([type, info]) => (
                                        <button
                                            key={type}
                                            onClick={() => setPredictionType(type as PredictionType)}
                                            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${predictionType === type
                                                ? 'border-primary bg-primary/10'
                                                : 'border-darkGray hover:border-darkGray/50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="text-3xl">{info.icon}</div>
                                                <div>
                                                    <div className="font-bold text-textPrimary">{info.label}</div>
                                                    <div className="text-sm text-textSecondary">{info.description}</div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-textPrimary mb-2">
                                    Valor Alvo
                                </label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(e.target.value)}
                                    className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                                />
                                <p className="text-xs text-textSecondary mt-2">
                                    {predictionType === 'post_count' && `${targetValue || 0} posts ou mais`}
                                    {predictionType === 'likes_total' && `${targetValue || 0} likes totais ou mais`}
                                    {predictionType === 'followers_gain' && `${targetValue || 0} novos seguidores ou mais`}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-textPrimary mb-2">
                                    Período
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setTimeframe('24h')}
                                        className={`p-4 rounded-xl border-2 transition-all ${timeframe === '24h'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-darkGray hover:border-darkGray/50'
                                            }`}
                                    >
                                        <Calendar className="w-6 h-6 mx-auto mb-2 text-primary" />
                                        <div className="text-sm font-medium text-textPrimary">24 Horas</div>
                                    </button>
                                    <button
                                        onClick={() => setTimeframe('7d')}
                                        className={`p-4 rounded-xl border-2 transition-all ${timeframe === '7d'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-darkGray hover:border-darkGray/50'
                                            }`}
                                    >
                                        <Calendar className="w-6 h-6 mx-auto mb-2 text-primary" />
                                        <div className="text-sm font-medium text-textPrimary">7 Dias</div>
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                className="w-full bg-primary hover:bg-secondary text-background font-bold py-3 rounded-xl transition-colors"
                            >
                                Continuar
                            </button>
                        </div>
                    )}

                    {/* Step 2: Choose Prediction */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-textPrimary">
                                Sua Previsão
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setChoice('yes')}
                                    className={`p-6 rounded-xl border-2 transition-all ${choice === 'yes'
                                        ? 'border-green-500 bg-green-500/10'
                                        : 'border-darkGray hover:border-darkGray/50'
                                        }`}
                                >
                                    <div className="text-4xl mb-2">✅</div>
                                    <div className="text-lg font-bold text-textPrimary mb-1">SIM</div>
                                    <div className="text-sm text-textSecondary">
                                        Vai atingir {targetValue || 0}+
                                    </div>
                                </button>
                                <button
                                    onClick={() => setChoice('no')}
                                    className={`p-6 rounded-xl border-2 transition-all ${choice === 'no'
                                        ? 'border-red-500 bg-red-500/10'
                                        : 'border-darkGray hover:border-darkGray/50'
                                        }`}
                                >
                                    <div className="text-4xl mb-2">❌</div>
                                    <div className="text-lg font-bold text-textPrimary mb-1">NÃO</div>
                                    <div className="text-sm text-textSecondary">
                                        Não vai atingir {targetValue || 0}
                                    </div>
                                </button>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 bg-darkGray hover:bg-darkGray/70 text-textPrimary font-medium py-3 rounded-xl transition-colors"
                                >
                                    Voltar
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex-1 bg-primary hover:bg-secondary text-background font-bold py-3 rounded-xl transition-colors"
                                >
                                    Continuar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Choose Bet Amount */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-textPrimary">
                                Valor da Aposta (USDC)
                            </h3>
                            <div className="grid grid-cols-4 gap-3">
                                {BET_AMOUNTS.map((amount) => (
                                    <button
                                        key={amount}
                                        onClick={() => setBetAmount(amount.toString())}
                                        className={`p-4 rounded-xl border-2 transition-all ${parseFloat(betAmount) === amount
                                            ? 'border-primary bg-primary/10'
                                            : 'border-darkGray hover:border-darkGray/50'
                                            }`}
                                    >
                                        <DollarSign className="w-6 h-6 mx-auto mb-1 text-primary" />
                                        <div className="text-lg font-bold text-textPrimary">{amount}</div>
                                    </button>
                                ))}
                            </div>

                            {/* Summary */}
                            <div className="bg-darkGray rounded-xl p-4 space-y-2">
                                <div className="text-sm font-medium text-textSecondary">Resumo</div>
                                <div className="text-textPrimary">
                                    Apostando <span className="text-primary font-bold">{betAmount || 0} USDC</span>
                                    {' '}que{' '}
                                    <span className="font-bold">@{username}</span>
                                    {' '}{choice === 'yes' ? 'VAI' : 'NÃO VAI'}{' '}
                                    {predictionType === 'post_count' && `postar ${targetValue || 0}+ vezes`}
                                    {predictionType === 'likes_total' && `receber ${targetValue || 0}+ likes`}
                                    {predictionType === 'followers_gain' && `ganhar ${targetValue || 0}+ seguidores`}
                                    {' '}em {timeframe === '24h' ? '24 horas' : '7 dias'}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(2)}
                                    className="flex-1 bg-darkGray hover:bg-darkGray/70 text-textPrimary font-medium py-3 rounded-xl transition-colors"
                                >
                                    Voltar
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-background font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? 'Criando...' : '🎯 Criar Aposta'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
