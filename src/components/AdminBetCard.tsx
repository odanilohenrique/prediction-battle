'use client';

import { useState } from 'react';
import { X, Target, DollarSign, Users, Clock } from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';

interface AdminBet {
    id: string;
    username: string;
    type: string;
    target: number;
    timeframe: string;
    minBet: number;
    maxBet: number;
    expiresAt: number;
    totalPot: number;
    participantCount: number;
}

interface AdminBetCardProps {
    bet: AdminBet;
    onBet: () => void;
}

const BET_AMOUNTS = [0.05, 0.1, 0.5, 1];

export default function AdminBetCard({ bet, onBet }: AdminBetCardProps) {
    const [showModal, setShowModal] = useState(false);
    const [choice, setChoice] = useState<'yes' | 'no'>('yes');
    const [amount, setAmount] = useState(0.1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Wagmi hooks
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();

    // USDC Contract Address (Testnet/Mainnet)
    const USDC_ADDRESS = process.env.NEXT_PUBLIC_USE_MAINNET === 'true'
        ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Mainnet
        : '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Sepolia

    // House Address (where money goes)
    const HOUSE_ADDRESS = process.env.NEXT_PUBLIC_RECEIVER_ADDRESS || '0x2Cd0934AC31888827C3711527eb2e0276f3B66b4';

    const formatTimeRemaining = () => {
        const remaining = bet.expiresAt - Date.now();
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

        if (remaining <= 0) return 'Expirado';
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h`;
        }
        return `${hours}h ${minutes}m`;
    };

    const getBetTypeLabel = () => {
        switch (bet.type) {
            case 'post_count':
                return `postar ${bet.target}+ vezes`;
            case 'likes_total':
                return `receber ${bet.target}+ likes`;
            case 'followers_gain':
                return `ganhar ${bet.target}+ seguidores`;
            default:
                return `atingir ${bet.target}`;
        }
    };

    const handleSubmit = async () => {
        if (!isConnected || !address) {
            alert('Por favor, conecte sua carteira primeiro!');
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Send USDC Transaction
            console.log('Initiating transaction...');
            const amountInWei = parseUnits(amount.toString(), 6); // USDC usually has 6 decimals

            let hash;
            try {
                hash = await writeContractAsync({
                    address: USDC_ADDRESS as `0x${string}`,
                    abi: [{
                        name: 'transfer',
                        type: 'function',
                        stateMutability: 'nonpayable',
                        inputs: [
                            { name: 'to', type: 'address' },
                            { name: 'amount', type: 'uint256' }
                        ],
                        outputs: [{ name: '', type: 'bool' }]
                    }],
                    functionName: 'transfer',
                    args: [HOUSE_ADDRESS as `0x${string}`, amountInWei],
                    // Manually setting gas limit can sometimes fix simulation 500 errors
                    // gas: BigInt(100000), 
                });
                console.log('Transaction sent:', hash);
            } catch (txError) {
                console.error('Wallet transaction error:', txError);
                // Extract detail from wagmi error if possible
                const msg = (txError as any).shortMessage || (txError as any).message || 'Erro na carteira';
                throw new Error(`Erro na transação: ${msg}`);
            }

            // 2. Call backend to register bet
            console.log('Registering bet in backend...');
            const response = await fetch('/api/predictions/bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    betId: bet.id,
                    choice,
                    amount,
                    txHash: hash,
                    userAddress: address
                }),
            });

            // Check for HTTP errors (like 500)
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                throw new Error(`Erro no servidor (${response.status}): Tente novamente.`);
            }

            const data = await response.json();

            if (data.success) {
                alert(`✅ Aposta confirmada! Tx: ${hash.substring(0, 10)}...`);
                setShowModal(false);
                onBet(); // Refresh the list
            } else {
                alert('⚠️ Pagamento enviado, mas erro ao registrar no backend. Entre em contato com suporte.');
            }
        } catch (error) {
            console.error('Error submitting bet:', error);
            alert(`❌ ${(error as Error).message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-2 border-primary/30 rounded-2xl p-6 hover:border-primary/50 transition-all">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                            <Target className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-textPrimary text-lg">
                                @{bet.username}
                            </h3>
                            <p className="text-sm text-textSecondary">
                                {getBetTypeLabel()}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-1 text-textSecondary text-sm">
                            <Clock className="w-4 h-4" />
                            <span>{formatTimeRemaining()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <span className="text-textPrimary font-medium">${bet.totalPot.toFixed(2)}</span>
                        <span className="text-textSecondary">no pote</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-textSecondary" />
                        <span className="text-textPrimary font-medium">{bet.participantCount}</span>
                        <span className="text-textSecondary">apostadores</span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-xs text-textSecondary">
                        ${bet.minBet.toFixed(2)} - ${bet.maxBet.toFixed(2)} USDC
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-primary hover:bg-secondary text-background font-bold px-6 py-2 rounded-xl transition-all"
                    >
                        🎯 Apostar
                    </button>
                </div>
            </div>

            {/* Bet Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-darkGray rounded-3xl max-w-md w-full">
                        <div className="sticky top-0 bg-surface border-b border-darkGray px-6 py-4 flex items-center justify-between rounded-t-3xl">
                            <h2 className="text-xl font-bold text-textPrimary">
                                Fazer Aposta
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-10 h-10 rounded-full bg-darkGray hover:bg-darkGray/70 flex items-center justify-center transition-colors"
                            >
                                <X className="w-5 h-5 text-textSecondary" />
                            </button>
                        </div>

                        <div className="px-6 py-6 space-y-6">
                            {/* Question */}
                            <div className="bg-darkGray/30 rounded-xl p-4">
                                <p className="text-textPrimary">
                                    <span className="font-bold">@{bet.username}</span> vai {getBetTypeLabel()} em {bet.timeframe === '24h' ? '24 horas' : '7 dias'}?
                                </p>
                            </div>

                            {/* Choice */}
                            <div>
                                <label className="block text-sm font-medium text-textPrimary mb-3">
                                    Sua Previsão
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setChoice('yes')}
                                        className={`p-6 rounded-xl border-2 transition-all ${choice === 'yes'
                                            ? 'border-green-500 bg-green-500/10'
                                            : 'border-darkGray hover:border-darkGray/50'
                                            }`}
                                    >
                                        <div className="text-4xl mb-2">✅</div>
                                        <div className="text-lg font-bold text-textPrimary">SIM</div>
                                    </button>
                                    <button
                                        onClick={() => setChoice('no')}
                                        className={`p-6 rounded-xl border-2 transition-all ${choice === 'no'
                                            ? 'border-red-500 bg-red-500/10'
                                            : 'border-darkGray hover:border-darkGray/50'
                                            }`}
                                    >
                                        <div className="text-4xl mb-2">❌</div>
                                        <div className="text-lg font-bold text-textPrimary">NÃO</div>
                                    </button>
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium text-textPrimary mb-3">
                                    Valor da Aposta (USDC)
                                </label>
                                <div className="grid grid-cols-4 gap-3">
                                    {BET_AMOUNTS.filter(a => a >= bet.minBet && a <= bet.maxBet).map((a) => (
                                        <button
                                            key={a}
                                            onClick={() => setAmount(a)}
                                            className={`p-4 rounded-xl border-2 transition-all ${amount === a
                                                ? 'border-primary bg-primary/10'
                                                : 'border-darkGray hover:border-darkGray/50'
                                                }`}
                                        >
                                            <DollarSign className="w-6 h-6 mx-auto mb-1 text-primary" />
                                            <div className="text-lg font-bold text-textPrimary">{a}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/30 rounded-xl p-4">
                                <p className="text-sm text-textPrimary">
                                    Apostando <span className="font-bold text-primary">{amount} USDC</span> em{' '}
                                    <span className="font-bold">{choice === 'yes' ? 'SIM' : 'NÃO'}</span>
                                </p>
                            </div>

                            {/* Submit */}
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-background font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? 'Confirmando na Carteira...' : '🎯 Confirmar Aposta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
