'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';
import { TrendingUp, Wallet, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Bet } from '@/lib/store';

export default function PayoutsPage() {
    const [payouts, setPayouts] = useState<Bet[]>([]);
    const [loading, setLoading] = useState(true);
    const { address, chainId } = useAccount(); // Added chainId
    const { writeContractAsync } = useWriteContract();
    const { switchChainAsync } = useSwitchChain(); // Added switchChain

    // USDC Address (Same as in AdminBetCard)
    const IS_MAINNET = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
    const EXPECTED_CHAIN_ID = IS_MAINNET ? 8453 : 84532; // Added Expected Chain ID
    const USDC_ADDRESS = IS_MAINNET
        ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

    useEffect(() => {
        fetchPayouts();
    }, []);

    async function fetchPayouts() {
        try {
            const res = await fetch('/api/admin/payouts');
            const data = await res.json();
            if (data.success) {
                setPayouts(data.payouts);
            }
        } catch (error) {
            console.error('Error fetching payouts:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSync() {
        if (!confirm('Run automated checker to find expired bets?')) return;
        setLoading(true);
        try {
            const res = await fetch('/api/check', { method: 'POST' });
            const data = await res.json();
            alert(`Sync Complete! Checked ${data.checked} bets.`);
            fetchPayouts(); // Refresh list
        } catch (error) {
            console.error('Sync failed:', error);
            alert('Failed to sync payouts');
            setLoading(false);
        }
    }

    const handlePayWinner = async (userAddress: string, amount: number) => {
        if (!userAddress || userAddress === 'demo_user') {
            alert('Cannot pay demo user or invalid address.');
            return;
        }

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
                    return;
                }
            }

            if (!confirm(`Send ${amount.toFixed(2)} USDC to ${userAddress}?`)) return;

            const amountInWei = parseUnits(amount.toString(), 6);

            const hash = await writeContractAsync({
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
                args: [userAddress as `0x${string}`, amountInWei],
                gas: BigInt(200000), // Manual gas limit to prevent simulation 500 errors
            });

            alert(`✅ Transaction Sent! Hash: ${hash}`);
            // In a real app, we would now update the backend to mark this specific payout as 'paid'
            // For MVP, we just show the hash.
        } catch (error) {
            console.error('Payment failed:', error);
            alert('❌ Payment Failed: ' + (error as Error).message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-textPrimary mb-2 flex items-center gap-2">
                <Wallet className="w-8 h-8 text-primary" />
                Payout Dashboard
            </h1>
            <div className="flex justify-between items-center mb-8">
                <p className="text-textSecondary">
                    Manually distribute winnings to predictors from the House Wallet.
                </p>
                <button
                    onClick={handleSync}
                    className="flex items-center gap-2 bg-darkGray hover:bg-darkGray/70 text-textPrimary px-4 py-2 rounded-xl transition-colors font-medium border border-white/10"
                >
                    <CheckCircle className="w-4 h-4" />
                    Sync / Check Expired
                </button>
            </div>

            {payouts.length === 0 ? (
                <div className="text-center py-12 bg-surface rounded-xl border border-darkGray">
                    <p className="text-textSecondary">No completed predictions needing payout.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {payouts.map((bet) => {
                        const result = bet.result || 'no'; // Default to no if undefined (shouldn't happen here)
                        const winners = result === 'yes' ? bet.participants.yes : bet.participants.no;
                        const totalPot = bet.totalPot;
                        const winnersPot = totalPot * 0.8;
                        const totalWinningStake = winners.reduce((sum, p) => sum + p.amount, 0);

                        return (
                            <div key={bet.id} className="bg-surface border border-darkGray rounded-xl p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-textPrimary text-lg">
                                            @{bet.username}
                                        </h3>
                                        <p className="text-sm text-textSecondary">
                                            Target: {bet.target} ({bet.type})
                                        </p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${result === 'yes' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                                        }`}>
                                        Result: {result.toUpperCase()}
                                    </div>
                                </div>

                                <div className="bg-darkGray/30 rounded-lg p-3 mb-4 flex gap-4 text-sm">
                                    <div>
                                        <span className="text-textSecondary">Total Pot:</span>{' '}
                                        <span className="font-bold text-textPrimary">${totalPot.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-textSecondary">Winners Pot (80%):</span>{' '}
                                        <span className="font-bold text-green-500">${winnersPot.toFixed(2)}</span>
                                    </div>
                                </div>

                                <h4 className="text-sm font-bold text-textSecondary uppercase mb-2">Winners to Pay</h4>
                                <div className="space-y-2">
                                    {winners.length === 0 ? (
                                        <p className="text-sm text-textSecondary italic">No winners for this result.</p>
                                    ) : (
                                        winners.map((winner, idx) => {
                                            const share = winner.amount / totalWinningStake;
                                            const payoutAmount = share * winnersPot;

                                            return (
                                                <div key={idx} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-darkGray/50">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-black">
                                                            {winner.userId.substring(0, 2)}
                                                        </div>
                                                        <div className="truncate text-sm text-textPrimary font-mono">
                                                            {winner.userId}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <div className="font-bold text-green-500">
                                                                ${payoutAmount.toFixed(2)}
                                                            </div>
                                                            <div className="text-xs text-textSecondary">
                                                                USDC
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handlePayWinner(winner.userId, payoutAmount)}
                                                            className="bg-primary hover:bg-secondary text-black font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-1"
                                                        >
                                                            Pay <ExternalLink className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
