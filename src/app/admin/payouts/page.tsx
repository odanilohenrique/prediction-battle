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

    // Use Global Config
    const EXPECTED_CHAIN_ID = CURRENT_CONFIG.chainId;
    const IS_MAINNET = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
    const USDC_ADDRESS = CURRENT_CONFIG.usdcAddress;

    useEffect(() => {
        fetchPayouts();
    }, []);

    const fetchPayouts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/bets?status=resolved');
            const data = await res.json();
            if (data.success && data.bets) {
                // Debug logs
                console.log('Fetched bets:', data.bets);
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

        // Debug
        // console.log(`Checking fully paid for ${bet.id}:`, winners);

        return winners.every((w: any) => {
            const paid = w.paid || justPaid[`${bet.id}-${w.userId}`];
            //  if (!paid) console.log(`User ${w.userId} not paid in bet ${bet.id}`);
            return paid;
        });
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
                    showAlert('Wrong Network', `Please switch to ${CURRENT_CONFIG.chainName}.`, 'error');
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
                        const markRes = await fetch('/api/admin/payouts/mark-paid', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                betId: betId,
                                userId: userAddress,
                                txHash: hash
                            })
                        });

                        if (markRes.ok) {
                            setJustPaid(prev => ({ ...prev, [key]: true }));
                            // Optimistic update of local state to show "Paid" immediately
                            setPayouts(currentPayouts => currentPayouts.map(b => {
                                if (b.id === betId) {
                                    const winningOption = b.result;
                                    const winners = b.participants?.[winningOption] || [];
                                    const updatedWinners = winners.map((w: any) =>
                                        w.userId === userAddress ? { ...w, paid: true, txHash: hash } : w
                                    );
                                    return {
                                        ...b,
                                        participants: {
                                            ...b.participants,
                                            [winningOption]: updatedWinners
                                        }
                                    };
                                }
                                return b;
                            }));
                            showAlert('Success', 'Payment confirmed and recorded!', 'success');
                        } else {
                            const errText = await markRes.text();
                            console.error("Mark paid failed:", errText);
                            showAlert('Warning', "Tx sent but database update failed. Check console.", 'warning');
                        }

                    } catch (err) {
                        console.error(err);
                        showAlert('Warning', "Transaction sent but failed to update database. Please check manually.", 'warning');
                    }
                } catch (error) {
                    console.error('Payment tx failed:', error);
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

    const handleForceMarkPaid = async (betId: string, userAddress: string) => {
        const key = `${betId}-${userAddress}-force`;
        showConfirm('Force Mark Paid?', 'This will manually mark this user as PAID in the database without sending tokens. Use only if payment was already sent.', async () => {
            setProcessing(prev => ({ ...prev, [key]: true }));
            try {
                const txHash = 'MANUAL_SYNC_' + Date.now();
                const markRes = await fetch('/api/admin/payouts/mark-paid', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        betId: betId,
                        userId: userAddress,
                        txHash: txHash
                    })
                });

                if (markRes.ok) {
                    setJustPaid(prev => ({ ...prev, [`${betId}-${userAddress}`]: true }));
                    // Optimistic update
                    setPayouts(currentPayouts => currentPayouts.map(b => {
                        if (b.id === betId) {
                            const winningOption = b.result;
                            const winners = b.participants?.[winningOption] || [];
                            const updatedWinners = winners.map((w: any) =>
                                w.userId === userAddress ? { ...w, paid: true, txHash: txHash } : w
                            );
                            return {
                                ...b,
                                participants: {
                                    ...b.participants,
                                    [winningOption]: updatedWinners
                                }
                            };
                        }
                        return b;
                    }));
                    showAlert('Success', 'Marked as Paid manually.', 'success');
                } else {
                    throw new Error('Failed to update DB');
                }
            } catch (error) {
                console.error('Force mark paid failed:', error);
                showAlert('Error', (error as Error).message, 'error');
            } finally {
                setProcessing(prev => ({ ...prev, [key]: false }));
            }
        });
    };

    const handleForceResolve = async (bet: any) => {
        setResolvingContract(bet.id);
        const intendedResult = bet.result === 'yes';

        showConfirm('Fix Contract State?', `Force resolve contract as ${bet.result?.toUpperCase()}? Only do this if contract is stuck.`, async () => {
            try {
                if (chainId !== EXPECTED_CHAIN_ID) {
                    if (switchChainAsync) await switchChainAsync({ chainId: EXPECTED_CHAIN_ID });
                    else throw new Error("Switch network manually");
                }

                const hash = await writeContractAsync({
                    address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'resolveMarket',
                    args: [bet.id, intendedResult],
                });

                showAlert('Success', `Resolution Tx: ${hash}`, 'success');
            } catch (error) {
                console.error("Force resolve failed:", error);
                if ((error as Error).message.includes("already resolved")) {
                    showAlert("Info", "Contract already resolved. Try Batch Distribute.", "info");
                } else {
                    showAlert('Error', (error as Error).message, 'error');
                }
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
                                {/* Header matching Admin Dashboard */}
                                <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 gap-4">
                                    <div className="flex-1 space-y-3">
                                        {/* Top Row: User & Type & ID */}
                                        <div className="flex items-center flex-wrap gap-3">
                                            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                                <span className="font-bold text-white">@{bet.username}</span>
                                                <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{bet.type}</span>
                                            </div>
                                            <div className="text-xs text-white/30 font-mono bg-black/20 px-2 py-1 rounded">
                                                ID: {bet.id}
                                            </div>
                                            {isFullyPaid && (
                                                <span className="shrink-0 bg-green-500 text-black text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                                    <CheckCircle className="w-3 h-3" /> Paid Full
                                                </span>
                                            )}
                                        </div>

                                        {/* Middle Row: The Duel / Question */}
                                        <div className="flex items-center gap-4 bg-black/20 p-3 rounded-xl border border-white/5">
                                            {/* Player A */}
                                            <div className="flex items-center gap-2">
                                                {bet.optionA?.imageUrl ? (
                                                    <img src={bet.optionA.imageUrl} className="w-8 h-8 rounded-full border-2 border-green-500" />
                                                ) : <div className="w-8 h-8 bg-green-500/20 rounded-full border-2 border-green-500" />}
                                                <span className="text-sm font-bold text-green-500">{bet.optionA?.label || 'YES'}</span>
                                            </div>

                                            <span className="text-white/20 font-black italic">VS</span>

                                            {/* Player B */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-red-500">{bet.optionB?.label || 'NO'}</span>
                                                {bet.optionB?.imageUrl ? (
                                                    <img src={bet.optionB.imageUrl} className="w-8 h-8 rounded-full border-2 border-red-500" />
                                                ) : <div className="w-8 h-8 bg-red-500/20 rounded-full border-2 border-red-500" />}
                                            </div>
                                        </div>

                                        {/* Text Content */}
                                        <h3 className="text-lg font-bold text-white leading-tight">
                                            {bet.question || bet.castText || bet.targetName || `Prediction #${bet.id.substring(0, 8)}`}
                                        </h3>

                                        <div className="flex flex-wrap items-center gap-3 text-sm text-textSecondary">
                                            <span className="flex items-center gap-1">
                                                Result: <span className={`font-black px-2 py-0.5 rounded ${bet.result === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{bet.result?.toUpperCase()}</span>
                                            </span>
                                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                                            <span className="text-white font-bold text-lg">
                                                Pot: ${winnersPot.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col gap-2 min-w-[140px]">
                                        <button
                                            onClick={() => handleForceResolve(bet)}
                                            className="bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-500 text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors border border-yellow-700/30"
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
                                                            const res = await fetch('/api/admin/payouts/distribute', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ predictionId: bet.id })
                                                            });

                                                            // Handle non-ok responses
                                                            if (!res.ok) {
                                                                const errorText = await res.text();
                                                                console.error('API Error:', res.status, errorText);
                                                                throw new Error(errorText || `Server Error (${res.status})`);
                                                            }

                                                            const d = await res.json();
                                                            if (d.success) { showAlert('Success', d.message || `Tx: ${d.txHash}`, 'success'); fetchPayouts(); }
                                                            else throw new Error(d.error || 'Distribution failed');
                                                        } catch (e) {
                                                            showAlert('Failed', (e as Error).message, 'error');
                                                            if (btn) { btn.innerHTML = '⚡ Batch Distribute'; (btn as any).disabled = false; }
                                                        }
                                                    });
                                                }}
                                                id={`dist-btn-${bet.id}`}
                                                className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg shadow-purple-900/20"
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
                                            const isForceProcessing = processing[`${bet.id}-${winner.userId}-force`];
                                            const isPaid = winner.paid || justPaid[`${bet.id}-${winner.userId}`];

                                            if (activeTab === 'pending' && isPaid) return null;

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
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleForceMarkPaid(bet.id, winner.userId)}
                                                                    disabled={isForceProcessing || isProcessing}
                                                                    className="px-2 py-2 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                                                                    title="Force Mark as Paid (Internal DB only)"
                                                                >
                                                                    {isForceProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                                </button>
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
                                                            </div>
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
