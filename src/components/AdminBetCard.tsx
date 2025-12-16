'use client';

import { useState } from 'react';
import { X, Target, DollarSign, Users, Clock } from 'lucide-react';
import { useAccount, useWriteContract, useSwitchChain, usePublicClient } from 'wagmi';
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
    participants: {
        yes: any[];
        no: any[];
    };
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

    // Calculate percentages
    const totalYes = bet.participants.yes.length;
    const totalNo = bet.participants.no.length;
    const totalVotes = totalYes + totalNo;
    const yesPercent = totalVotes > 0 ? (totalYes / totalVotes) * 100 : 50;
    const noPercent = totalVotes > 0 ? (totalNo / totalVotes) * 100 : 50;

    // Wagmi hooks
    const { address, isConnected, chainId } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const { switchChainAsync } = useSwitchChain();
    const publicClient = usePublicClient();

    // Configuration
    const IS_MAINNET = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
    const EXPECTED_CHAIN_ID = IS_MAINNET ? 8453 : 84532; // Base Mainnet (8453) or Base Sepolia (84532)

    // USDC Contract Address
    const USDC_ADDRESS = IS_MAINNET
        ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Mainnet
        : '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Sepolia

    // House Address (where money goes)
    const HOUSE_ADDRESS = process.env.NEXT_PUBLIC_RECEIVER_ADDRESS || '0x2Cd0934AC31888827C3711527eb2e0276f3B66b4';

    const formatTimeRemaining = () => {
        const remaining = bet.expiresAt - Date.now();
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

        if (remaining <= 0) return 'Expired';
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h`;
        }
        return `${hours}h ${minutes}m`;
    };

    const getBetTypeLabel = () => {
        switch (bet.type) {
            case 'post_count':
                return `post ${bet.target}+ times`;
            case 'likes_total':
                return `get ${bet.target}+ likes`;
            case 'followers_gain':
                return `gain ${bet.target}+ followers`;
            default:
                return `hit ${bet.target}`;
        }
    };

    const handleSubmit = async () => {
        if (!isConnected || !address) {
            alert('Please connect your wallet first!');
            return;
        }

        setIsSubmitting(true);

        try {
            // 0. Verify and Switch Chain
            if (chainId !== EXPECTED_CHAIN_ID) {
                try {
                    console.log(`Switching chain from ${chainId} to ${EXPECTED_CHAIN_ID}...`);
                    if (switchChainAsync) {
                        await switchChainAsync({ chainId: EXPECTED_CHAIN_ID });
                    } else {
                        throw new Error("Troca de rede não suportada pela carteira.");
                    }
                } catch (switchError) {
                    console.error('Failed to switch chain:', switchError);
                    alert(`⚠️ Error: Wrong network. Please switch to ${IS_MAINNET ? 'Base Mainnet' : 'Base Sepolia'}.`);
                    setIsSubmitting(false);
                    return;
                }
            }

            // 1. Send USDC Transaction
            console.log('Initiating transaction...');
            const amountInWei = parseUnits(amount.toString(), 6); // USDC usually has 6 decimals

            let hash;
            try {
                // Ensure manual gas limit is used for Rabby compatibility on testnets
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
                    // Manual gas for Rabby/Sepolia compatibility
                    gas: BigInt(200000),
                });
                console.log('Transaction broadcast:', hash);

                // WAIT FOR RECEIPT
                setIsSubmitting(true); // Keep loading
                if (!publicClient) throw new Error("Public Client not initialized");

                alert('⏳ Aguardando confirmação na blockchain... (não feche)');
                const receipt = await publicClient.waitForTransactionReceipt({ hash });

                if (receipt.status !== 'success') {
                    throw new Error('A transação falhou na blockchain.');
                }
                console.log('Transaction confirmed:', receipt.transactionHash);


            } catch (txError) {
                console.error('Wallet transaction error:', txError);
                // Extract detail from wagmi error if possible
                const msg = (txError as any).shortMessage || (txError as any).message || 'Wallet Error';
                throw new Error(`Transaction Failed: ${msg}`);
            }

            // 2. Call backend to register bet (ONLY AFTER CONFIRMATION)
            console.log('Registering prediction in backend...');
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
                throw new Error(`Server Error (${response.status}): Try again.`);
            }

            const data = await response.json();

            if (data.success) {
                alert(`✅ Prediction confirmed!`);
                setShowModal(false);
                onBet(); // Refresh the list
            } else {
                alert('⚠️ Payment confirmed, but backend registration failed. Contact support.');
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

                <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-textPrimary font-medium">${bet.totalPot.toFixed(2)}</span>
                    <span className="text-textSecondary">pool</span>
                </div>
                <div className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-textSecondary" />
                    <span className="text-textPrimary font-medium">{bet.participantCount}</span>
                    <span className="text-textSecondary">predictors</span>
                </div>

                <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded-lg border border-yellow-500/20">
                    <span className="text-yellow-500 font-bold text-xs uppercase">Est. Returns:</span>
                    <span className="text-yellow-500 font-bold text-sm">
                        Yes: {totalYes > 0 ? (bet.totalPot / (bet.participants.yes.reduce((a, b) => a + b.amount, 0) || 1)).toFixed(1) : '2.0'}x
                        {' / '}
                        No: {totalNo > 0 ? (bet.totalPot / (bet.participants.no.reduce((a, b) => a + b.amount, 0) || 1)).toFixed(1) : '2.0'}x
                    </span>
                </div>


                {/* Progress Bar */}
                <div className="w-full h-2 bg-darkGray rounded-full mb-4 overflow-hidden flex">
                    <div style={{ width: `${yesPercent}%` }} className="h-full bg-green-500/50" />
                    <div style={{ width: `${noPercent}%` }} className="h-full bg-red-500/50" />
                </div>
                <div className="flex justify-between text-xs text-textSecondary mb-4">
                    <span>YES: {Math.round(yesPercent)}% ({totalYes})</span>
                    <span>NO: {Math.round(noPercent)}% ({totalNo})</span>
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-xs text-textSecondary">
                        ${bet.minBet.toFixed(2)} - ${bet.maxBet.toFixed(2)} USDC
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-primary hover:bg-secondary text-background font-bold px-6 py-2 rounded-xl transition-all"
                    >
                        🎯 Predict
                    </button>
                </div>
            </div >

            {/* Bet Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-surface border border-darkGray rounded-3xl max-w-md w-full">
                            <div className="sticky top-0 bg-surface border-b border-darkGray px-6 py-4 flex items-center justify-between rounded-t-3xl">
                                <h2 className="text-xl font-bold text-textPrimary">
                                    Make Prediction
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
                                        Will <span className="font-bold">@{bet.username}</span> {getBetTypeLabel()} in {bet.timeframe === '24h' ? '24 hours' : '7 days'}?
                                    </p>
                                </div>

                                {/* Choice */}
                                <div>
                                    <label className="block text-sm font-medium text-textPrimary mb-3">
                                        Your Prediction
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
                                            <div className="text-lg font-bold text-textPrimary">NO</div>
                                        </button>
                                    </div>
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="block text-sm font-medium text-textPrimary mb-3">
                                        Prediction Amount (USDC)
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
                                        Predicting <span className="font-bold text-primary">{amount} USDC</span> on{' '}
                                        <span className="font-bold">{choice === 'yes' ? 'YES' : 'NO'}</span>
                                    </p>
                                </div>

                                {/* Submit */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-background font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Confirming in Wallet...' : '🎯 Confirm Prediction'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
