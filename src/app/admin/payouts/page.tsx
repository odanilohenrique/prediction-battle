'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';
import { TrendingUp, Wallet, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useModal } from '@/providers/ModalProvider';

// ... (keep surrounding code)

export default function PayoutsPage() {
    const { showModal, showAlert, showConfirm } = useModal();
    const [payouts, setPayouts] = useState<Bet[]>([]);
    // ...

    // ... (logic)

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
            // 0. Verify and Switch Chain
            if (chainId !== EXPECTED_CHAIN_ID) {
                try {
                    // ... (switch logic)
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
                        // ... (contract logic)
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
                        gas: BigInt(200000),
                    });

                    console.log(`Transaction Sent! Hash: ${hash}`);

                    // Mark as paid in backend
                    try {
                        await fetch('/api/admin/payouts/mark-paid', {
                            // ...
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                betId: betId,
                                userId: userAddress,
                                txHash: hash
                            })
                        });

                        setJustPaid(prev => ({ ...prev, [key]: true }));
                        fetchPayouts(); // Background refresh

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

    // ... (render)

    // Inside render loop for payouts
    // ...
    {/* Smart Contract Distribution Button */ }
    <button
        onClick={async () => {
            showConfirm('Run Distribution?', `Run Auto-Distribution for ${bet.id} via Smart Contract? (Ensures ETH payouts)`, async () => {
                // Optimistic UI for button
                const btn = document.getElementById(`dist-btn-${bet.id}`);
                if (btn) { btn.innerHTML = 'Processing...'; (btn as any).disabled = true; }

                try {
                    const res = await fetch('/api/admin/payouts/distribute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ predictionId: bet.id })
                    });
                    const d = await res.json();
                    if (d.success) {
                        showAlert('Distribution Complete', `Tx: ${d.txHash}`, 'success');
                        fetchPayouts(); // Refresh
                    } else {
                        throw new Error(d.error);
                    }
                } catch (e) {
                    showAlert('Distribution Failed', (e as Error).message, 'error');
                    if (btn) { btn.innerHTML = '⚡ Distribute (Contract)'; (btn as any).disabled = false; }
                }
            });
        }}
        // ...
        id={`dist-btn-${bet.id}`}
        className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1 rounded-lg flex items-center gap-1 transition-colors"
    >
        ⚡ Distribute (Contract)
    </button>
                                </div >
        <div className="space-y-2">
            {winners.filter(w => !w.paid && w.userId !== 'demo_user' && !justPaid[`${bet.id}-${w.userId}`]).length === 0 ? (
                <p className="text-sm text-textSecondary italic">All eligible winners paid.</p>
            ) : (
                winners.filter(w => !w.paid && w.userId !== 'demo_user' && !justPaid[`${bet.id}-${w.userId}`]).map((winner, idx) => {
                    const share = winner.amount / totalWinningStake;
                    const payoutAmount = share * winnersPot;
                    const isProcessing = processing[`${bet.id}-${winner.userId}`];

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
                                    onClick={() => handlePayWinner(bet.id, winner.userId, payoutAmount)}
                                    disabled={isProcessing}
                                    className={`
                                                                font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-1
                                                                ${isProcessing
                                            ? 'bg-darkGray text-textSecondary cursor-not-allowed'
                                            : 'bg-primary hover:bg-secondary text-black'}
                                                            `}
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            Pay <ExternalLink className="w-3 h-3" />
                                        </>
                                    )}
                                </button>
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
