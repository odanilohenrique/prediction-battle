'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ClaimButton from './ClaimButton';
import { X, Target, DollarSign, Users, Clock, ScrollText, Swords, AlertTriangle, Zap, Trash2, ExternalLink, Coins, Shield } from 'lucide-react';
import { useAccount, useWriteContract, useSwitchChain, usePublicClient, useConnect, useReadContract } from 'wagmi';
import { parseUnits, parseEther, formatUnits } from 'viem';
import { isAdmin, CURRENT_CONFIG } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';
import ViralReceipt from './ViralReceipt';
import VerificationModal from './VerificationModal';

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
    optionA?: { label: string; imageUrl?: string; referenceUrl?: string };
    optionB?: { label: string; imageUrl?: string; referenceUrl?: string };
    castHash?: string;
    castUrl?: string;
    castText?: string;
    wordToMatch?: string;
    creatorAddress?: string;
    creatorDisplayName?: string;
    status?: string;
    result?: string; // yes | no
    question?: string; // V2 market question
    // Automated Verification Metadata
    verification?: {
        enabled: boolean;
        type: 'likes' | 'recasts' | 'replies' | 'followers' | 'keyword';
        target: number | string; // e.g. 1000 or "build"
        url?: string; // Link to the specific cast to verify (for engagement bets)
        username?: string; // User to verify (for follower/keyword bets)
        wordToMatch?: string; // If keyword type
    };
    initialValue?: number;
}

interface AdminBetCardProps {
    bet: AdminBet;
    onBet: () => void;
}

const BET_AMOUNTS = [0.05, 0.1, 0.5, 1];

import { useModal } from '@/providers/ModalProvider';
// Remove import Modal from ... (will handle in next edit if strictly separate)

export default function AdminBetCard({ bet, onBet }: AdminBetCardProps) {
    const { showModal, showConfirm, showAlert, closeModal } = useModal();
    const router = useRouter();
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [isBattleModalOpen, setIsBattleModalOpen] = useState(false);
    const [choice, setChoice] = useState<'yes' | 'no'>('yes');
    const [amount, setAmount] = useState<string>(bet.minBet.toString());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Viral Receipt State
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    // V3: Verification Modal State
    const [showVerificationModal, setShowVerificationModal] = useState(false);

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
    const { connectors, connect } = useConnect();
    const publicClient = usePublicClient();

    // Claim Check Logic
    const winningSide = bet.result === 'yes'; // true for yes, false for no

    // 1. Get User Shares
    const { data: userBetInfo, refetch: refetchUserBet } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'getUserBet',
        args: [
            bet.id,
            address || '0x0000000000000000000000000000000000000000',
            winningSide // Check the winning side
        ],
        query: {
            enabled: !!address && bet.status !== 'active' && (bet.result === 'yes' || bet.result === 'no'),
        }
    }) as { data: [bigint, bigint, string, boolean] | undefined, refetch: () => void };

    // Contract returns: (amount, shares, referrer, claimed)
    const [originalBetAmount, userShares, , hasClaimed] = userBetInfo || [BigInt(0), BigInt(0), '', false];

    // 2. Get Market Info for Total Shares (needed for payout calc)
    const { data: marketInfo } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'getMarketInfo',
        args: [bet.id],
        query: {
            enabled: !!address && bet.status !== 'active' && userShares > BigInt(0),
        }
    }) as { data: [string, bigint, boolean, boolean, bigint, bigint, bigint, bigint] | undefined };

    // MarketInfo: [creator, deadline, resolved, result, totalYes, totalNo, totalSharesYes, totalSharesNo]

    // 3. Calculate Actual Payout
    let calculatedPayout = BigInt(0);
    if (marketInfo && userShares > BigInt(0)) {
        const [, , , , totalYes, totalNo, totalSharesYes, totalSharesNo] = marketInfo;
        const totalPool = totalYes + totalNo;
        const totalOppositePool = winningSide ? totalNo : totalYes;
        // V2 Payout Logic: (shares * totalPool) / totalSharesWinning
        // Note: Fees are already deducted from pool during placement, so totalYes/No represent net pools? 
        // Actually V2 fees are taken from valid bets. totalYes/totalNo track the NET pool.

        const totalSharesWinning = winningSide ? totalSharesYes : totalSharesNo;

        if (totalSharesWinning > BigInt(0)) {
            calculatedPayout = (userShares * totalPool) / totalSharesWinning;
        }
    }

    // 4. Check Creator Balance (Global accumulated fees)
    const { data: creatorBalance, refetch: refetchCreatorBalance } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'creatorBalance',
        args: [address || '0x0000000000000000000000000000000000000000'],
        query: {
            enabled: !!address,
        }
    }) as { data: bigint | undefined, refetch: () => void };

    // V3: Get Market Info ALWAYS (for state checking)
    // This hook runs independently to check market state for verification UI
    // V3: Get Market Info ALWAYS (for state checking)
    // This hook runs independently to check market state for verification UI
    const { data: marketInfoV3, refetch: refetchMarketInfoV3 } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'getMarketInfo',
        args: [bet.id],
        query: {
            enabled: true, // Always fetch to check V3 state
            refetchInterval: 10000, // Refresh every 10s
        }
    }) as { data: [string, bigint, number, boolean, bigint, bigint, bigint, bigint] | undefined, refetch: () => void };

    // V3: Get Market State from dedicated hook
    // MarketInfo V3: [creator, deadline, state, result, totalYes, totalNo, totalSharesYes, totalSharesNo]
    const marketStateV3 = marketInfoV3 ? Number(marketInfoV3[2]) : 0;
    const isMarketOpen = marketStateV3 === 0;     // OPEN
    const isMarketLocked = marketStateV3 === 1;   // LOCKED
    const isMarketProposed = marketStateV3 === 2; // PROPOSED
    const isMarketResolved = marketStateV3 === 3; // RESOLVED

    // V3: Get Required Bond
    const { data: requiredBond } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'getRequiredBond',
        args: [bet.id],
        query: {
            enabled: isMarketLocked || isMarketProposed,
        }
    }) as { data: bigint | undefined };

    // V3: Get Reporter Reward
    const { data: reporterReward } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'getReporterReward',
        args: [bet.id],
        query: {
            enabled: isMarketLocked || isMarketProposed,
        }
    }) as { data: bigint | undefined };

    // V3: Get Proposal Info
    const { data: proposalInfo, refetch: refetchProposalInfo } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'getProposalInfo',
        args: [bet.id],
        query: {
            enabled: isMarketProposed,
        }
    }) as { data: [string, boolean, bigint, bigint, bigint, boolean] | undefined, refetch: () => void };

    // Parse proposal info if available
    const parsedProposalInfo = proposalInfo ? {
        proposer: proposalInfo[0],
        proposedResult: proposalInfo[1],
        proposalTime: proposalInfo[2],
        bondAmount: proposalInfo[3],
        disputeDeadline: proposalInfo[4],
        canFinalize: proposalInfo[5],
    } : null;

    const handleClaimCreatorFees = async () => {
        if (!isConnected || !address) return;
        setIsSubmitting(true);
        try {
            const hash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'claimCreatorRewards',
                args: [],
            });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash, timeout: 60000 });
            }
            showAlert('Success', 'Creator fees claimed successfully!', 'success');
            refetchCreatorBalance();
        } catch (error) {
            console.error('Claim Fees error:', error);
            showAlert('Error', (error as Error).message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const canClaim = bet.status !== 'active' && userShares > BigInt(0) && !hasClaimed;

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
        if (remaining > 50 * 365 * 24 * 60 * 60 * 1000) return 'Indefinite ♾️';
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
            versus_battle: `${bet.castText || bet.question || 'Battle Prediction'}`,
        };
        return labels[bet.type] || bet.castText || bet.question || `hit ${bet.target}`;
    };

    const handleSubmit = async () => {
        if (!isConnected || !address) {
            alert('Please connect your wallet first!');
            return;
        }

        setIsSubmitting(true);
        const submitAmount = parseFloat(amount) || 0;

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
                    showAlert('Wrong Network', `Please switch to ${IS_MAINNET ? 'Base Mainnet' : 'Base Sepolia'}.`, 'error');
                    setIsSubmitting(false);
                    return;
                }
            }

            // 1. Approve USDC to Contract
            console.log('Step 1: Approving USDC to contract...');
            const amountInWei = parseUnits(submitAmount.toString(), 6); // USDC has 6 decimals

            let approveHash;
            try {
                approveHash = await writeContractAsync({
                    address: USDC_ADDRESS as `0x${string}`,
                    abi: [{
                        name: 'approve',
                        type: 'function',
                        stateMutability: 'nonpayable',
                        inputs: [
                            { name: 'spender', type: 'address' },
                            { name: 'amount', type: 'uint256' }
                        ],
                        outputs: [{ name: '', type: 'bool' }]
                    }],
                    functionName: 'approve',
                    args: [CURRENT_CONFIG.contractAddress as `0x${string}`, amountInWei],
                    gas: BigInt(100000),
                });
                console.log('Approve tx sent:', approveHash);

                if (!publicClient) throw new Error("Public Client not initialized");
                const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 180000 });
                if (approveReceipt.status !== 'success') {
                    throw new Error('USDC approval failed on-chain.');
                }
                console.log('Approval confirmed.');

            } catch (txError) {
                console.error('Approval error:', txError);
                const msg = (txError as any).shortMessage || (txError as any).message || 'Wallet Error';
                throw new Error(`Approval Failed: ${msg}`);
            }

            // 2. Place Bet on Smart Contract
            console.log('Step 2: Placing bet on contract...');
            let hash;
            try {
                hash = await writeContractAsync({
                    address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'placeBet',
                    args: [
                        bet.id,
                        choice === 'yes',
                        amountInWei,
                        '0x0000000000000000000000000000000000000000' as `0x${string}` // No referrer
                    ],
                    gas: BigInt(350000),
                });
                console.log('PlaceBet tx sent:', hash);

                if (!publicClient) throw new Error("Public Client not initialized");
                const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180000 });
                if (receipt.status !== 'success') {
                    throw new Error('Bet placement failed on-chain.');
                }
                console.log('Bet confirmed on-chain:', receipt.transactionHash);

            } catch (txError) {
                console.error('PlaceBet error:', txError);
                const msg = (txError as any).shortMessage || (txError as any).message || 'Wallet Error';
                throw new Error(`Transaction Failed: ${msg}`);
            }

            // 3. Call backend to register bet (ONLY AFTER CONFIRMATION)
            console.log('Registering prediction in backend...');
            const response = await fetch('/api/predictions/bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    betId: bet.id,
                    choice,
                    amount: submitAmount,
                    txHash: hash,
                    userAddress: address
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                throw new Error(`Server Error (${response.status}): Try again.`);
            }

            const data = await response.json();

            if (data.success) {
                const numericAmount = submitAmount;
                const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                const initialSeed = bet.initialValue || 0;

                // DEAD LIQUIDITY FORMULA
                const seedPerSide = initialSeed / 2;
                const mySideTotal = choice === 'yes' ? yesPool + seedPerSide : noPool + seedPerSide;
                const totalPoolAfterBet = yesPool + noPool + initialSeed + numericAmount;
                const distributablePot = totalPoolAfterBet * 0.75;

                // Share = MyBet / (MySideTotal + MyBet)
                const myShare = numericAmount / (mySideTotal + numericAmount);
                const estimatedPayout = myShare * distributablePot;

                const multiplier = estimatedPayout / numericAmount;

                // Battle Mode Data
                const isBattle = !!(bet.optionA?.label && bet.optionB?.label);
                let finalChoice = choice === 'yes' ? 'YES' : 'NO';
                let opponentName = '';
                let opponentAvatar = '';
                let myFighterAvatar = '';

                if (isBattle) {
                    if (choice === 'yes') {
                        finalChoice = bet.optionA!.label;
                        myFighterAvatar = bet.optionA!.imageUrl || '';
                        opponentName = bet.optionB!.label;
                        opponentAvatar = bet.optionB!.imageUrl || '';
                    } else {
                        finalChoice = bet.optionB!.label;
                        myFighterAvatar = bet.optionB!.imageUrl || '';
                        opponentName = bet.optionA!.label;
                        opponentAvatar = bet.optionA!.imageUrl || '';
                    }
                }

                setReceiptData({
                    predictionId: bet.id,
                    avatarUrl: bet.pfpUrl,
                    username: bet.username,
                    action: "JOINED BATTLE",
                    amount: submitAmount,
                    potentialWin: submitAmount * multiplier,
                    multiplier: parseFloat(multiplier.toFixed(2)),
                    choice: finalChoice === 'YES' ? 'YES' : (finalChoice === 'NO' ? 'NO' : finalChoice),
                    targetName: getBetTypeLabel(),
                    variant: isBattle ? 'battle' : 'standard',
                    opponentName: opponentName,
                    opponentAvatar: opponentAvatar,
                    myFighterAvatar: myFighterAvatar
                });

                setShowReceipt(true);
                closeModal();
                setIsBattleModalOpen(false);
            } else {
                showAlert('Partial Error', 'Payment confirmed, but backend registration failed. Please contact support with your TX Hash.', 'warning');
            }
        } catch (error) {
            console.error('Error submitting bet:', error);
            showAlert('Action Failed', (error as Error).message || 'Unknown error occurred', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSeedPool = async () => {
        // V2 NOTE: seedPrediction does NOT exist in V2!
        // In V2, seed is provided during createMarket() call.
        // This button should inform the user instead of trying to seed.
        showAlert(
            'V2 Contract',
            'In the V2 contract, pools are seeded during market creation. There is no separate seedPrediction function. If you need to add liquidity, you can place bets on both sides.',
            'info'
        );
    };

    const handleDelete = async () => {
        showConfirm('Delete Bet?', 'Are you sure you want to delete this bet? This action cannot be undone and will not refund participants automatically.', async () => {
            setIsDeleting(true);
            try {
                const response = await fetch('/api/admin/bets/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ betId: bet.id }),
                });

                if (response.ok) {
                    showAlert('Deleted', 'Bet deleted successfully.', 'success');
                    onBet(); // Refresh list
                } else {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to delete');
                }
            } catch (error) {
                console.error('Delete error:', error);
                showAlert('Error', (error as Error).message, 'error');
            } finally {
                setIsDeleting(false);
            }
        });
    };

    const handleClaim = async () => {
        if (!isConnected || !address) {
            showAlert('Wallet Required', 'Please connect your wallet to claim.', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            console.log('Claiming reward for:', bet.id);
            const hash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'claimReward',
                args: [bet.id],
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash, timeout: 180000 });
            }

            showAlert('Success', 'Reward claimed successfully! View your wallet.', 'success');

            // Register claim in DB asynchronously
            fetch('/api/predictions/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ betId: bet.id, userAddress: address })
            }).catch(err => console.error('Failed to register claim in DB', err));

            refetchUserBet();
            router.refresh();
        } catch (error) {
            console.error('Claim error:', error);
            showAlert('Claim Failed', (error as Error).message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVoid = async () => {
        showConfirm('Confirm VOID / DRAW?', 'Are you sure you want to VOID this bet? This will refund all participants (minus fee). This action cannot be undone.', async () => {
            setIsSubmitting(true);
            try {
                const hash = await writeContractAsync({
                    address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'voidMarket',
                    args: [bet.id],
                });

                if (publicClient) {
                    await publicClient.waitForTransactionReceipt({ hash, timeout: 180000 });
                }

                showAlert('Voided', 'Bet has been voided/refunded.', 'success');
                onBet();
            } catch (error) {
                console.error('Void error:', error);
                showAlert('Error', (error as Error).message, 'error');
            } finally {
                setIsSubmitting(false);
            }
        });
    };

    return (
        <>
            <div className="glass-card rounded-3xl p-0 overflow-hidden group hover:neon-border transition-all duration-300 w-full max-w-full">
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
                        {/* Delete Button (Only for Admin) */}
                        {address && isAdmin(address) && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                disabled={isDeleting}
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors ml-2"
                                title="Delete Bet"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
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
                            {/* Volume & Fighters - Top Right */}
                            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                                <div className="text-center w-full md:w-auto flex-1">
                                    <h3 className="text-lg md:text-xl font-black text-white italic leading-tight drop-shadow-lg opacity-90">
                                        {bet.castText || getBetTypeLabel()}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-4 bg-black/40 rounded-full px-4 py-2 border border-white/5">
                                    <div className="text-xl font-black text-white flex items-center gap-1">
                                        <span className="text-primary">$</span>
                                        {bet.totalPot.toFixed(2)}
                                    </div>
                                    <div className="w-px h-6 bg-white/10"></div>
                                    <div className="text-xs text-white/60 flex items-center gap-1">
                                        <Users className="w-3 h-3" /> {bet.participantCount} <span className="hidden sm:inline">Predictors</span>
                                    </div>
                                </div>
                            </div>

                            {/* Two Predictors Face-Off - SYMMETRIC LAYOUT */}
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4 mb-6 w-full max-w-2xl mx-auto">
                                {/* Player A (Left) */}
                                <div className="flex flex-col items-center justify-start h-full">
                                    <a href={`https://warpcast.com/${bet.optionA.label}`} target="_blank" rel="noreferrer" className="group/player flex flex-col items-center">
                                        <div className="w-16 h-16 md:w-32 md:h-32 rounded-xl overflow-hidden border-3 border-green-500/50 group-hover/player:border-green-500 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] relative">
                                            {bet.optionA.imageUrl ? (
                                                <img src={bet.optionA.imageUrl} alt={bet.optionA.label} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = 'https://link.warpcast.com/api/avatar/default.png')} />
                                            ) : (
                                                <div className="w-full h-full bg-green-500/20 flex items-center justify-center text-green-500 text-xl md:text-3xl font-black">
                                                    {bet.optionA.label.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2 text-center w-full">
                                            <div className="text-sm md:text-xl font-black text-green-500 group-hover/player:text-green-400 transition-colors truncate max-w-[120px] md:max-w-[200px]">
                                                {bet.optionA.label}
                                            </div>
                                            {bet.optionA?.referenceUrl && (
                                                <a
                                                    href={bet.optionA.referenceUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400 hover:bg-green-500/20 hover:text-green-300 transition-colors"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    CONTEXT
                                                </a>
                                            )}
                                        </div>
                                    </a>
                                </div>

                                {/* VS (Center) */}
                                <div className="flex items-center justify-center">
                                    <div className="text-2xl md:text-5xl font-black text-white/20 italic select-none">
                                        VS
                                    </div>
                                </div>

                                {/* Player B (Right) */}
                                <div className="flex flex-col items-center justify-start h-full">
                                    <a href={`https://warpcast.com/${bet.optionB.label}`} target="_blank" rel="noreferrer" className="group/player flex flex-col items-center">
                                        <div className="w-16 h-16 md:w-32 md:h-32 rounded-xl overflow-hidden border-3 border-red-500/50 group-hover/player:border-red-500 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] relative">
                                            {bet.optionB.imageUrl ? (
                                                <img src={bet.optionB.imageUrl} alt={bet.optionB.label} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = 'https://link.warpcast.com/api/avatar/default.png')} />
                                            ) : (
                                                <div className="w-full h-full bg-red-500/20 flex items-center justify-center text-red-500 text-xl md:text-3xl font-black">
                                                    {bet.optionB.label.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2 text-center w-full">
                                            <div className="text-sm md:text-xl font-black text-red-500 group-hover/player:text-red-400 transition-colors truncate max-w-[120px] md:max-w-[200px]">
                                                {bet.optionB.label}
                                            </div>
                                            {bet.optionB?.referenceUrl && (
                                                <a
                                                    href={bet.optionB.referenceUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    CONTEXT
                                                </a>
                                            )}
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
                        <div className="flex flex-col md:flex-row items-start justify-between mb-8 gap-6 md:gap-0">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                {/* Avatar */}
                                {bet.pfpUrl ? (
                                    <div className="relative flex-shrink-0">
                                        <div className="w-20 h-20 md:w-32 md:h-32 rounded-xl overflow-hidden border-2 border-primary/30 group-hover:border-primary transition-colors">
                                            <img src={bet.pfpUrl} alt={bet.username} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-primary text-black text-[10px] md:text-xs font-black px-2 py-0.5 rounded shadow-lg">
                                            OP
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 md:w-32 md:h-32 rounded-xl bg-primary/20 flex items-center justify-center border-2 border-primary/30 flex-shrink-0">
                                        <Swords className="w-8 h-8 md:w-12 md:h-12 text-primary" />
                                    </div>
                                )}

                                {/* Prediction Info */}
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-xl md:text-3xl font-black text-white leading-none mb-2 truncate">
                                        <a href={`https://warpcast.com/${bet.username}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors hover:underline">
                                            @{bet.username}
                                        </a>
                                    </h3>
                                    <div className="text-sm font-bold text-white/80 flex flex-wrap items-center gap-2 leading-tight">
                                        <span className="text-primary flex-shrink-0">VS</span>
                                        <span className="break-words">{getBetTypeLabel()}</span>
                                    </div>
                                    {/* POST LINK - Prominent */}
                                    {(bet.castUrl && bet.castUrl.length > 10) && (
                                        <a href={bet.castUrl}
                                            target="_blank" rel="noreferrer"
                                            className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary/30 to-orange-500/30 text-primary border border-primary/50 text-sm font-bold hover:from-primary/40 hover:to-orange-500/40 transition-all shadow-[0_0_15px_rgba(255,95,31,0.4)] hover:shadow-[0_0_25px_rgba(255,95,31,0.6)] transform hover:scale-105 whitespace-nowrap">
                                            🔗 View Target Post
                                        </a>
                                    )}
                                    <div className="mt-2 text-left">
                                        <button onClick={() => setShowRulesModal(true)} className="text-xs text-white/40 hover:text-white transition-colors">
                                            ? Rules
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Pool Stats - Mobile Optimized */}
                            <div className="w-full md:w-auto flex md:flex-col items-center md:items-end justify-between md:justify-start bg-white/5 md:bg-transparent p-3 md:p-0 rounded-2xl md:rounded-none border border-white/5 md:border-none">
                                <div className="flex flex-col md:items-end">
                                    <div className="text-xs text-white/40 uppercase tracking-widest mb-1">Total Volume</div>
                                    <div className="text-3xl font-black text-white flex items-center gap-1">
                                        <span className="text-primary">$</span>
                                        {bet.totalPot.toFixed(2)}
                                    </div>
                                </div>
                                <div className="w-px h-8 bg-white/10 md:hidden mx-4"></div>
                                <div className="flex flex-col md:items-end md:mt-2">
                                    <div className="text-xs text-white/40 uppercase tracking-widest mb-1 md:hidden">Predictors</div>
                                    <div className="text-sm font-bold text-white flex items-center gap-2">
                                        <Users className="w-4 h-4 text-primary" /> {bet.participantCount}
                                        <span className="md:hidden">People</span>
                                    </div>
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
                                    const initialSeed = bet.initialValue || 0;
                                    const seedPerSide = initialSeed / 2;

                                    // Dead Liquidity Visual


                                    const totalPool = yesPool + noPool + initialSeed;


                                    const mySideEffective = yesPool + seedPerSide;


                                    if (mySideEffective <= 0) return '1.75';


                                    const multiplier = (totalPool * 0.75) / mySideEffective;


                                    return multiplier.toFixed(2);
                                })()}x
                            </span></span>
                            <span>MULT: <span className="text-red-400">
                                {(() => {
                                    const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                                    const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                                    const initialSeed = bet.initialValue || 0;
                                    const seedPerSide = initialSeed / 2;

                                    // Dead Liquidity Visual


                                    const totalPool = yesPool + noPool + initialSeed;


                                    const mySideEffective = noPool + seedPerSide;


                                    if (mySideEffective <= 0) return '1.75';


                                    const multiplier = (totalPool * 0.75) / mySideEffective;


                                    return multiplier.toFixed(2);
                                })()}x
                            </span></span>
                        </div>
                    </div>

                    {/* Action Area */}
                    <div className="flex gap-3">

                        {/* ... existing render ... */}
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

                        {/* VOID Button (Admin Only) - For Stuck Bets */}
                        {address && isAdmin(address) && bet.status === 'active' && (
                            <button
                                onClick={handleVoid}
                                disabled={isSubmitting}
                                className="px-4 py-3 rounded-xl bg-gray-500/10 text-gray-500 border border-gray-500/20 font-bold hover:bg-gray-500/20 transition-all"
                                title="Void/Refund Bet"
                            >
                                🏳️ Void
                            </button>
                        )}

                        {/* V3: Verify Button - For LOCKED or PROPOSED markets */}
                        {address && (isMarketLocked || isMarketProposed) && (
                            <button
                                onClick={() => setShowVerificationModal(true)}
                                className={`px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${isMarketProposed
                                    ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500/20'
                                    : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                                    }`}
                                title={isMarketProposed ? "Ver status da verificação" : "Verificar resultado"}
                            >
                                <Shield className="w-4 h-4" />
                                {isMarketProposed ? 'Em Verificação' : 'Verificar'}
                            </button>
                        )}

                        {canClaim ? (
                            <ClaimButton
                                amount={calculatedPayout > BigInt(0) ? (Number(calculatedPayout) / 1000000).toFixed(2) : (bet.initialValue ? (bet.initialValue / 1000000).toFixed(2) : '0.00')}
                                onClick={handleClaim}
                                loading={isSubmitting}
                            />
                        ) : (bet.status !== 'active' || Date.now() >= bet.expiresAt ? (
                            <ClaimButton
                                amount={calculatedPayout > BigInt(0) ? (Number(calculatedPayout) / 1000000).toFixed(2) : '0.00'}
                                onClick={() => { }}
                                disabled={true}
                                label={hasClaimed ? 'Reward Claimed' : 'No Winnings'}
                                subtext={hasClaimed ? 'PAID' : 'NOT ELIGIBLE'}
                            />
                        ) : (
                            <button
                                onClick={() => setIsBattleModalOpen(true)}
                                className="w-full bg-primary hover:bg-white hover:text-black text-black font-black py-3 rounded-xl transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(255,95,31,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                JOIN BATTLE
                            </button>
                        ))}
                    </div>

                    {/* Creator Fees Section - Only visible to the creator of this market */}
                    {creatorBalance && creatorBalance > BigInt(0) && bet.creatorAddress && address && bet.creatorAddress.toLowerCase() === address.toLowerCase() && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-yellow-500/80 font-bold uppercase tracking-wider mb-1">
                                        Creator Earnings Available
                                    </div>
                                    <div className="text-xl font-black text-white">
                                        ${(Number(creatorBalance) / 1000000).toFixed(2)}
                                    </div>
                                </div>
                                <button
                                    onClick={handleClaimCreatorFees}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors text-sm shadow-lg flex items-center gap-2"
                                >
                                    {isSubmitting ? '...' : (
                                        <>
                                            <Coins className="w-4 h-4" />
                                            CLAIM FEES
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="text-[10px] text-white/40 mt-2 text-center">
                                *These are accumulated fees from all your markets (5% of pot). Does not include seed liquidity.
                            </p>
                        </div>
                    )}
                </div>
            </div >


            {/* Battle Station Modal */}
            {
                isBattleModalOpen && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-0 md:p-4">
                        <div className="bg-[#0a0a0a] border-0 md:border md:border-white/10 rounded-none md:rounded-3xl w-full h-[100dvh] md:h-auto md:max-h-[90dvh] md:max-w-md shadow-2xl relative flex flex-col">
                            {/* Top Accent */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-white to-primary opacity-50"></div>

                            <div className="px-6 py-6 border-b border-white/5 flex items-center justify-between">
                                <h2 className="text-xl font-black text-white italic uppercase tracking-wider">
                                    Battle Station
                                </h2>
                                <button
                                    onClick={() => setIsBattleModalOpen(false)}
                                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                                >
                                    <X className="w-5 h-5 text-white/60" />
                                </button>
                            </div>

                            <div className="p-3 md:p-6 space-y-3 md:space-y-6 overflow-y-auto max-h-[calc(90dvh-80px)]" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

                                {/* Stylized Header for Battle Mode */}
                                {bet.optionA && bet.optionB ? (
                                    <div className="bg-gradient-to-br from-black/60 to-black/20 rounded-2xl p-4 border border-white/10 text-center relative overflow-hidden">
                                        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20"></div>
                                        <div className="relative z-10 flex items-center justify-center gap-6">
                                            {/* Player 1 */}
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden border-2 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                                                    {bet.optionA.imageUrl ? <img src={bet.optionA.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-green-500/20" />}
                                                </div>
                                                <div className="text-[10px] md:text-sm font-black text-green-500">{bet.optionA.label}</div>
                                            </div>

                                            <div className="text-2xl md:text-4xl font-black italic text-white/20">VS</div>

                                            {/* Player 2 */}
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                                                    {bet.optionB.imageUrl ? <img src={bet.optionB.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-red-500/20" />}
                                                </div>
                                                <div className="text-[10px] md:text-sm font-black text-red-500">{bet.optionB.label}</div>
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
                                            className={`p-2 md:p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 md:gap-2 relative overflow-hidden ${choice === 'yes'
                                                ? 'border-green-500 bg-green-500/10'
                                                : 'border-white/10 bg-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            {bet.optionA?.imageUrl && (
                                                <img src={bet.optionA.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                                            )}
                                            <div className="text-lg md:text-2xl font-black text-green-500">
                                                {bet.optionA?.label || 'YES'}
                                            </div>
                                            {choice === 'yes' && <div className="absolute inset-0 bg-green-500/5 animate-pulse" />}
                                        </button>
                                        <button
                                            onClick={() => setChoice('no')}
                                            className={`p-2 md:p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 md:gap-2 relative overflow-hidden ${choice === 'no'
                                                ? 'border-red-500 bg-red-500/10'
                                                : 'border-white/10 bg-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            {bet.optionB?.imageUrl && (
                                                <img src={bet.optionB.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                                            )}
                                            <div className="text-lg md:text-2xl font-black text-red-500">
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
                                            value={parseFloat(amount) || bet.minBet}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        {/* Input + Quick Buttons */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={amount}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        // Allow empty string or valid float input pattern
                                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                            setAmount(val);
                                                        }
                                                    }}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2 md:py-3 text-white font-bold text-base md:text-lg focus:outline-none focus:border-primary"
                                                    placeholder={bet.minBet.toString()}
                                                />
                                            </div>
                                            {/* Quick Select Buttons */}
                                            <button
                                                type="button"
                                                onClick={() => setAmount(bet.minBet.toString())}
                                                className={`px-2 py-1 md:px-3 md:py-2 rounded-lg text-xs font-bold border ${parseFloat(amount) === bet.minBet ? 'border-primary bg-primary/20 text-primary' : 'border-white/10 text-white/60 hover:border-white/30'}`}
                                            >
                                                MIN
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAmount(bet.maxBet.toString())}
                                                className={`px-2 py-1 md:px-3 md:py-2 rounded-lg text-xs font-bold border ${parseFloat(amount) === bet.maxBet ? 'border-primary bg-primary/20 text-primary' : 'border-white/10 text-white/60 hover:border-white/30'}`}
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
                                <div className="bg-black rounded-xl p-3 md:p-4 border border-white/10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-20">
                                        <Zap className="w-12 h-12 text-white" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="text-xs text-white/60 mb-1">Potential Payout</div>
                                        <div className="text-3xl font-black text-white flex items-end gap-2">
                                            ${(() => {
                                                const numericAmount = parseFloat(amount) || 0;
                                                const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                                                const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                                                const initialSeed = bet.initialValue || 0;
                                                const seedPerSide = initialSeed / 2;

                                                // Dead Liquidity Visual


                                                const totalPool = yesPool + noPool + initialSeed;


                                                const mySideCurrent = choice === 'yes' ? yesPool : noPool;


                                                const mySideEffective = mySideCurrent + seedPerSide;


                                                if (mySideEffective <= 0) return (numericAmount * 1.75).toFixed(2);


                                                const rate = (totalPool * 0.75) / mySideEffective;


                                                return (numericAmount * rate).toFixed(2);
                                            })()}
                                            <span className="text-sm font-bold text-primary mb-1.5">
                                                ({(() => {
                                                    const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                                                    const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                                                    const initialSeed = bet.initialValue || 0;
                                                    const seedPerSide = initialSeed / 2;

                                                    const totalPool = yesPool + noPool + initialSeed;


                                                    const mySideCurrent = choice === 'yes' ? yesPool : noPool;


                                                    const mySideEffective = mySideCurrent + seedPerSide;


                                                    if (mySideEffective <= 0) return '1.75';


                                                    const rate = (totalPool * 0.75) / mySideEffective;


                                                    return rate.toFixed(2);
                                                })()}x)
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Button or Connect Wallet */}
                                {isConnected ? (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="w-full bg-primary hover:bg-white hover:text-black text-black font-black py-3 md:py-4 rounded-xl transition-all uppercase tracking-widest text-base md:text-lg shadow-[0_0_20px_rgba(255,95,31,0.4)] hover:shadow-[0_0_30px_rgba(255,255,255,0.6)] animate-pulse-fast disabled:opacity-50 disabled:animate-none"
                                    >
                                        {isSubmitting ? 'INITIATING...' : 'CONFIRM ENTRY'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            // Same priority as WalletButton: Rabby > Injected > MetaMask > Coinbase
                                            const rabbyConnector = connectors.find(c => c.id === 'io.rabby');
                                            const injectedConnector = connectors.find(c => c.id === 'injected');
                                            const metaMaskConnector = connectors.find(c => c.id === 'metaMask');
                                            const coinbaseConnector = connectors.find(c => c.id === 'coinbaseWalletSDK');

                                            const targetConnector = rabbyConnector || injectedConnector || metaMaskConnector || coinbaseConnector || connectors[0];

                                            if (targetConnector) {
                                                connect({ connector: targetConnector });
                                            } else {
                                                alert('No wallet connectors found. Please install Rabby or MetaMask.');
                                            }
                                        }}
                                        className="w-full bg-white text-black font-black py-3 md:py-4 rounded-xl transition-all uppercase tracking-widest text-base md:text-lg hover:bg-gray-200 flex items-center justify-center gap-2"
                                    >
                                        <span>💳</span> CONNECT WALLET
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Viral Receipt Integration */}
            <ViralReceipt
                isOpen={showReceipt}
                onClose={() => {
                    setShowReceipt(false);
                    onBet(); // Refresh only when closing receipt
                }}
                data={receiptData || { username: '', amount: 0, potentialWin: 0, multiplier: 0, choice: 'YES', targetName: '' }}
            />

            {/* V3: Verification Modal */}
            <VerificationModal
                isOpen={showVerificationModal}
                onClose={() => setShowVerificationModal(false)}
                marketId={bet.id}
                marketQuestion={bet.question || `@${bet.username} - ${bet.type}`}
                requiredBond={requiredBond || BigInt(1000000)}
                reporterReward={reporterReward || BigInt(0)}
                currentState={marketStateV3}
                proposalInfo={parsedProposalInfo}
                onSuccess={() => {
                    refetchProposalInfo();
                    refetchMarketInfoV3();
                    onBet();
                }}
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
            {/* Modal Portal */}

        </>
    );
}
