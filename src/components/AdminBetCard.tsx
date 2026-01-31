'use client';

import { useState, useEffect } from 'react';
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
    platform?: 'twitter' | 'farcaster' | 'baseapp'; // [NEW]
    profileUrl?: string;   // [NEW]
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

const getProfileLink = (bet: AdminBet) => {
    if (bet.profileUrl) return bet.profileUrl;
    if (bet.platform === 'farcaster') return `https://warpcast.com/${bet.username}`;
    if (bet.platform === 'baseapp') return `https://base.org/${bet.username}`;
    return `https://x.com/${bet.username}`;
};

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

    // V6: Public Dispute Timer State
    const [disputeTimer, setDisputeTimer] = useState<string>('');
    const [canFinalize, setCanFinalize] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);

    // Wagmi hooks - Must be before useEffect
    const { address, isConnected, chainId } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const { switchChainAsync } = useSwitchChain();
    const { connectors, connect } = useConnect();
    const publicClient = usePublicClient();

    // Referral State
    const [referrerAddress, setReferrerAddress] = useState<string | null>(null);
    const [myReferralCode, setMyReferralCode] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const ref = params.get('ref');
            if (ref) {
                if (ref.startsWith('0x') && ref.length === 42) {
                    setReferrerAddress(ref);
                } else {
                    fetch(`/api/referral/resolve?code=${ref}`)
                        .then(res => res.json())
                        .then(data => { if (data.success && data.address) setReferrerAddress(data.address); })
                        .catch(err => console.error('Referral resolve error:', err));
                }
            }
        }
    }, []);

    // Fetch My Referral Code (for sharing)
    useEffect(() => {
        if (address && isConnected && !myReferralCode) {
            fetch('/api/referral/code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) setMyReferralCode(data.code);
                })
                .catch(err => console.error('Failed to get referral code:', err));
        }
    }, [address, isConnected]);

    // Calculate percentages
    const totalYes = bet?.participants?.yes?.length || 0;
    const totalNo = bet?.participants?.no?.length || 0;
    const totalVotes = totalYes + totalNo;
    const yesPercent = totalVotes > 0 ? (totalYes / totalVotes) * 100 : 50;
    const noPercent = totalVotes > 0 ? (totalNo / totalVotes) * 100 : 50;

    // Claim Check Logic
    const winningSide = bet.result === 'yes'; // true for yes, false for no

    // 1. Get User Shares (Fetch BOTH sides to handle Void/Result changes)
    const { data: yesBetData, refetch: refetchYesBet } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'yesBets',
        args: [
            bet.id,
            address || '0x0000000000000000000000000000000000000000'
        ],
        query: { enabled: !!address }
    }) as { data: [bigint, bigint, string, boolean] | undefined, refetch: () => void };

    const { data: noBetData, refetch: refetchNoBet } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'noBets',
        args: [
            bet.id,
            address || '0x0000000000000000000000000000000000000000'
        ],
        query: { enabled: !!address }
    }) as { data: [bigint, bigint, string, boolean] | undefined, refetch: () => void };

    const refetchUserBet = () => { refetchYesBet(); refetchNoBet(); };

    // --- MOVED HOOKS UP FOR DATA DEPENDENCY ---
    // 2. Get Market Info for Total Shares (V2/V5)
    // Rename to avoid conflict if any, but "marketStruct" is unique enough.
    const { data: marketStruct, refetch: refetchMarketStruct } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'markets',
        args: [bet.id],
        query: {
            enabled: !!address && bet.status !== 'active',
        }
    }) as { data: any[] | undefined, refetch: () => void };

    // V5: Separate Market Info Query (always enabled for verification button)
    const { data: marketInfo, refetch: refetchMarketInfo } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'markets',
        args: [bet.id],
        query: {
            enabled: !!address,
            refetchInterval: 10000,
        }
    }) as { data: any[] | undefined, refetch: () => void };

    // Derive Active Market Data EARLY
    const activeMarketData = marketInfo || marketStruct;
    const marketStateV5 = activeMarketData ? Number(activeMarketData[6]) : 0;
    const isMarketResolved = marketStateV5 === 4;

    // Determine Result (Chain > DB)
    let resultString = (bet.result || '').toLowerCase();

    if (isMarketResolved && activeMarketData) {
        const isVoid = activeMarketData[8] as boolean;
        const resultBool = activeMarketData[7] as boolean;
        if (isVoid) resultString = 'void';
        else resultString = resultBool ? 'yes' : 'no';
    }
    // ------------------------------------------

    // V5/V6 Struct returns: [amount, shares, referrer, claimed]
    // The previous code incorrectly treated it as a single bigint.
    const yesDataArray = (yesBetData as [bigint, bigint, string, boolean]) || [BigInt(0), BigInt(0), '', false];
    const noDataArray = (noBetData as [bigint, bigint, string, boolean]) || [BigInt(0), BigInt(0), '', false];

    const userYesAmount = yesDataArray[0];
    const userNoAmount = noDataArray[0];
    const userYesClaimed = yesDataArray[3];
    const userNoClaimed = noDataArray[3];

    // Determine shares based on result
    let userShares = BigInt(0);
    let hasClaimed = false; // V2 doesn't return claimed status in yesBets mapping... it tracks `paidOut` on the contract via processedIndex for batch, or users call claimWinnings.
    // But wait, `claimWinnings` function is what users call?
    // In V2 `distributeWinnings` is batch.
    // In V2 `claimWinnings` function exists?
    // ABI has `claimWinnings`.

    // Use the robust resultString derived above
    const normalizedResult = resultString;

    if (normalizedResult === 'void') userShares = userYesAmount + userNoAmount;
    else if (normalizedResult === 'yes') userShares = userYesAmount;
    else if (normalizedResult === 'no') userShares = userNoAmount;

    // DEBUG LOGS (Requested by User)
    useEffect(() => {
        if (bet.status !== 'active' || isMarketResolved) {
            console.log(`[DEBUG] Bet: ${bet.id}`);
            console.log(`[DEBUG] DB Result: ${bet.result}`);
            console.log(`[DEBUG] Chain Result (derived): ${normalizedResult}`);
            console.log(`[DEBUG] Market Resolved: ${isMarketResolved}`);
            console.log(`[DEBUG] User Shares (Calc): ${userShares}`);
            // Recalc canClaim locally to log
            const _canClaim = (bet.status !== 'active' || isMarketResolved) && userShares > BigInt(0);
            console.log(`[DEBUG] Can Claim (Pre-check): ${_canClaim}`);
        }
    }, [bet, isMarketResolved, normalizedResult, userShares]);

    // Check if claimed? V2 doesn't have easy per-user claimed mapping exposed publicly in ABI seen so far.
    // ABI has `paidOut` on the struct.
    // We might need to rely on our DB or check logs if we want to know if specific user claimed.
    // OR we assume if `yesBets[user]` is 0 AND they had a bet, maybe it was deleted (claimed)?
    // In `distributeWinnings` code: `p.yesBets[winnerAddr] = 0;`
    // YES! Creating a claim ZEROES out the bet.
    // So if user HAD a bet (we know via events or DB) but now `yesBets` on chain is 0, they CLAIMED.
    // But how do we distinguish "Never Bet" vs "Claimed"?
    // We can rely on `bet.participants` from DB to know if they bet.
    // For now, let's assume if their on-chain balance is > 0, they HAVEN'T claimed.
    // If it is 0, they either didn't bet or already claimed.
    // The `ClaimButton` should be enabled if on-chain balance > 0.



    // If userShares > 0, they can claim.
    // If userShares > 0, they can claim.
    hasClaimed = userYesClaimed || userNoClaimed;

    // Original Bet Amount (for display) - We might rely on DB or just use what we have.
    const originalBetAmount = userYesAmount + userNoAmount; // This assumes not claimed yet.

    // 2. Get Market Info (Moved Up)
    // const { data: marketStruct... } defined above

    // 3. Calculate Actual Payout
    let calculatedPayout = BigInt(0);
    if (marketStruct && userShares > BigInt(0)) {
        // V2 Struct Indices based on ABI file read:
        // 18: totalYes, 19: totalNo, 20: seedYes, 21: seedNo

        const totalYes = BigInt(marketStruct[18] || 0);
        const totalNo = BigInt(marketStruct[19] || 0);
        const seedYes = BigInt(marketStruct[20] || 0);
        const seedNo = BigInt(marketStruct[21] || 0);

        // Fee Calculation (20% + 5% = 25%)
        const feeBps = BigInt(2500);
        const totalPool = totalYes + totalNo;
        const fee = (totalPool * feeBps) / BigInt(10000);
        const distributablePool = totalPool - fee;

        if (normalizedResult === 'void') {
            // VOID REFUND (Contract V6.1 Line 398): Returns Exact Amount (No Fee)
            // payout = yesBet.amount + noBet.amount
            calculatedPayout = userYesAmount + userNoAmount;
        } else {
            // Winner Logic
            // Eligible Shares = WinningTotal - WinningSeed
            const winningPoolTotal = normalizedResult === 'yes' ? totalYes : totalNo;
            const winningSeed = normalizedResult === 'yes' ? seedYes : seedNo;
            const eligibleShares = winningPoolTotal - winningSeed;

            if (eligibleShares > BigInt(0)) {
                calculatedPayout = (userShares * distributablePool) / eligibleShares;
            }
        }
    }

    // 4. Check Creator Balance (V5: creatorBalance mapping - Same as V3)
    const { data: creatorBalance, refetch: refetchCreatorBalance } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'creatorBalance',
        args: [address || '0x0000000000000000000000000000000000000000'],
        query: {
            enabled: !!address,
        }
    }) as { data: bigint | undefined, refetch: () => void };

    // V5: Market Info (Moved Up)
    // const { data: marketInfo... } defined above

    // V5: Market State Logic (Moved Up)
    // const activeMarketData = ...
    // const marketStateV5 = ...
    const isMarketOpen = marketStateV5 === 0;
    const isMarketLocked = marketStateV5 === 1;
    const isMarketProposed = marketStateV5 === 2;
    const isMarketDisputed = marketStateV5 === 3;
    // const isMarketResolved = ... defined above

    // Sync DB if needed
    useEffect(() => {
        if (bet.status === 'active' && isMarketResolved) {
            console.log('Syncing DB status for bet:', bet.id);
            fetch('/api/predictions/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ betId: bet.id })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.synced) {
                        console.log('DB Synced via frontend trigger');
                        router.refresh(); // Refresh to show updated status
                    }
                })
                .catch(err => console.error('Sync failed:', err));
        }
    }, [bet.status, isMarketResolved, bet.id, router]);

    // Can verify/propose/dispute if not resolved
    const canVerify = !isMarketResolved;

    // V5: Get Required Bond (this function exists in V5)
    const { data: requiredBond } = useReadContract({
        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'getRequiredBond',
        args: [bet.id],
        query: {
            enabled: canVerify,
        }
    }) as { data: bigint | undefined };

    // V5: Parse proposal info from markets struct (no separate getProposalInfo in V5)
    // Struct indices: 9:proposer, 10:proposedResult, 11:proposalTime, 12:bondAmount, 13:evidenceUrl
    const parsedProposalInfo = activeMarketData && isMarketProposed ? {
        proposer: activeMarketData[9] as string,
        proposedResult: activeMarketData[10] as boolean,
        proposalTime: BigInt(activeMarketData[11] || 0),
        bondAmount: BigInt(activeMarketData[12] || 0),
        disputeDeadline: BigInt(activeMarketData[11] || 0) + BigInt(43200), // proposalTime + 12h dispute window
        canFinalize: Date.now() / 1000 > Number(activeMarketData[11] || 0) + 43200, // After 12h
        evidenceUrl: activeMarketData[13] as string,
    } : null;

    // Refetch function for verification modal success
    const refetchProposalInfo = refetchMarketInfo;

    // --- TIMER LOGIC (Copied from BetCard) ---
    useEffect(() => {
        if (!activeMarketData || marketStateV5 !== 2) { // 2 = PROPOSED
            setDisputeTimer('');
            setCanFinalize(false);
            return;
        }

        const propTime = Number(activeMarketData[11] || 0);
        if (!propTime) return;

        const DISPUTE_WINDOW = 12 * 60 * 60; // 43200s

        const interval = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const endTime = propTime + DISPUTE_WINDOW;
            const remaining = endTime - now;

            if (remaining <= 0) {
                setCanFinalize(true);
                setDisputeTimer('00:00:00');
                clearInterval(interval);
            } else {
                const h = Math.floor(remaining / 3600);
                const m = Math.floor((remaining % 3600) / 60);
                const s = remaining % 60;
                setDisputeTimer(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                setCanFinalize(false);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [activeMarketData, marketStateV5]);
    // ------------------------------------------

    const handleClaimCreatorFees = async () => {
        if (!isConnected || !address) return;
        setIsSubmitting(true);
        try {
            const hash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'withdrawCreatorFees',
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

    const canClaim = (bet.status !== 'active' || isMarketResolved) && userShares > BigInt(0) && !hasClaimed;

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
        if (!bet.expiresAt) return 'Invalid Date';
        const remaining = bet.expiresAt - Date.now();
        if (isNaN(remaining)) return 'Invalid Date';

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
                        (referrerAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`
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
                const yesPool = (bet?.participants?.yes || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
                const noPool = (bet?.participants?.no || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
                const initialSeed = bet.initialValue || 0;

                // Fee Config (V6: 10% House + 5% Creator + 5% Referrer = 20%)
                const TOTAL_FEE_PERCENT = 0.20;

                // Weight/Boost Calculation
                // Max 1.5x, Min 1.0x
                let weightMultiplier = 1.0;
                // Try to estimate weight if we have creation info
                // If not available, default to 1.0 (Safe) or assume max if new?
                // Let's assume standard weight for now unless we can calc it.
                // ideally: const creationTime = bet.createdAt (if available)
                // For now, we fix the Fee (0.75 -> 0.80) which helps.

                // DEAD LIQUIDITY FORMULA
                const seedPerSide = initialSeed / 2;
                const mySideTotal = choice === 'yes' ? yesPool + seedPerSide : noPool + seedPerSide;
                const totalPoolAfterBet = yesPool + noPool + initialSeed + numericAmount;
                const distributablePot = totalPoolAfterBet * (1 - TOTAL_FEE_PERCENT);

                // Share = MyBet / (MySideTotal + MyBet)
                // NOTE: This assumes everyone has weight 1.0. 
                // To be precise we need weighted pools. 
                // For the "Potential Win" shown on Ticket, we'll try to be more optimistic 
                // if the user just selected a bonus. 
                // But without 'creationTime' in 'bet' object, we can't calc exact weight.
                // We'll proceed with Fee Fix (0.80) which improves it from 0.75.

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
                    myFighterAvatar: myFighterAvatar,
                    referralCode: myReferralCode || undefined
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
            // V3 OPTIMISTIC CHECK:
            // If market is Proposed (2) and we can finalize, do it first!
            if (isMarketProposed && parsedProposalInfo?.canFinalize) {
                console.log('Market needs finalization first. Finalizing...');
                showAlert('Finalizing', 'Market dispute period is over. Finalizing outcome on-chain...', 'info');

                const finalizeHash = await writeContractAsync({
                    address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'finalizeOutcome',
                    args: [bet.id],
                });

                if (publicClient) {
                    await publicClient.waitForTransactionReceipt({ hash: finalizeHash, timeout: 60000 });
                }
                console.log('Finalized successfully. Proceeding to claim...');
            }

            console.log('Claiming reward for:', bet.id);
            const hash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'claimWinnings',
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

    // V6: Withdraw Seed (Creator Only, Void Markets Only)
    const handleWithdrawSeed = async () => {
        if (!isConnected || !address) return;
        setIsSubmitting(true);
        try {
            const hash = await writeContractAsync({
                address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                abi: PredictionBattleABI.abi,
                functionName: 'withdrawSeed',
                args: [bet.id],
            });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash, timeout: 60000 });
            }
            showAlert('Success', 'Seed withdrawn successfully!', 'success');
            refetchMarketInfo();
        } catch (error) {
            console.error('Withdraw Seed error:', error);
            showAlert('Error', (error as Error).message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="glass-card rounded-3xl p-0 overflow-hidden group hover:neon-border transition-all duration-300 w-full max-w-full">
                {/* Header Ticket Stub */}
                <div className="bg-white/5 border-b border-white/5 p-4 flex justify-between items-center bg-[url('/noise.png')]">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${bet.status === 'active' && !isMarketResolved && Date.now() < bet.expiresAt ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span suppressHydrationWarning className="text-xs font-mono text-white/60 tracking-widest uppercase">
                                {bet.status !== 'active' || isMarketResolved ? 'RESOLVED' : Date.now() >= bet.expiresAt ? 'EXPIRED' : 'LIVE BATTLE'}
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
                        {/* Timer Removed */}
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
                                    <h3 className="text-lg md:text-xl font-display font-black text-white italic leading-tight drop-shadow-lg opacity-90">
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
                                    <a href={`https://x.com/${bet.optionA.label}`} target="_blank" rel="noreferrer" className="group/player flex flex-col items-center">
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
                                    <div className="text-2xl md:text-5xl font-display font-black text-white/20 italic select-none">
                                        VS
                                    </div>
                                </div>

                                {/* Player B (Right) */}
                                <div className="flex flex-col items-center justify-start h-full">
                                    <a href={`https://x.com/${bet.optionB.label}`} target="_blank" rel="noreferrer" className="group/player flex flex-col items-center">
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
                                    <a href={getProfileLink(bet)} target="_blank" rel="noreferrer" className="relative flex-shrink-0 group/avatar block">
                                        <div className="w-20 h-20 md:w-32 md:h-32 rounded-xl overflow-hidden border-2 border-primary/30 group-hover/avatar:border-primary transition-colors">
                                            <img src={bet.pfpUrl} alt={bet.username} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-primary text-black text-[10px] md:text-xs font-black px-2 py-0.5 rounded shadow-lg">
                                            OP
                                        </div>
                                    </a>
                                ) : (
                                    <a href={getProfileLink(bet)} target="_blank" rel="noreferrer" className="w-20 h-20 md:w-32 md:h-32 rounded-xl bg-primary/20 flex items-center justify-center border-2 border-primary/30 flex-shrink-0 group/avatar block">
                                        <Swords className="w-8 h-8 md:w-12 md:h-12 text-primary group-hover/avatar:scale-110 transition-transform" />
                                    </a>
                                )}

                                {/* Prediction Info */}
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-xl md:text-3xl font-black text-white leading-none mb-2 truncate">
                                        <a href={getProfileLink(bet)} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors hover:underline">
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
                                    const yesPool = (bet?.participants?.yes || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
                                    const noPool = (bet?.participants?.no || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
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
                                    const yesPool = (bet?.participants?.yes || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
                                    const noPool = (bet?.participants?.no || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
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

                        {/* V6: Withdraw Seed Button (Creator Only, Void Markets Only) */}
                        {address && activeMarketData && activeMarketData[1] === address && activeMarketData[8] === true && !hasClaimed && (
                            <button
                                onClick={handleWithdrawSeed}
                                disabled={isSubmitting}
                                className="px-4 py-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold hover:bg-blue-500/20 transition-all flex items-center gap-2"
                                title="Withdraw your initial seed liquidity"
                            >
                                💰 Withdraw Seed
                            </button>
                        )}


                        {/* V5: Verify Button - For LOCKED, PROPOSED or OPEN+EXPIRED markets */}
                        {address && canVerify && activeMarketData && activeMarketData[1] !== '0x0000000000000000000000000000000000000000' ? (
                            <button
                                onClick={() => setShowVerificationModal(true)}
                                className={`px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${isMarketDisputed
                                    ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                                    : isMarketProposed
                                        ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500/20'
                                        : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                                    }`}
                                title={isMarketDisputed ? "Market is under dispute" : isMarketProposed ? "View verification status" : "Verify outcome"}
                            >
                                {isMarketDisputed ? <AlertTriangle className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                {isMarketDisputed ? 'Disputed' : isMarketProposed ? 'Verifying' : 'Verify'}
                            </button>
                        ) : (address && canVerify && activeMarketData && activeMarketData[1] === '0x0000000000000000000000000000000000000000') && (
                            <div className="px-4 py-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center gap-2" title="Not found on contract">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-sm font-bold">Off-Chain / V2</span>
                            </div>
                        )}

                        {canClaim ? (
                            <ClaimButton
                                amount={calculatedPayout > BigInt(0) ? (Number(calculatedPayout) / 1000000).toFixed(2) : (bet.initialValue ? (bet.initialValue / 1000000).toFixed(2) : '0.00')}
                                onClick={handleClaim}
                                loading={isSubmitting}
                                label={normalizedResult === 'void' ? 'CLAIM REFUND' : 'CLAIM WINNINGS'}
                                subtext={normalizedResult === 'void' ? 'FULL RETURN' : 'GET PAID'}
                            />
                        ) : (bet.status !== 'active' || Date.now() >= bet.expiresAt ? (
                            <div className="flex flex-col gap-2 w-full">
                                <ClaimButton
                                    amount={calculatedPayout > BigInt(0) ? (Number(calculatedPayout) / 1000000).toFixed(2) : '0.00'}
                                    onClick={() => { }}
                                    disabled={true}
                                    label={hasClaimed ? 'REWARD CLAIMED' : 'NOT ELIGIBLE'}
                                    subtext={hasClaimed ? 'RECEIVED' : 'YOU LOST'}
                                />
                                {!hasClaimed && calculatedPayout === BigInt(0) && (
                                    <div className="text-[10px] text-center text-red-500/60 font-medium px-2">
                                        Fair Play Policy: Dishonest verification attempts result in permanent bans.
                                    </div>
                                )}
                            </div>
                        ) : (isMarketProposed || isMarketDisputed) ? (
                            <div className="w-full flex flex-col gap-2">
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 animate-fade-in relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-2 relative z-10">
                                        <div className="flex items-center gap-2 text-yellow-500 font-bold">
                                            <Shield className="w-5 h-5" />
                                            <span>VERIFICATION IN PROGRESS</span>
                                        </div>
                                        <div className="text-2xl font-mono font-black text-white drop-shadow-md">
                                            {disputeTimer || 'Calculating...'}
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-3 relative z-10">
                                        {!canFinalize && <div className="h-full bg-yellow-500 animate-[progress_2s_ease-in-out_infinite] w-full origin-left" />}
                                        {canFinalize && <div className="h-full bg-green-500 w-full" />}
                                    </div>

                                    <div className="text-xs text-white/40 flex justify-between mb-4 relative z-10">
                                        <span>Observation Period (12h)</span>
                                        <span className={canFinalize ? 'text-green-400 font-bold' : 'text-yellow-500'}>
                                            {canFinalize ? 'WINDOW CLOSED' : 'DISPUTE WINDOW OPEN'}
                                        </span>
                                    </div>

                                    {canFinalize && (
                                        <button
                                            onClick={handleClaim}
                                            disabled={isSubmitting}
                                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg text-sm transition-colors shadow-lg shadow-green-500/20 animate-pulse flex items-center justify-center gap-2 mb-2 relative z-10"
                                        >
                                            ✅ Finalize & Enable Payouts
                                        </button>
                                    )}

                                    {/* Background Pulse */}
                                    <div className="absolute inset-0 bg-yellow-500/5 animate-pulse z-0 pointer-events-none"></div>
                                </div>

                                {parsedProposalInfo && (
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/60 font-bold uppercase">Proposed Result:</span>
                                            <span className={`font-black px-2 py-0.5 rounded text-sm ${parsedProposalInfo.proposedResult ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                                {parsedProposalInfo.proposedResult ? (bet.optionA?.label || 'YES') : (bet.optionB?.label || 'NO')}
                                            </span>
                                        </div>
                                        {parsedProposalInfo.evidenceUrl && (
                                            <a
                                                href={parsedProposalInfo.evidenceUrl.startsWith('http') ? parsedProposalInfo.evidenceUrl : `https://${parsedProposalInfo.evidenceUrl}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block w-full text-center py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg transition-colors font-bold flex items-center justify-center gap-2"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                REVIEW EVIDENCE
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsBattleModalOpen(true)}
                                className="w-full bg-primary hover:bg-white hover:text-black text-black font-black py-3 rounded-xl transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(255,95,31,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                JOIN BATTLE
                            </button>
                        ))}
                    </div>


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
                                                const yesPool = (bet?.participants?.yes || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
                                                const noPool = (bet?.participants?.no || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
                                                const initialSeed = bet.initialValue || 0;
                                                const seedPerSide = initialSeed / 2;

                                                // Dead Liquidity Visual


                                                // SIMULATE POST-BET STATE for accurate estimation
                                                const totalPoolBefore = yesPool + noPool + initialSeed;
                                                const mySideCurrent = choice === 'yes' ? yesPool : noPool;
                                                const mySideEffectiveBefore = mySideCurrent + seedPerSide;

                                                const totalPoolAfter = totalPoolBefore + numericAmount;
                                                const mySideEffectiveAfter = mySideEffectiveBefore + numericAmount;

                                                if (mySideEffectiveAfter <= 0) return (numericAmount * 1.75).toFixed(2);

                                                // Formula: (TotalPoolAfter * 0.80) / MySideEffectiveAfter
                                                // 80% goes to winners (10% house, 5% creator, 5% referrer/burn)

                                                const estimatedMultiplier = (totalPoolAfter * 0.80) / mySideEffectiveAfter;
                                                return (numericAmount * estimatedMultiplier).toFixed(2);
                                            })()}
                                            <span className="text-sm font-bold text-primary mb-1.5">
                                                ({(() => {
                                                    const yesPool = (bet?.participants?.yes || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
                                                    const noPool = (bet?.participants?.no || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
                                                    const initialSeed = bet.initialValue || 0;
                                                    const seedPerSide = initialSeed / 2;

                                                    // SIMULATE POST-BET STATE
                                                    const totalPoolBefore = yesPool + noPool + initialSeed;
                                                    const mySideCurrent = choice === 'yes' ? yesPool : noPool;
                                                    const mySideEffectiveBefore = mySideCurrent + seedPerSide;

                                                    const totalPoolAfter = totalPoolBefore + parseFloat(amount || '0');
                                                    const mySideEffectiveAfter = mySideEffectiveBefore + parseFloat(amount || '0');

                                                    if (mySideEffectiveAfter <= 0) return '1.75';

                                                    const estimatedMultiplier = (totalPoolAfter * 0.80) / mySideEffectiveAfter;
                                                    return estimatedMultiplier.toFixed(2);
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
                reporterReward={(() => {
                    const yesPool = (bet?.participants?.yes || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
                    const noPool = (bet?.participants?.no || []).reduce((a: any, b: any) => a + (b.amount || 0), 0);
                    const initialSeed = bet.initialValue || 0;
                    const totalPool = BigInt(Math.floor((yesPool + noPool + initialSeed) * 1000000)); // Convert to 6 decimals
                    return (totalPool * BigInt(1)) / BigInt(100); // 1% Reward
                })()}
                currentState={marketStateV5}
                proposalInfo={parsedProposalInfo}
                optionALabel={bet.optionA?.label || 'YES'}
                optionBLabel={bet.optionB?.label || 'NO'}
                onSuccess={() => {
                    refetchProposalInfo();
                    if (refetchMarketStruct) refetchMarketStruct();
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
