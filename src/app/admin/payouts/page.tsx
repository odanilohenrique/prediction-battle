'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useSwitchChain, usePublicClient } from 'wagmi';
import { parseUnits } from 'viem';
import { TrendingUp, Wallet, CheckCircle, ExternalLink, Loader2, AlertCircle, Clock } from 'lucide-react';
import { useModal } from '@/providers/ModalProvider';

import { CURRENT_CONFIG } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';

export default function PayoutsPage() {
    const { showModal, showAlert, showConfirm } = useModal();
    const { address, chainId } = useAccount();
    const { switchChainAsync } = useSwitchChain();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const [payouts, setPayouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<Record<string, boolean>>({});
    const [justPaid, setJustPaid] = useState<Record<string, boolean>>({});
    const [resolvingContract, setResolvingContract] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');

    const EXPECTED_CHAIN_ID = 8453;
    const IS_MAINNET = true;
    const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC

    useEffect(() => {
        fetchPayouts();
    }, []);

    const fetchPayouts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/bets?status=resolved');
            const data = await res.json();
            if (data.success && data.bets) {
                setPayouts(data.bets);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Helper to determine if a bet is "fully paid"
    const isBetFullyPaid = (bet: any) => {
        const winningOption = bet.result;
        const winners = bet.participants?.[winningOption as 'yes' | 'no'] || [];
        if (winners.length === 0) return true; // No winners = technically settled
        return winners.every((w: any) => w.paid || justPaid[`${bet.id}-${w.userId}`]);
    };

    // Filtered Lists
    const pendingBets = payouts.filter(b => !isBetFullyPaid(b));
    const paidBets = payouts.filter(b => isBetFullyPaid(b));

    const displayedBets = activeTab === 'pending' ? pendingBets : paidBets;

    async function handleSync() {
        showConfirm('Run Sync?', 'Run automated checker to find expired bets?', async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/check', { method: 'POST' });
                const data = await res.json();
                showAlert('Sync Complete', `Checked ${data.checked} bets.`, 'success');
                fetchPayouts();
            } catch (error) {
                console.error('Sync failed:', error);
                showAlert('Error', 'Failed to sync payouts', 'error');
                setLoading(false);
            }
        });
    }

    const handlePayWinner = async (betId: string, userAddress: string, amount: number) => {
        const key = `${betId}-${userAddress}`;
        if (processing[key]) return;

        if (!userAddress || userAddress === 'demo_user') {
            showAlert('Invalid Address', 'Cannot pay demo user or invalid address.', 'error');
            return;
        }

        try {
            if (chainId !== EXPECTED_CHAIN_ID) {
                try {
                    if (switchChainAsync) {
                        await switchChainAsync({ chainId: EXPECTED_CHAIN_ID });
                    } else {
                        throw new Error("Troca de rede não suportada pela carteira.");
                    }
                } catch (switchError) {
                    showAlert('Wrong Network', `Please switch to ${IS_MAINNET ? 'Base Mainnet' : 'Base Sepolia'}.`, 'error');
                    return;
                }
            }

            showConfirm('Confirm Payment', `Send ${amount.toFixed(2)} USDC to ${userAddress}?`, async () => {
                setProcessing(prev => ({ ...prev, [key]: true }));
                try {
                    const amountInWei = parseUnits(amount.toString(), 6);
                    const hash = await writeContractAsync({
                        address: USDC_ADDRESS as `0x${string}`,
                        abi: [{
                            name: 'transfer',
                            type: 'function',
                            stateMutability: 'nonpayable',
                            inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
                            outputs: [{ name: '', type: 'bool' }]
                        }],
                        functionName: 'transfer',
                        args: [userAddress as `0x${string}`, amountInWei],
                        gas: BigInt(200000),
                    });

                    console.log(`Transaction Sent! Hash: ${hash}`);

                    try {
                        await fetch('/api/admin/payouts/mark-paid', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                betId: betId,
                                userId: userAddress,
                                txHash: hash
                            })
                        });

                        setJustPaid(prev => ({ ...prev, [key]: true }));
                        fetchPayouts();

                    } catch (err) {
                        showAlert('Warning', "Transaction sent but failed to update database. Please check manually.", 'warning');
                    }

                } catch (error) {
                    showAlert('Payment Failed', (error as Error).message, 'error');
                } finally {
                    setProcessing(prev => ({ ...prev, [key]: false }));
                }
            });

        } catch (error) {
            console.error('Payment failed:', error);
            showAlert('Error', (error as Error).message, 'error');
        }
    };

    const handleForceResolve = async (bet: any) => {
        if (!CURRENT_CONFIG.contractAddress || !publicClient) {
            showAlert('Config Error', 'No contract or public client available.', 'error');
            return;
        }

        showConfirm('Force Resolve?', `Force update contract status to "${bet.result?.toUpperCase()}"? This will CREATE the prediction on-chain if missing, then RESOLVE it.`, async () => {
            setResolvingContract(bet.id);
            try {
                const exists = await publicClient.readContract({
                    address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'predictionExists',
                    args: [bet.id]
                });

                if (!exists) {
                    console.log('Prediction missing on-chain. Creating now...', bet.id);
                    showAlert('Syncing', 'Prediction missing on contract. Creating...', 'info');

                    const durationMap: Record<string, number> = {
                        '30m': 1800, '6h': 21600, '12h': 43200, '24h': 86400, '7d': 604800
                    };
                    const duration = durationMap[bet.timeframe] || 86400;

                    const createHash = await writeContractAsync({
                        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                        abi: PredictionBattleABI.abi,
                        functionName: 'createPrediction',
                        args: [bet.id, BigInt(bet.target || 0), BigInt(duration)]
                    });

                    console.log('Create Tx Sent:', createHash);
                    showAlert('Creating', 'Creation Tx Sent. Waiting for confirmation...', 'info');
                    await publicClient.waitForTransactionReceipt({ hash: createHash });
                }

                const hash = await writeContractAsync({
                    address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'resolvePrediction',
                    args: [bet.id, bet.result === 'yes']
                });

                showAlert('Success', `Resolve Tx Sent. Hash: ${hash}`, 'success');
            } catch (e) {
                console.error(e);
                showAlert('Error', (e as Error).message, 'error');
            } finally {
                setResolvingContract(null);
            }
        });
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Wallet className="w-6 h-6 text-primary" />
                    Payout Management
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleSync}
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                    >
                        <TrendingUp className="w-4 h-4" />
                        Sync Expired
                    </button>
                    {/* Manual Cleanup Trigger (Admin) */}
                    <button
                        onClick={async () => {
                            showConfirm('CLEANUP?', 'Delete all bets except the newest one? CANNOT BE UNDONE.', async () => {
                                fetch('/api/admin/cleanup', { method: 'POST' })
                                    .then(r => r.json())
                                    .then(d => {
                                        showAlert(d.success ? 'Cleanup Done' : 'Error', d.message || `Deleted ${d.deletedCount}`, d.success ? 'success' : 'error');
                                        fetchPayouts();
                                    });
                            });
                        }}
                        className="bg-red-900/50 hover:bg-red-800 text-red-200 px-3 py-2 rounded-lg text-sm font-bold transition-all border border-red-800"
                    >
                        Cleanup DB
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-surface border border-white/5 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'pending'
                            ? 'bg-primary text-black shadow-lg'
                            : 'text-textSecondary hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Clock className="w-4 h-4" />
                    Pending ({pendingBets.length})
                </button>
                <button
                    onClick={() => setActiveTab('paid')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'paid'
                            ? 'bg-green-500 text-black shadow-lg'
                            : 'text-textSecondary hover:text-white hover:bg-white/5'
                        }`}
                >
                    <CheckCircle className="w-4 h-4" />
                    Paid ({paidBets.length})
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            ) : (
                <div className="grid gap-6">
                    {displayedBets.length === 0 && (
                        <div className="text-center py-12 text-textSecondary bg-surface border border-white/5 rounded-xl">
                            <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No {activeTab} payouts found.</p>
                        </div>
                    )}

                    {displayedBets.map(bet => {
                        const winningOption = bet.result;
                        const winners = bet.participants?.[winningOption as 'yes' | 'no'] || [];
                        const totalWinningStake = winners.reduce((acc: number, p: any) => acc + p.amount, 0);
                        const totalLosingStake = bet.participants?.[winningOption === 'yes' ? 'no' : 'yes']?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                        const winnersPot = totalWinningStake + totalLosingStake;
                        const isFullyPaid = isBetFullyPaid(bet);

                        return (
                            <div key={bet.id} className={`bg-surface border rounded-xl p-6 transition-colors ${isFullyPaid ? 'border-green-500/20 bg-green-900/5' : 'border-white/5'}`}>
                                <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-3">
                                            <h3 className="text-xl font-bold text-white leading-tight">
                                                {bet.question || bet.targetName || bet.id}
                                            </h3>
                                            {isFullyPaid && (
                                                <span className="shrink-0 bg-green-500 text-black text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> Paid
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-textSecondary">
                                            <span className="bg-white/5 px-2 py-1 rounded">
                                                ID: <span className="font-mono">{bet.id.substring(0, 8)}...</span>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                Result: <span className={bet.result === 'yes' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{bet.result?.toUpperCase()}</span>
                                            </span>
                                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                                            <span className="text-white font-bold">
                                                Pot: ${winnersPot.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap gap-2 justify-end">
                                        <button
                                            onClick={() => handleForceResolve(bet)}
                                            className="bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-500 text-xs px-3 py-2 rounded-lg flex items-center gap-2 transition-colors border border-yellow-700/30"
                                        >
                                            {resolvingContract === bet.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '⚠️ Fix Contract'}
                                        </button>

                                        {!isFullyPaid && (
                                            <button
                                                onClick={async () => {
                                                    showConfirm('Process Batch?', `Run Auto-Distribution for ${bet.id}?`, async () => {
                                                        const btn = document.getElementById(`dist-btn-${bet.id}`);
                                                        if (btn) { btn.innerHTML = 'Processing...'; (btn as any).disabled = true; }
                                                        try {
                                                            const res = await fetch('/api/admin/payouts/distribute', { method: 'POST', body: JSON.stringify({ predictionId: bet.id }) });
                                                            const d = await res.json();
                                                            if (d.success) { showAlert('Success', `Tx: ${d.txHash}`, 'success'); fetchPayouts(); }
                                                            else throw new Error(d.error);
                                                        } catch (e) {
                                                            showAlert('Failed', (e as Error).message, 'error');
                                                            if (btn) { btn.innerHTML = '⚡ Distributed'; (btn as any).disabled = false; }
                                                        }
                                                    });
                                                }}
                                                id={`dist-btn-${bet.id}`}
                                                className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-purple-900/20"
                                            >
                                                ⚡ Batch Distribute
                                            </button>
                                        )}
                                    </div>
                                </div >

                                <div className="space-y-2 bg-black/20 rounded-xl p-2 md:p-4">
                                    <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-2 ml-1">Winners ({winners.length})</h4>

                                    {winners.length === 0 ? (
                                        <p className="text-sm text-textSecondary italic p-2">No winners to pay.</p>
                                    ) : (
                                        winners.map((winner: any, idx: number) => {
                                            const share = winner.amount / totalWinningStake;
                                            const payoutAmount = share * winnersPot;
                                            const isProcessing = processing[`${bet.id}-${winner.userId}`];
                                            const isPaid = winner.paid || justPaid[`${bet.id}-${winner.userId}`];

                                            if (activeTab === 'pending' && isPaid) return null; // Hide paid in pending tab if desired, or show as disabled? 
                                            // Requirements: "Se ainda falta pagar tem que ter um 'pagar' bem evidente"
                                            // Let's show all, but style them clearly.

                                            // Actually user said: "Se foi paga tem que ter um 'pago'..."
                                            // "Dentro de payout, crie um setor de 'pagas' e 'pagar'"
                                            // Filtering list by 'activeTab' covers the sector part.
                                            // If I am in Pending tab, I probably only want to see pending people or at least pending status.

                                            return (
                                                <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isPaid ? 'bg-green-900/5 border-green-500/10 opacity-70' : 'bg-surface border-white/5'}`}>
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isPaid ? 'bg-green-900 text-green-300' : 'bg-gradient-to-br from-primary to-secondary text-black'}`}>
                                                            {winner.userId.substring(0, 2)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-mono text-white truncate max-w-[120px] md:max-w-xs">{winner.userId}</div>
                                                            {isPaid && <div className="text-[10px] text-green-400 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> PAID</div>}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <div className={`font-bold ${isPaid ? 'text-green-600' : 'text-green-400'}`}>${payoutAmount.toFixed(2)}</div>
                                                            <div className="text-[10px] text-textSecondary">USDC</div>
                                                        </div>

                                                        {isPaid ? (
                                                            <button disabled className="px-4 py-2 rounded-lg text-xs font-bold bg-white/5 text-textSecondary border border-white/5 cursor-not-allowed flex items-center gap-1">
                                                                Paid <CheckCircle className="w-3 h-3" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handlePayWinner(bet.id, winner.userId, payoutAmount)}
                                                                disabled={isProcessing}
                                                                className={`
                                                                    font-bold px-4 py-2 rounded-lg text-xs transition-all flex items-center gap-2 shadow-lg
                                                                    ${isProcessing ? 'bg-darkGray text-textSecondary' : 'bg-primary hover:bg-secondary text-black shadow-primary/20'}
                                                                `}
                                                            >
                                                                {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'PAY NOW'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div >
                        );
                    })}
                </div >
            )}
        </div >
    );
}
