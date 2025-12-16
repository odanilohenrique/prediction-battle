'use client';

import { useState } from 'react';
import { X, Target, DollarSign, Users, Clock, ScrollText } from 'lucide-react';
import { useAccount, useWriteContract, useSwitchChain, usePublicClient } from 'wagmi';
import { parseUnits } from 'viem';

interface AdminBet {
    id: string;
    username: string;
    displayName?: string;
    pfpUrl?: string;
    fid?: number;
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
    rules?: string;
}

interface AdminBetCardProps {
    bet: AdminBet;
    onBet: () => void;
}

const BET_AMOUNTS = [0.05, 0.1, 0.5, 1];

export default function AdminBetCard({ bet, onBet }: AdminBetCardProps) {
    const [showModal, setShowModal] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);
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
                        {/* Farcaster Avatar */}
                        {bet.pfpUrl ? (
                            <img
                                src={bet.pfpUrl}
                                alt={bet.username}
                                className="w-12 h-12 rounded-full object-cover border-2 border-primary/30"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                <Target className="w-6 h-6 text-primary" />
                            </div>
                        )}
                        <div>
                            <h3 className="font-bold text-textPrimary text-lg">
                                {bet.displayName || `@${bet.username}`}
                            </h3>
                            <p className="text-sm text-textSecondary">
                                @{bet.username} • {getBetTypeLabel()}
                            </p>
                        </div>
                    </div>
                    <div className="text-right flex flex-col gap-2 items-end">
                        <div className="flex items-center gap-1 text-textSecondary text-sm">
                            <Clock className="w-4 h-4" />
                            <span>{formatTimeRemaining()}</span>
                        </div>
                        {/* Rules Button */}
                        <button
                            onClick={() => setShowRulesModal(true)}
                            className="flex items-center gap-1 text-xs text-primary hover:text-secondary transition-colors"
                        >
                            <ScrollText className="w-3 h-3" />
                            Rules
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-3">
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
                </div>

                {/* Dynamic Odds & Progress Section */}
                <div className="mb-4">
                    <div className="text-center mb-2">
                        <span className="text-textSecondary text-xs uppercase tracking-wider font-semibold">est. returns</span>
                    </div>

                    <div className="flex justify-between items-end mb-1 px-1">
                        <span className="text-green-400 font-bold text-lg">
                            {(() => {
                                const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                                const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                                if (yesPool === 0) return '2.00';
                                // House takes 20% of WINNINGS (loser's pool), not total
                                const multiplier = 1 + (noPool * 0.8) / yesPool;
                                return multiplier.toFixed(2);
                            })()}x
                        </span>
                        <span className="text-red-400 font-bold text-lg">
                            {(() => {
                                const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                                const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                                if (noPool === 0) return '2.00';
                                // House takes 20% of WINNINGS (loser's pool), not total
                                const multiplier = 1 + (yesPool * 0.8) / noPool;
                                return multiplier.toFixed(2);
                            })()}x
                        </span>
                    </div>

                    <div className="w-full h-4 bg-darkGray rounded-full overflow-hidden flex shadow-inner">
                        <div
                            style={{ width: `${yesPercent}%` }}
                            className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500 ease-out"
                        />
                        <div
                            style={{ width: `${noPercent}%` }}
                            className="h-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500 ease-out"
                        />
                    </div>

                    <div className="flex justify-between text-xs text-textSecondary mt-1 font-medium">
                        <span>YES: {Math.round(yesPercent)}% ({totalYes})</span>
                        <span>NO: {Math.round(noPercent)}% ({totalNo})</span>
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
                                    <p className="text-sm text-textPrimary mb-2">
                                        Predicting <span className="font-bold text-primary">{amount} USDC</span> on{' '}
                                        <span className="font-bold">{choice === 'yes' ? 'YES' : 'NO'}</span>
                                    </p>

                                    <div className="flex justify-between items-center border-t border-primary/20 pt-2 mt-2">
                                        <span className="text-sm text-textSecondary">Potential Payout (Est.):</span>
                                        <div className="text-right">
                                            <span className="block text-green-400 font-bold">
                                                $ {(() => {
                                                    const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                                                    const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                                                    // Correct formula: 1 + (LoserPool * 0.8) / WinnerPool
                                                    // House takes 20% of WINNINGS only
                                                    const multiplier = choice === 'yes'
                                                        ? (yesPool === 0 ? 2.0 : 1 + (noPool * 0.8) / yesPool)
                                                        : (noPool === 0 ? 2.0 : 1 + (yesPool * 0.8) / noPool);
                                                    return (amount * multiplier).toFixed(2);
                                                })()}
                                            </span>
                                            <span className="text-xs text-textSecondary">
                                                20% House Fee on Winnings
                                            </span>
                                        </div>
                                    </div>
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

            {/* Rules Modal */}
            {showRulesModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-darkGray rounded-3xl max-w-md w-full">
                        <div className="sticky top-0 bg-surface border-b border-darkGray px-6 py-4 flex items-center justify-between rounded-t-3xl">
                            <h2 className="text-xl font-bold text-textPrimary flex items-center gap-2">
                                <ScrollText className="w-5 h-5 text-primary" />
                                Verification Rules
                            </h2>
                            <button
                                onClick={() => setShowRulesModal(false)}
                                className="w-10 h-10 rounded-full bg-darkGray hover:bg-darkGray/70 flex items-center justify-center transition-colors"
                            >
                                <X className="w-5 h-5 text-textSecondary" />
                            </button>
                        </div>
                        <div className="px-6 py-6">
                            <div className="bg-darkGray/30 rounded-xl p-4 mb-4">
                                <h3 className="font-bold text-textPrimary mb-2">Bet: @{bet.username}</h3>
                                <p className="text-sm text-textSecondary">
                                    Target: {bet.target} ({bet.type}) in {bet.timeframe}
                                </p>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-textSecondary uppercase">How This Bet Is Verified:</h4>
                                <p className="text-textPrimary whitespace-pre-wrap">
                                    {bet.rules || 'This bet is verified via Neynar API at the deadline. Engagement metrics are checked automatically.'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowRulesModal(false)}
                                className="w-full mt-6 bg-primary hover:bg-secondary text-background font-bold py-3 rounded-xl transition-all"
                            >
                                Got it!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
