'use client';

import { useState } from 'react';
import { X, Target, DollarSign, Users, Clock, ScrollText, Swords, AlertTriangle, Zap } from 'lucide-react';
import { useAccount, useWriteContract, useSwitchChain, usePublicClient } from 'wagmi';
import { parseUnits } from 'viem';
import { isAdmin } from '@/lib/config';
import ViralReceipt from './ViralReceipt';

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
    optionA?: { label: string; imageUrl?: string };
    optionB?: { label: string; imageUrl?: string };
    castHash?: string;
    castUrl?: string;
    castText?: string;
    wordToMatch?: string;
    creatorAddress?: string;
    creatorDisplayName?: string;
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
    const [amount, setAmount] = useState(bet.minBet);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Viral Receipt State
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

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
        const labels: Record<string, string> = {
            post_count: `post ${bet.target}+ times`,
            likes_total: `get ${bet.target}+ likes`,
            followers_gain: `gain ${bet.target}+ followers`,
            emoji_count: `use ${bet.target}+ emojis`,
            mentions: `get ${bet.target}+ mentions`,
            quotes: `get ${bet.target}+ quotes`,
            reply_marathon: `post ${bet.target}+ replies`,
            thread_length: `make a ${bet.target}+ post thread`,
            controversial: `hit ${bet.target}+ controversy score`,
            word_mentions: `say "${bet.wordToMatch || 'WORD'}" ${bet.target}+ times`,
            comment_count: `get ${bet.target}+ comments`,
            ratio: `get ratioed (replies > likes)`,
            custom_text: `${bet.castText || 'custom bet'}`,
        };
        return labels[bet.type] || `hit ${bet.target}`;
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
                // Calculate potential win for the receipt
                const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                const multiplier = choice === 'yes'
                    ? (yesPool === 0 ? 2.0 : 1 + (noPool * 0.8) / (yesPool + amount)) // Approximate simplified
                    : (noPool === 0 ? 2.0 : 1 + (yesPool * 0.8) / (noPool + amount));

                setReceiptData({
                    avatarUrl: bet.pfpUrl,
                    username: bet.username,
                    action: "JOINED BATTLE",
                    amount: amount,
                    potentialWin: amount * multiplier,
                    multiplier: parseFloat(multiplier.toFixed(2)),
                    choice: choice === 'yes' ? 'YES' : 'NO',
                    targetName: getBetTypeLabel()
                });

                setShowModal(false);
                setShowReceipt(true); // TRIGGER RECEIPT
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

    const handleSeedPool = async () => {
        if (!confirm('🌱 Seed Pool: This will place $5 on YES and $5 on NO using your wallet to create initial liquidity. Confirm?')) return;

        setIsSubmitting(true);
        try {
            // 1. Seed Logic: Simply place two bets sequentially
            // We'll treat this as two separate bet flows for simplicity, or we could batch if contract supported it.
            // For MVP, we will do two loops of the betting logic.

            const seedAmount = 5; // $5 USD
            const amountInWei = parseUnits(seedAmount.toString(), 6);

            // Function to execute one side of the seed
            const executeSeedSide = async (side: 'yes' | 'no') => {
                console.log(`Seeding ${side.toUpperCase()}...`);
                // Send USDC
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
                    args: [HOUSE_ADDRESS as `0x${string}`, amountInWei],
                    gas: BigInt(200000),
                });

                await publicClient!.waitForTransactionReceipt({ hash });

                // Register
                await fetch('/api/predictions/bet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        betId: bet.id,
                        choice: side,
                        amount: seedAmount,
                        txHash: hash,
                        userAddress: address
                    }),
                });
            };

            // Execute both sides
            await executeSeedSide('yes');
            await executeSeedSide('no');

            alert('✅ Pool Seeded Successfully! Liquidity injected.');
            onBet(); // Refresh

        } catch (error) {
            console.error('Seeding failed:', error);
            alert(`Seed Failed: ${(error as Error).message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="glass-card rounded-3xl p-0 overflow-hidden group hover:neon-border transition-all duration-300">
                {/* Header Ticket Stub */}
                <div className="bg-white/5 border-b border-white/5 p-4 flex justify-between items-center bg-[url('/noise.png')]">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${bet.status === 'active' && Date.now() < bet.expiresAt ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-xs font-mono text-white/60 tracking-widest uppercase">
                                {bet.status !== 'active' ? 'RESOLVED' : Date.now() >= bet.expiresAt ? 'EXPIRED' : 'LIVE BATTLE'}
                            </span>
                        </div>
                        {/* Creator Badge */}
                        {bet.creatorAddress && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-white/40">created by:</span>
                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${isAdmin(bet.creatorAddress)
                                    ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    }`}>
                                    {isAdmin(bet.creatorAddress) ? (
                                        <>
                                            <span>🛡️</span>
                                            <span>ADMIN</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>👤</span>
                                            <span>
                                                {bet.creatorDisplayName ||
                                                    `${bet.creatorAddress.slice(0, 6)}...${bet.creatorAddress.slice(-4)}`}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono text-primary">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeRemaining()}</span>
                    </div>
                </div>

                <div className="p-6">
                    {/* BATTLE MODE: Two Fighters Layout */}
                    {bet.optionA?.label && bet.optionB?.label ? (
                        <>
                            {/* Volume & Fighters - Top Right */}
                            <div className="flex justify-between items-start mb-4 relative min-h-[40px]">
                                <div className="flex-1 text-center px-4">
                                    <h3 className="text-xl font-black text-white italic leading-tight drop-shadow-lg">
                                        {bet.castText || getBetTypeLabel()}
                                    </h3>
                                </div>
                                <div className="absolute right-0 top-0 text-right">
                                    <div className="text-2xl font-black text-white flex items-center justify-end gap-1">
                                        <span className="text-primary">$</span>
                                        {bet.totalPot.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-white/40 flex items-center justify-end gap-1">
                                        <Users className="w-3 h-3" /> {bet.participantCount} Predictors
                                    </div>
                                </div>
                            </div>

                            {/* Two Predictors Face-Off */}
                            <div className="flex items-center justify-center gap-4 mb-6">
                                {/* Player A */}
                                <div className="flex flex-col items-center">
                                    <a href={`https://warpcast.com/${bet.optionA.label}`} target="_blank" rel="noreferrer" className="group/player">
                                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden border-3 border-green-500/50 group-hover/player:border-green-500 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                                            {bet.optionA.imageUrl ? (
                                                <img src={bet.optionA.imageUrl} alt={bet.optionA.label} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = 'https://link.warpcast.com/api/avatar/default.png')} />
                                            ) : (
                                                <div className="w-full h-full bg-green-500/20 flex items-center justify-center text-green-500 text-3xl font-black">
                                                    {bet.optionA.label.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2 text-center">
                                            <div className="text-lg md:text-xl font-black text-green-500 group-hover/player:text-green-400 transition-colors">
                                                {bet.optionA.label}
                                            </div>
                                        </div>
                                    </a>
                                </div>

                                {/* VS */}
                                <div className="text-4xl md:text-5xl font-black text-white/20 italic px-2">
                                    VS
                                </div>

                                {/* Player B */}
                                <div className="flex flex-col items-center">
                                    <a href={`https://warpcast.com/${bet.optionB.label}`} target="_blank" rel="noreferrer" className="group/player">
                                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden border-3 border-red-500/50 group-hover/player:border-red-500 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                                            {bet.optionB.imageUrl ? (
                                                <img src={bet.optionB.imageUrl} alt={bet.optionB.label} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = 'https://link.warpcast.com/api/avatar/default.png')} />
                                            ) : (
                                                <div className="w-full h-full bg-red-500/20 flex items-center justify-center text-red-500 text-3xl font-black">
                                                    {bet.optionB.label.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2 text-center">
                                            <div className="text-lg md:text-xl font-black text-red-500 group-hover/player:text-red-400 transition-colors">
                                                {bet.optionB.label}
                                            </div>
                                        </div>
                                    </a>
                                </div>
                            </div>

                            {/* Rules Button */}
                            <div className="flex justify-center mb-4">
                                <button onClick={() => setShowRulesModal(true)} className="text-xs text-white/40 hover:text-white transition-colors">
                                    ? Rules
                                </button>
                            </div>
                        </>
                    ) : (
                        /* PREDICTION MODE: Single Player Layout */
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                {bet.pfpUrl ? (
                                    <div className="relative">
                                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden border-2 border-primary/30 group-hover:border-primary transition-colors">
                                            <img src={bet.pfpUrl} alt={bet.username} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-primary text-black text-xs font-black px-2 py-0.5 rounded shadow-lg">
                                            OP
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl bg-primary/20 flex items-center justify-center border-2 border-primary/30">
                                        <Swords className="w-12 h-12 text-primary" />
                                    </div>
                                )}

                                {/* Prediction Info */}
                                <div>
                                    <h3 className="text-2xl md:text-3xl font-black text-white leading-none mb-1">
                                        <a href={`https://warpcast.com/${bet.username}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors hover:underline">
                                            @{bet.username}
                                        </a>
                                    </h3>
                                    <div className="text-sm font-bold text-white/80 flex items-center gap-2">
                                        <span className="text-primary">VS</span>
                                        <span>{getBetTypeLabel()}</span>
                                    </div>
                                    {/* POST LINK - Prominent */}
                                    {(bet.castUrl && bet.castUrl.length > 10) && (
                                        <a href={bet.castUrl}
                                            target="_blank" rel="noreferrer"
                                            className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary/30 to-orange-500/30 text-primary border border-primary/50 text-sm font-bold hover:from-primary/40 hover:to-orange-500/40 transition-all shadow-[0_0_15px_rgba(255,95,31,0.4)] hover:shadow-[0_0_25px_rgba(255,95,31,0.6)] transform hover:scale-105">
                                            🔗 View Target Post
                                        </a>
                                    )}
                                    <div className="mt-2">
                                        <button onClick={() => setShowRulesModal(true)} className="text-xs text-white/40 hover:text-white transition-colors">
                                            ? Rules
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Pool Stats */}
                            <div className="text-right">
                                <div className="text-xs text-white/40 uppercase tracking-widest mb-1">Total Volume</div>
                                <div className="text-2xl font-black text-white flex items-center justify-end gap-1">
                                    <span className="text-primary">$</span>
                                    {bet.totalPot.toFixed(2)}
                                </div>
                                <div className="text-xs text-white/40 flex items-center justify-end gap-1 mt-1">
                                    <Users className="w-3 h-3" /> {bet.participantCount} Predictors
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tug of War Bar */}
                    <div className="mb-6">
                        <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
                            <span className="text-green-500">
                                {bet.optionA?.label || 'YES'} {Math.round(yesPercent)}%
                            </span>
                            <span className="text-red-500">
                                {Math.round(noPercent)}% {bet.optionB?.label || 'NO'}
                            </span>
                        </div>
                        <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
                            {/* Glowing Center Line */}
                            <div className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_white] z-10 transition-all duration-500"
                                style={{ left: `${yesPercent}%` }} />

                            <div className="absolute inset-0 flex">
                                <div style={{ width: `${yesPercent}%` }} className="bg-gradient-to-r from-green-500/40 to-green-500/20 h-full transition-all duration-500" />
                                <div style={{ width: `${noPercent}%` }} className="bg-gradient-to-l from-red-500/40 to-red-500/20 h-full transition-all duration-500" />
                            </div>
                        </div>
                        <div className="flex justify-between mt-2 text-xs font-mono text-white/60">
                            <span>MULT: <span className="text-green-400">
                                {(() => {
                                    const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                                    const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                                    if (yesPool === 0) return '1.00';
                                    const multiplier = 1 + (noPool * 0.8) / yesPool;
                                    return multiplier.toFixed(2);
                                })()}x
                            </span></span>
                            <span>MULT: <span className="text-red-400">
                                {(() => {
                                    const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                                    const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                                    if (noPool === 0) return '1.00';
                                    const multiplier = 1 + (yesPool * 0.8) / noPool;
                                    return multiplier.toFixed(2);
                                })()}x
                            </span></span>
                        </div>
                    </div>

                    {/* Action Area */}
                    <div className="flex gap-3">
                        {/* Seed button only for admin on empty pools */}
                        {address && isAdmin(address) && bet.totalPot === 0 && bet.status === 'active' && Date.now() < bet.expiresAt && (
                            <button
                                onClick={handleSeedPool}
                                disabled={isSubmitting}
                                className="px-4 py-3 rounded-xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-bold hover:bg-yellow-500/20 transition-all"
                            >
                                🌱 Seed
                            </button>
                        )}

                        {bet.status !== 'active' || Date.now() >= bet.expiresAt ? (
                            <button
                                disabled
                                className="w-full bg-red-500/10 text-red-500 font-black py-4 rounded-xl cursor-not-allowed border border-red-500/20 uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <span>🚫</span>
                                {bet.status !== 'active' ? 'BATTLE RESOLVED' : 'BATTLE EXPIRED'}
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowModal(true)}
                                className="w-full bg-primary hover:bg-white hover:text-black text-black font-black py-3 rounded-xl transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(255,95,31,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                JOIN BATTLE
                            </button>
                        )}
                    </div>
                </div>
            </div>


            {/* Battle Station Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-0 md:p-4">
                        <div className="bg-[#0a0a0a] border-0 md:border md:border-white/10 rounded-none md:rounded-3xl w-full h-[100dvh] md:h-auto md:max-h-[90dvh] md:max-w-md shadow-2xl relative flex flex-col">
                            {/* Top Accent */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-white to-primary opacity-50"></div>

                            <div className="px-6 py-6 border-b border-white/5 flex items-center justify-between">
                                <h2 className="text-xl font-black text-white italic uppercase tracking-wider">
                                    Battle Station
                                </h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                                >
                                    <X className="w-5 h-5 text-white/60" />
                                </button>
                            </div>

                            <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto max-h-[calc(90dvh-80px)]">

                                {/* Stylized Header for Battle Mode */}
                                {bet.optionA && bet.optionB ? (
                                    <div className="bg-gradient-to-br from-black/60 to-black/20 rounded-2xl p-4 border border-white/10 text-center relative overflow-hidden">
                                        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20"></div>
                                        <div className="relative z-10 flex items-center justify-center gap-6">
                                            {/* Player 1 */}
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-16 h-16 md:w-16 md:h-16 rounded-xl overflow-hidden border-2 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                                                    {bet.optionA.imageUrl ? <img src={bet.optionA.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-green-500/20" />}
                                                </div>
                                                <div className="text-xs md:text-sm font-black text-green-500">{bet.optionA.label}</div>
                                            </div>

                                            <div className="text-4xl font-black italic text-white/20">VS</div>

                                            {/* Player 2 */}
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-16 h-16 md:w-16 md:h-16 rounded-xl overflow-hidden border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                                                    {bet.optionB.imageUrl ? <img src={bet.optionB.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-red-500/20" />}
                                                </div>
                                                <div className="text-xs md:text-sm font-black text-red-500">{bet.optionB.label}</div>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-white/5">
                                            <div className="text-white text-lg font-bold leading-tight">
                                                "{bet.castText || bet.type}"
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Standard Prediction Header */
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                        <div className="text-xs text-primary font-bold uppercase tracking-widest mb-1">Mission Objective</div>
                                        <p className="text-white text-lg leading-tight">
                                            Will <span className="font-bold">@{bet.username}</span> {getBetTypeLabel()}
                                            {(bet.castUrl || bet.castHash) && (
                                                <> in <a
                                                    href={bet.castUrl || `https://warpcast.com/${bet.username}/${bet.castHash}`}
                                                    target="_blank" rel="noreferrer"
                                                    className="text-primary underline hover:text-white transition-colors"
                                                >this post</a>
                                                </>
                                            )}?
                                        </p>
                                        <div className="text-xs text-white/40 mt-1">Deadline: {bet.timeframe}</div>
                                    </div>
                                )}

                                {/* Choice Selection */}
                                <div>
                                    <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-3">
                                        Choose Position
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setChoice('yes')}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden ${choice === 'yes'
                                                ? 'border-green-500 bg-green-500/10'
                                                : 'border-white/10 bg-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            {bet.optionA?.imageUrl && (
                                                <img src={bet.optionA.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                                            )}
                                            <div className="text-2xl font-black text-green-500">
                                                {bet.optionA?.label || 'YES'}
                                            </div>
                                            {choice === 'yes' && <div className="absolute inset-0 bg-green-500/5 animate-pulse" />}
                                        </button>
                                        <button
                                            onClick={() => setChoice('no')}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden ${choice === 'no'
                                                ? 'border-red-500 bg-red-500/10'
                                                : 'border-white/10 bg-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            {bet.optionB?.imageUrl && (
                                                <img src={bet.optionB.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                                            )}
                                            <div className="text-2xl font-black text-red-500">
                                                {bet.optionB?.label || 'NO'}
                                            </div>
                                            {choice === 'no' && <div className="absolute inset-0 bg-red-500/5 animate-pulse" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Amount Selection - Flexible Input */}
                                <div>
                                    <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-3">
                                        Entry Size (USDC)
                                    </label>
                                    <div className="space-y-3">
                                        {/* Slider */}
                                        <input
                                            type="range"
                                            min={bet.minBet}
                                            max={bet.maxBet}
                                            step={0.01}
                                            value={amount}
                                            onChange={(e) => setAmount(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        {/* Input + Quick Buttons */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
                                                <input
                                                    type="number"
                                                    min={bet.minBet}
                                                    max={bet.maxBet}
                                                    step={0.01}
                                                    value={amount}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (val >= bet.minBet && val <= bet.maxBet) {
                                                            setAmount(val);
                                                        }
                                                    }}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white font-bold text-lg focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                            {/* Quick Select Buttons */}
                                            <button
                                                type="button"
                                                onClick={() => setAmount(bet.minBet)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold border ${amount === bet.minBet ? 'border-primary bg-primary/20 text-primary' : 'border-white/10 text-white/60 hover:border-white/30'}`}
                                            >
                                                MIN
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAmount(bet.maxBet)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold border ${amount === bet.maxBet ? 'border-primary bg-primary/20 text-primary' : 'border-white/10 text-white/60 hover:border-white/30'}`}
                                            >
                                                MAX
                                            </button>
                                        </div>
                                        <p className="text-xs text-white/40 text-center">
                                            Range: ${bet.minBet.toFixed(2)} - ${bet.maxBet.toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                {/* Summary & Multiplier */}
                                <div className="bg-black rounded-xl p-4 border border-white/10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-20">
                                        <Zap className="w-12 h-12 text-white" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="text-xs text-white/60 mb-1">Potential Payout</div>
                                        <div className="text-3xl font-black text-white flex items-end gap-2">
                                            ${(() => {
                                                const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                                                const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                                                const multiplier = choice === 'yes'
                                                    ? (yesPool === 0 ? 2.0 : 1 + (noPool * 0.8) / yesPool)
                                                    : (noPool === 0 ? 2.0 : 1 + (yesPool * 0.8) / noPool);
                                                return (amount * multiplier).toFixed(2);
                                            })()}
                                            <span className="text-sm font-bold text-primary mb-1.5">
                                                ({(() => {
                                                    const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                                                    const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                                                    const multiplier = choice === 'yes'
                                                        ? (yesPool === 0 ? 2.0 : 1 + (noPool * 0.8) / yesPool)
                                                        : (noPool === 0 ? 2.0 : 1 + (yesPool * 0.8) / noPool);
                                                    return multiplier.toFixed(2);
                                                })()}x)
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="w-full bg-primary hover:bg-white hover:text-black text-black font-black py-4 rounded-xl transition-all uppercase tracking-widest text-lg shadow-[0_0_20px_rgba(255,95,31,0.4)] hover:shadow-[0_0_30px_rgba(255,255,255,0.6)] animate-pulse-fast disabled:opacity-50 disabled:animate-none"
                                >
                                    {isSubmitting ? 'INITIATING...' : 'CONFIRM ENTRY'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Viral Receipt Integration */}
            <ViralReceipt
                isOpen={showReceipt}
                onClose={() => setShowReceipt(false)}
                data={receiptData || { username: '', amount: 0, potentialWin: 0, multiplier: 0, choice: 'YES', targetName: '' }}
            />

            {/* Rules Modal */}
            {
                showRulesModal && (
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
                )
            }
        </>
    );
}
