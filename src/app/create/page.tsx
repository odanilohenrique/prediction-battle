'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Target, Calendar, DollarSign, Users, Info, Link as LinkIcon, Edit3, Droplets, Sparkles, Sword, Upload, Clock } from 'lucide-react';
import Link from 'next/link';
import { useAccount, useWriteContract, usePublicClient, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';

import { isAdmin, CURRENT_CONFIG } from '@/lib/config';
import PredictionBattleABI from '@/lib/abi/PredictionBattle.json';

// Extended bet types
type BetType =
    | 'post_count'
    | 'likes_total'
    | 'followers_gain'
    | 'emoji_count'
    | 'mentions'
    | 'quotes'
    | 'reply_marathon'
    | 'thread_length'
    | 'controversial'
    | 'word_mentions'
    | 'comment_count'
    | 'ratio'       // Viral
    | 'custom_text'; // Chaos

type Timeframe = '30m' | '6h' | '12h' | '24h' | '7d' | 'none';

const BET_TYPE_CONFIG: Record<BetType, { label: string; icon: string; targetLabel: string; description: string; hasTarget: boolean }> = {
    post_count: { label: 'Number of Posts', icon: '📝', targetLabel: 'posts', description: 'Total new casts posted', hasTarget: true },
    likes_total: { label: 'Total Likes', icon: '❤️', targetLabel: 'likes', description: 'Combined likes on all casts', hasTarget: true },
    followers_gain: { label: 'Follower Gain', icon: '👥', targetLabel: 'new followers', description: 'New followers gained', hasTarget: true },
    emoji_count: { label: 'Emoji Mania', icon: '🔥', targetLabel: 'emojis', description: 'Total emojis used', hasTarget: true },
    mentions: { label: '@ Mentions', icon: '@️', targetLabel: 'mentions', description: 'Times mentioned by others', hasTarget: true },
    quotes: { label: 'Quote King', icon: '💬', targetLabel: 'quotes', description: 'Times post was quoted', hasTarget: true },
    reply_marathon: { label: 'Reply Marathon', icon: '💬', targetLabel: 'replies', description: 'Most replies wins', hasTarget: false },
    thread_length: { label: 'Thread Master', icon: '🧵', targetLabel: 'posts in thread', description: 'Longest thread wins', hasTarget: false },
    controversial: { label: 'Controversy', icon: '🌶️', targetLabel: 'controversy', description: 'Most controversial wins', hasTarget: false },
    word_mentions: { label: 'Word Count', icon: '🔤', targetLabel: 'word mentions', description: 'Who says it more?', hasTarget: false },
    comment_count: { label: 'Comments', icon: '💬', targetLabel: 'comments', description: 'Total comments received', hasTarget: true },
    ratio: { label: 'Ratio Detector', icon: '📉', targetLabel: 'ratio', description: 'Will they get ratioed?', hasTarget: false },
    custom_text: { label: 'Custom Prediction', icon: '⚡', targetLabel: '', description: 'Fully customizable', hasTarget: false },
};

const TIMEFRAME_CONFIG: Record<Timeframe, { label: string; shortLabel: string }> = {
    '30m': { label: '30 Minutes', shortLabel: '30m' },
    '6h': { label: '6 Hours', shortLabel: '6h' },
    '12h': { label: '12 Hours', shortLabel: '12h' },
    '24h': { label: '24 Hours', shortLabel: '24h' },
    '7d': { label: '7 Days', shortLabel: '7d' },
    'none': { label: 'Indefinite', shortLabel: '∞' },
};

// Popular Farcaster users for quick selection
const POPULAR_PLAYERS = [
    { username: 'jessepollak', displayName: 'Jesse Pollak', pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/6a45e644-86a9-4562-cc01-7a1957a52f00/rectcrop3' },
    { username: 'dwr.eth', displayName: 'Dan Romero', pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/63c0b18e-04c7-4989-1e5e-5c5c6d8d3800/rectcrop3' },
    { username: 'vitalik.eth', displayName: 'Vitalik Buterin', pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/d086a788-ce0c-4c14-8f8b-d19af82c8c00/rectcrop3' },
    { username: 'barmstrong', displayName: 'Brian Armstrong', pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/9a0f4f24-e16b-4cc9-5a64-e9a2a9c5ec00/rectcrop3' },
    { username: 'clanker', displayName: 'Clanker', pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/a1c0c3c8-40b8-40f8-d832-cbb19c7a9200/rectcrop3' },
    { username: 'pugson', displayName: 'Pugson', pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/0199d51f-6d9b-4e6e-69d2-5c54cc076100/rectcrop3' },
];

// Helper to merge API players
async function getPlayersList() {
    try {
        const res = await fetch(`/api/admin/players?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Pragma': 'no-cache' }
        });
        const data = await res.json();
        if (data.success && data.players.length > 0) {
            return data.players;
        }
    } catch (e) {
        console.error('Failed to load players', e);
    }
    return POPULAR_PLAYERS;
}

import { useModal } from '@/providers/ModalProvider';

// ... (keep top imports if needed, but I can just add this hook inside the component)

export default function CreateCommunityBet() {
    const { showModal, showAlert, closeModal } = useModal();
    const router = useRouter();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [creationMode, setCreationMode] = useState<'prediction' | 'battle'>('battle');
    const [savedPlayers, setSavedPlayers] = useState<any[]>(POPULAR_PLAYERS);
    const [showAllPlayers, setShowAllPlayers] = useState(false);
    const [showAllPlayersA, setShowAllPlayersA] = useState(false);
    const [showAllPlayersB, setShowAllPlayersB] = useState(false);

    // Wagmi hooks - FIXED ReferenceError
    const { address, isConnected, chainId } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const { switchChainAsync } = useSwitchChain();
    const publicClient = usePublicClient();

    // Configuration
    const IS_MAINNET = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
    const EXPECTED_CHAIN_ID = IS_MAINNET ? 8453 : 84532;
    const USDC_ADDRESS = IS_MAINNET
        ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
    const HOUSE_ADDRESS = process.env.NEXT_PUBLIC_RECEIVER_ADDRESS || '0x2Cd0934AC31888827C3711527eb2e0276f3B66b4';

    const [formData, setFormData] = useState({
        // User info
        username: '',
        displayName: '',
        pfpUrl: '',

        // Bet config
        betType: 'post_count' as BetType,
        targetValue: 3,
        timeframe: '24h' as Timeframe,
        castUrl: '',

        // Limits & Econ
        minBet: 0.1, // Community default
        maxBet: 10,  // Community max

        // Metadata
        rules: '',

        // Custom
        predictionQuestion: '',
        battleQuestion: '',
        wordToMatch: '',

        // Versus
        isVersus: false,
        optionA: { label: '', imageUrl: '', referenceUrl: '' },
        optionB: { label: '', imageUrl: '', referenceUrl: '' },

        // New Features
        predictionImage: '',
        noTargetValue: false,
        autoVerify: false,
    });

    const currentBetType = BET_TYPE_CONFIG[formData.betType];
    const requiredSeedPerSide = formData.maxBet; // Logic: creator seeds max possible win pool? Or just max bet? In admin it was maxBet.
    const totalRequiredSeed = requiredSeedPerSide * 2;

    // Load players
    useEffect(() => {
        getPlayersList().then(setSavedPlayers);
    }, []);

    // Clear specific fields when switching modes
    useEffect(() => {
        if (creationMode === 'battle') {
            setFormData(prev => ({ ...prev, castUrl: '', predictionQuestion: '' }));
        } else {
            setFormData(prev => ({ ...prev, battleQuestion: '', optionA: { ...prev.optionA, label: '' }, optionB: { ...prev.optionB, label: '' } }));
        }
    }, [creationMode]);

    // Auto-fill logic
    useEffect(() => {
        if (!formData.username) return;
        const foundPlayer = savedPlayers.find(p => p.username.toLowerCase() === formData.username.toLowerCase());
        if (foundPlayer) {
            setFormData(prev => ({
                ...prev,
                displayName: foundPlayer.displayName,
                pfpUrl: foundPlayer.pfpUrl
            }));
        }
    }, [formData.username, savedPlayers]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        console.log('Submit Triggered');

        if (!isConnected || !address) {
            console.log('Wallet not connected');
            showAlert('Wallet Required', 'Please connect your wallet to create a battle.', 'warning');
            return;
        }

        setIsSubmitting(true);

        try {
            // 0. Verify Network
            if (chainId !== EXPECTED_CHAIN_ID) {
                try {
                    if (switchChainAsync) {
                        await switchChainAsync({ chainId: EXPECTED_CHAIN_ID });
                    }
                } catch (error) {
                    showAlert('Wrong Network', 'Please switch to Base.', 'error');
                    setIsSubmitting(false);
                    return;
                }
            }

            // 1. Send USDC Transaction (Seeding)
            console.log('Sending seed transaction...');
            const totalSeedWei = parseUnits(totalRequiredSeed.toString(), 6);

            let hash;
            try {
                hash = await writeContractAsync({
                    address: USDC_ADDRESS as `0x${string}`,
                    abi: [{
                        name: 'transfer',
                        type: 'function',
                        stateMutability: 'nonpayable',
                        inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
                        outputs: [{ name: '', type: 'bool' }]
                    }],
                    functionName: 'transfer',
                    args: [HOUSE_ADDRESS as `0x${string}`, totalSeedWei],
                    gas: BigInt(1000000),
                });
            } catch (err) {
                // Check if user rejected
                setIsSubmitting(false);
                return;
            }

            console.log('Tx sent:', hash);
            // Non-blocking notification
            showModal({
                title: 'Transaction Sent',
                message: 'Waiting for blockchain confirmation...',
                type: 'info',
                confirmText: 'Okay'
            });

            if (!publicClient) throw new Error("Public Client missing");
            const receipt = await publicClient.waitForTransactionReceipt({
                hash,
                timeout: 60000 // 60s timeout to prevent viem errors
            });

            if (receipt.status !== 'success') {
                throw new Error('Transaction failed on-chain.');
            }

            // Update modal to success + processing
            showModal({
                title: 'Confirmed!',
                message: 'Transaction confirmed on blockchain. Finalizing...',
                type: 'success',
                confirmText: 'Okay'
            });

            // 2. Prepare Data
            console.log('Creating prediction...');
            let finalQuestion = '';
            let username = formData.username;

            if (creationMode === 'battle') {
                finalQuestion = formData.battleQuestion;
                username = `${formData.optionA.label} vs ${formData.optionB.label}`;

                // Save players logic (silent)
                try {
                    if (formData.optionA.label) {
                        await fetch('/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: formData.optionA.label, pfpUrl: formData.optionA.imageUrl }) }).catch(() => { });
                    }
                    if (formData.optionB.label) {
                        await fetch('/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: formData.optionB.label, pfpUrl: formData.optionB.imageUrl }) }).catch(() => { });
                    }
                } catch (err) { console.warn("Player save error ignored:", err); }

            } else if (formData.betType === 'custom_text') {
                finalQuestion = formData.predictionQuestion;
            } else if (formData.betType === 'ratio') {
                finalQuestion = `Will @${formData.username || 'user'} get RATIOED (Replies > Likes)?`;
            } else {
                finalQuestion = `Will @${formData.username || 'user'} hit ${formData.targetValue} ${currentBetType?.targetLabel || ''}?`;
            }

            // 3. MAIN API CALL
            const response = await fetch('/api/predictions/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    betAmount: totalRequiredSeed,
                    userAddress: address,
                    initialValue: 0,
                    maxEntrySize: formData.maxBet,
                    minBet: formData.minBet,
                    displayName: creationMode === 'battle' ? 'Battle Master' : formData.displayName,
                    pfpUrl: formData.pfpUrl || '',
                    timeframe: formData.timeframe,
                    castHash: `battle-${Date.now()}`,
                    castAuthor: username,
                    castText: finalQuestion,
                    metric: creationMode === 'battle' ? 'versus_battle' : formData.betType,
                    targetValue: formData.noTargetValue || formData.betType === 'custom_text' ? 0 : (formData.betType === 'ratio' || creationMode === 'battle' ? 1 : formData.targetValue),
                    choice: 'seed',
                    isVersus: creationMode === 'battle' || formData.isVersus,
                    optionA: creationMode === 'battle' ? formData.optionA : undefined,
                    optionB: creationMode === 'battle' ? formData.optionB : undefined,
                    predictionImage: formData.predictionImage,
                    castUrl: formData.castUrl,
                    rules: formData.rules,
                    autoVerify: formData.autoVerify,
                }),
            });

            console.log('API Response Status:', response.status);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Server returned failure.');
            }

            console.log('[CREATE PAGE] Bet created with ID:', data.predictionId);

            // 4. Create Prediction on Smart Contract (REQUIRED for betting to work)
            if (CURRENT_CONFIG.contractAddress && data.predictionId) {
                try {
                    console.log('[CREATE PAGE] Creating on-chain prediction...');
                    console.log('[CREATE PAGE] Contract Address:', CURRENT_CONFIG.contractAddress);
                    console.log('[CREATE PAGE] Prediction ID:', data.predictionId);

                    const TIMEFRAME_SECONDS: Record<string, number> = {
                        '30m': 1800, '6h': 21600, '12h': 43200, '24h': 86400, '7d': 604800, 'none': 31536000
                    };
                    const duration = TIMEFRAME_SECONDS[formData.timeframe] || 86400;
                    const targetVal = formData.noTargetValue || formData.betType === 'custom_text' ? 0 : formData.targetValue;

                    const contractHash = await writeContractAsync({
                        address: CURRENT_CONFIG.contractAddress as `0x${string}`,
                        abi: PredictionBattleABI.abi,
                        functionName: 'createPrediction',
                        args: [data.predictionId, BigInt(targetVal), BigInt(duration)],
                        gas: BigInt(500000), // Explicit gas limit
                    });
                    console.log('[CREATE PAGE] On-chain creation tx:', contractHash);

                    if (publicClient) {
                        const receipt = await publicClient.waitForTransactionReceipt({
                            hash: contractHash,
                            timeout: 60000
                        });
                        if (receipt.status !== 'success') {
                            throw new Error('Contract transaction reverted');
                        }
                        console.log('[CREATE PAGE] On-chain creation confirmed!');
                    }
                } catch (contractError: any) {
                    console.error('[CREATE PAGE] Contract creation failed:', contractError);
                    const errorMsg = contractError?.shortMessage || contractError?.message || 'Unknown error';
                    showAlert('On-Chain Creation Failed', `Bet was saved to DB but NOT created on blockchain: ${errorMsg}. Users will NOT be able to bet on this.`, 'error');
                    // Don't proceed - this is a critical failure
                    setIsSubmitting(false);
                    return;
                }
            }

            // Final Success Modal with redirect callback
            showModal({
                title: 'BATTLE CREATED!',
                message: 'Your battle is now live in the arena.',
                type: 'success',
                confirmText: 'Go to Arena',
                onConfirm: () => {
                    closeModal(); // Must close explicitly
                    router.push('/');
                    router.refresh(); // Ensure data reloads
                }
            });

        } catch (error) {
            console.error('Error creating bet:', error);
            showAlert('Error', (error as Error).message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }


    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-textSecondary hover:text-textPrimary transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Arena
                </Link>

                <h1 className="text-3xl font-bold text-textPrimary mb-2">
                    Create Community Battle
                </h1>
                <p className="text-textSecondary">
                    Launch a viral market. You provide the seed liquidity, you set the rules.
                </p>
            </div>

            {/* Mode Switcher Removed - Defaulting to Battle Mode for Public Page */}
            {/* <div className="flex p-1 bg-white/5 rounded-xl mb-8 border border-white/5">...</div> */}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* ===================== BATTLE MODE ===================== */}
                {creationMode === 'battle' && (
                    <>
                        {/* Battle Question */}
                        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-2 border-red-500/30 rounded-2xl p-6">
                            <label className="block text-sm font-medium text-white mb-4">
                                <div className="flex items-center gap-2">
                                    <Sword className="w-5 h-5 text-red-500" />
                                    ⚔️ Battle Question
                                </div>
                            </label>
                            <textarea
                                value={formData.battleQuestion}
                                onChange={(e) => setFormData({ ...formData, battleQuestion: e.target.value, betType: 'custom_text' })}
                                className="w-full bg-black/30 border border-red-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 min-h-[80px] text-lg"
                                placeholder="Who will post the longest thread first?"
                                required
                            />
                        </div>

                        {/* Player A vs Player B Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Player A */}
                            <div className="bg-green-500/5 border-2 border-green-500/30 rounded-2xl p-6">
                                <h3 className="text-lg font-black text-green-500 mb-4 flex items-center gap-2">
                                    (Player 1)
                                </h3>
                                <div className="space-y-4">
                                    {/* Quick Select */}
                                    <div>
                                        <label className="text-xs text-white/60 mb-1 block">Quick Select</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(showAllPlayersA ? savedPlayers : savedPlayers.slice(0, 3)).map((player) => (
                                                <button
                                                    key={player.username}
                                                    type="button"
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        isVersus: true,
                                                        optionA: {
                                                            ...formData.optionA,
                                                            label: player.username,
                                                            imageUrl: player.pfpUrl
                                                        }
                                                    })}
                                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all ${formData.optionA.label === player.username ? 'border-green-500 bg-green-500/20' : 'border-white/10 hover:border-green-500/50'}`}
                                                >
                                                    <img
                                                        src={player.pfpUrl}
                                                        alt=""
                                                        className="w-5 h-5 rounded-full object-cover"
                                                        onError={(e) => (e.currentTarget.src = 'https://link.warpcast.com/api/avatar/default.png')}
                                                    />
                                                    <span className="text-white/80">{player.username}</span>
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setShowAllPlayersA(!showAllPlayersA)}
                                                className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-xs text-textSecondary hover:bg-white/10 transition-all"
                                            >
                                                {showAllPlayersA ? 'Show Less' : 'Others...'}
                                            </button>

                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/60 mb-1 block">Username (or type custom) *</label>
                                        <input
                                            type="text"
                                            value={formData.optionA.label}
                                            onChange={(e) => setFormData({ ...formData, isVersus: true, optionA: { ...formData.optionA, label: e.target.value } })}
                                            className="w-full bg-black/30 border border-green-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                                            placeholder="jessepollak"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/60 mb-1 block">Avatar URL (Optional)</label>
                                        <input
                                            type="url"
                                            value={formData.optionA.imageUrl}
                                            onChange={(e) => setFormData({ ...formData, optionA: { ...formData.optionA, imageUrl: e.target.value } })}
                                            className="w-full bg-black/30 border border-green-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                                            placeholder="https://..."
                                        />
                                        <div className="text-center text-xs text-white/40 my-2">- OR -</div>
                                        <label className="block w-full text-center py-2 px-3 border border-dashed border-green-500/30 rounded-lg cursor-pointer hover:bg-green-500/10 transition-colors">
                                            <span className="text-xs text-green-500 font-bold">Upload Image</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        if (file.size > 500000) {
                                                            alert('Image too large! Max 500KB.');
                                                            return;
                                                        }
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                isVersus: true,
                                                                optionA: { ...prev.optionA, imageUrl: reader.result as string }
                                                            }));
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                    {/* Player A Reference Link */}
                                    <div>
                                        <label className="text-xs text-white/60 mb-1 flex items-center gap-1">
                                            <LinkIcon className="w-3 h-3" /> Reference Link (Optional)
                                        </label>
                                        <input
                                            type="url"
                                            value={(formData.optionA as any).referenceUrl || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                optionA: { ...formData.optionA, referenceUrl: e.target.value } as any
                                            })}
                                            className="w-full bg-black/30 border border-green-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                                            placeholder="https://warpcast.com/..."
                                        />
                                    </div>
                                    {formData.optionA.imageUrl && (
                                        <div className="flex items-center gap-3">
                                            <img src={formData.optionA.imageUrl} alt="A" className="w-12 h-12 rounded-full object-cover border-2 border-green-500/50" />
                                            <span className="text-sm text-white/60">Preview</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Player B */}
                            <div className="bg-red-500/5 border-2 border-red-500/30 rounded-2xl p-6">
                                <h3 className="text-lg font-black text-red-500 mb-4 flex items-center gap-2">
                                    (Player 2)
                                </h3>
                                <div className="space-y-4">
                                    {/* Quick Select */}
                                    <div>
                                        <label className="text-xs text-white/60 mb-1 block">Quick Select</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(showAllPlayersB ? savedPlayers : savedPlayers.slice(0, 3)).map((player) => (
                                                <button
                                                    key={player.username}
                                                    type="button"
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        isVersus: true,
                                                        optionB: {
                                                            ...formData.optionB,
                                                            label: player.username,
                                                            imageUrl: player.pfpUrl
                                                        }
                                                    })}
                                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all ${formData.optionB.label === player.username ? 'border-red-500 bg-red-500/20' : 'border-white/10 hover:border-red-500/50'}`}
                                                >
                                                    <img
                                                        src={player.pfpUrl}
                                                        alt=""
                                                        className="w-5 h-5 rounded-full object-cover"
                                                        onError={(e) => (e.currentTarget.src = 'https://link.warpcast.com/api/avatar/default.png')}
                                                    />
                                                    <span className="text-white/80">{player.username}</span>
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setShowAllPlayersB(!showAllPlayersB)}
                                                className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-xs text-textSecondary hover:bg-white/10 transition-all"
                                            >
                                                {showAllPlayersB ? 'Show Less' : 'Others...'}
                                            </button>

                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/60 mb-1 block">Username (or type custom) *</label>
                                        <input
                                            type="text"
                                            value={formData.optionB.label}
                                            onChange={(e) => setFormData({ ...formData, isVersus: true, optionB: { ...formData.optionB, label: e.target.value } })}
                                            className="w-full bg-black/30 border border-red-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500"
                                            placeholder="vitalik"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/60 mb-1 block">Avatar URL (Optional)</label>
                                        <input
                                            type="url"
                                            value={formData.optionB.imageUrl}
                                            onChange={(e) => setFormData({ ...formData, optionB: { ...formData.optionB, imageUrl: e.target.value } })}
                                            className="w-full bg-black/30 border border-red-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500"
                                            placeholder="https://..."
                                        />
                                        <div className="text-center text-xs text-white/40 my-2">- OR -</div>
                                        <label className="block w-full text-center py-2 px-3 border border-dashed border-red-500/30 rounded-lg cursor-pointer hover:bg-red-500/10 transition-colors">
                                            <span className="text-xs text-red-500 font-bold">Upload Image</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        if (file.size > 500000) {
                                                            showAlert('File Too Large', 'Image must be under 500KB.', 'error');
                                                            return;
                                                        }
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                isVersus: true,
                                                                optionB: { ...prev.optionB, imageUrl: reader.result as string }
                                                            }));
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                    {/* Player B Reference Link */}
                                    <div>
                                        <label className="text-xs text-white/60 mb-1 flex items-center gap-1">
                                            <LinkIcon className="w-3 h-3" /> Reference Link (Optional)
                                        </label>
                                        <input
                                            type="url"
                                            value={(formData.optionB as any).referenceUrl || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                optionB: { ...formData.optionB, referenceUrl: e.target.value } as any
                                            })}
                                            className="w-full bg-black/30 border border-red-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500"
                                            placeholder="https://warpcast.com/..."
                                        />
                                    </div>
                                    {formData.optionB.imageUrl && (
                                        <div className="flex items-center gap-3">
                                            <img src={formData.optionB.imageUrl} alt="B" className="w-12 h-12 rounded-full object-cover border-2 border-red-500/50" />
                                            <span className="text-sm text-white/60">Preview</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Battle Configuration (Limits, Rules) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            {/* Rules */}
                            <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                                <label className="block text-sm font-medium text-textPrimary mb-3">
                                    <div className="flex items-center gap-2">
                                        <Info className="w-4 h-4 text-blue-400" />
                                        Battle Rules
                                    </div>
                                </label>
                                <textarea
                                    value={formData.rules}
                                    onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 min-h-[80px] text-sm"
                                    placeholder="e.g. Winner is determined by most likes at 24h market close."
                                />
                            </div>
                        </div>


                        {/* Battle Duration */}
                        <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                            <label className="block text-sm font-medium text-white mb-3">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-orange-500" />
                                    Battle Duration
                                </div>
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {(Object.keys(TIMEFRAME_CONFIG) as Timeframe[]).map((tf) => (
                                    <button
                                        key={tf}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, timeframe: tf })}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${formData.timeframe === tf
                                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                            : 'bg-black/30 text-white/40 hover:text-white hover:bg-white/10'
                                            }`}
                                    >
                                        {TIMEFRAME_CONFIG[tf].shortLabel}
                                    </button>
                                ))}
                            </div>
                        </div>



                        {/* Limits for Battle */}
                        <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                            <label className="block text-sm font-medium text-white mb-3">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-green-500" />
                                    Bet Limits (USDC)
                                </div>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-white/40 mb-1 block">Min Bet</label>
                                    <input
                                        type="number"
                                        value={formData.minBet}
                                        onChange={(e) => setFormData({ ...formData, minBet: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-500"
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-white/40 mb-1 block">Max Bet</label>
                                    <input
                                        type="number"
                                        value={formData.maxBet}
                                        onChange={(e) => setFormData({ ...formData, maxBet: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-500"
                                        step="1"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Battle Preview */}
                        {formData.optionA.label && formData.optionB.label && (
                            <div className="bg-black/40 border border-white/10 rounded-3xl p-8 text-center mt-6">
                                <div className="text-sm text-white/40 uppercase tracking-[0.2em] mb-6 font-bold">Battle Preview</div>
                                <div className="flex items-center justify-center gap-8 md:gap-12">
                                    <div className="flex flex-col items-center gap-3 group">
                                        <div className="relative">
                                            {formData.optionA.imageUrl ? (
                                                <img
                                                    src={formData.optionA.imageUrl}
                                                    alt=""
                                                    className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)] transition-transform group-hover:scale-105"
                                                    onError={(e) => (e.currentTarget.src = 'https://link.warpcast.com/api/avatar/default.png')}
                                                />
                                            ) : (
                                                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-green-500/20 flex items-center justify-center text-4xl border-4 border-green-500/50">🟢</div>
                                            )}
                                            {/* Player 1 Badge Removed */}
                                        </div>
                                        <span className="mt-2 text-xl md:text-2xl font-black text-white tracking-tight">{formData.optionA.label}</span>
                                    </div>

                                    <div className="flex flex-col items-center animate-pulse">
                                        <span className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 italic pr-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                                            VS
                                        </span>
                                    </div>

                                    <div className="flex flex-col items-center gap-3 group">
                                        <div className="relative">
                                            {formData.optionB.imageUrl ? (
                                                <img
                                                    src={formData.optionB.imageUrl}
                                                    alt=""
                                                    className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-transform group-hover:scale-105"
                                                    onError={(e) => (e.currentTarget.src = 'https://link.warpcast.com/api/avatar/default.png')}
                                                />
                                            ) : (
                                                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-red-500/20 flex items-center justify-center text-4xl border-4 border-red-500/50">🔴</div>
                                            )}
                                            {/* Player 2 Badge Removed */}
                                        </div>
                                        <span className="mt-2 text-xl md:text-2xl font-black text-white tracking-tight">{formData.optionB.label}</span>
                                    </div>
                                </div>
                                <div className="mt-8 bg-white/5 rounded-xl p-4 inline-block max-w-2xl w-full border border-white/5">
                                    <p className="text-white/90 text-lg font-medium italic">"{formData.battleQuestion || 'Your question here...'}"</p>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ===================== PREDICTION MODE ===================== */}
                {creationMode === 'prediction' && (
                    <>
                        <div className="bg-surface border border-darkGray rounded-2xl p-6">
                            <label className="block text-sm font-medium text-textPrimary mb-4">
                                <div className="flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    Target User
                                </div>
                            </label>

                            {/* Quick Select for Target User (Added) */}
                            <div className="mb-4">
                                <label className="text-xs text-textSecondary mb-2 block">Quick Select</label>
                                <div className="flex flex-wrap gap-2">
                                    {(showAllPlayers ? savedPlayers : savedPlayers.slice(0, 5)).map((player) => (
                                        <button
                                            key={player.username}
                                            type="button"
                                            onClick={() => setFormData({
                                                ...formData,
                                                username: player.username,
                                                displayName: player.displayName,
                                                pfpUrl: player.pfpUrl
                                            })}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${formData.username === player.username
                                                ? 'border-primary bg-primary/20'
                                                : 'border-white/10 hover:border-primary/50'
                                                }`}
                                        >
                                            <img
                                                src={player.pfpUrl}
                                                alt=""
                                                className="w-5 h-5 rounded-full object-cover"
                                                onError={(e) => (e.currentTarget.src = 'https://link.warpcast.com/api/avatar/default.png')}
                                            />
                                            <span className="text-white/80">{player.displayName}</span>
                                        </button>
                                    ))}

                                    {savedPlayers.length > 5 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAllPlayers(!showAllPlayers)}
                                            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-textSecondary hover:bg-white/10 transition-all flex items-center gap-1"
                                        >
                                            {showAllPlayers ? 'Show Less' : `+ ${savedPlayers.length - 5} Others`}
                                        </button>
                                    )}

                                    {formData.username && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData({
                                                ...formData,
                                                username: '',
                                                displayName: '',
                                                pfpUrl: ''
                                            })}
                                            className="px-2 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 text-xs hover:bg-red-500/20"
                                        >
                                            ✕ Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs text-textSecondary mb-1 block">Username *</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value.replace('@', '') })}
                                        className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                                        placeholder="jessepollak"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-textSecondary mb-1 block">Display Name (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.displayName}
                                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                        className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                                        placeholder="Jesse Pollak"
                                    />
                                </div>
                                <div>
                                    <div>
                                        <label className="text-xs text-textSecondary mb-1 block">Avatar Source</label>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <input
                                                    type="url"
                                                    value={formData.pfpUrl}
                                                    onChange={(e) => setFormData({ ...formData, pfpUrl: e.target.value })}
                                                    className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary text-sm"
                                                    placeholder="Paste Image URL..."
                                                />
                                            </div>
                                            <label className="cursor-pointer bg-darkGray border border-darkGray hover:border-primary hover:bg-white/5 rounded-xl px-6 py-3 text-textPrimary transition-all flex items-center justify-center gap-2 whitespace-nowrap min-w-[120px]">
                                                <Upload className="w-4 h-4" />
                                                <span className="text-sm font-bold">Upload</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                setFormData({ ...formData, pfpUrl: reader.result as string });
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {formData.pfpUrl && (
                                        <div className="mt-4 flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/30">
                                                <img
                                                    src={formData.pfpUrl}
                                                    alt="Preview"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                                />
                                            </div>
                                            <span className="text-sm text-textSecondary">Preview</span>
                                        </div>
                                    )}

                                    {/* Cast URL Removed as requested */}
                                </div>
                            </div>
                        </div>

                        {/* 2. Bet Type */}
                        <div className="bg-surface border border-darkGray rounded-2xl p-6">
                            <label className="block text-sm font-medium text-textPrimary mb-4">
                                <div className="flex items-center gap-2">
                                    <Target className="w-5 h-5 text-primary" />
                                    Prediction Mode
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="noTarget"
                                        checked={formData.noTargetValue}
                                        onChange={(e) => setFormData({ ...formData, noTargetValue: e.target.checked })}
                                        className="rounded border-darkGray bg-black/20 text-primary focus:ring-primary"
                                    />
                                    <label htmlFor="noTarget" className="text-xs text-textSecondary font-normal">
                                        Subjective / No Target Value
                                    </label>
                                </div>
                            </label>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {(Object.keys(BET_TYPE_CONFIG) as BetType[]).map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, betType: type })}
                                        className={`p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden ${formData.betType === type
                                            ? 'border-primary bg-primary/10'
                                            : 'border-darkGray hover:border-darkGray/50'
                                            }`}
                                    >
                                        <div className="text-2xl mb-1">{BET_TYPE_CONFIG[type].icon}</div>
                                        <div className="text-sm font-medium text-textPrimary">
                                            {BET_TYPE_CONFIG[type].label}
                                        </div>
                                        <div className="text-xs text-textSecondary mt-1 leading-tight">
                                            {BET_TYPE_CONFIG[type].description}
                                        </div>
                                        {type === 'ratio' && <div className="absolute top-0 right-0 bg-red-500/20 text-red-500 text-[10px] px-2 py-0.5 font-bold rounded-bl-lg">LIVE</div>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Custom Question & Versus Options */}
                        {formData.betType === 'custom_text' && (
                            <div className="bg-surface border border-darkGray rounded-2xl p-6 animate-fade-in">
                                <label className="block text-sm font-medium text-textPrimary mb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            ✍️ Custom Prediction
                                        </div>
                                    </div>
                                </label>
                                <textarea
                                    value={formData.predictionQuestion}
                                    onChange={(e) => setFormData({ ...formData, predictionQuestion: e.target.value })}
                                    className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary min-h-[100px] text-lg mb-4"
                                    placeholder="e.g. Who will win: Farcaster or Lens?"
                                    required
                                />

                                {formData.isVersus && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 p-4 bg-black/20 rounded-xl border border-darkGray/50">
                                        <div>
                                            <h4 className="font-bold text-green-500 mb-2">Option A (YES Pool)</h4>
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    placeholder="Label (e.g. Farcaster)"
                                                    value={formData.optionA.label}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        optionA: { ...formData.optionA, label: e.target.value }
                                                    })}
                                                    className="w-full bg-darkGray border border-darkGray rounded-lg px-3 py-2 text-sm text-textPrimary"
                                                />
                                                <input
                                                    type="url"
                                                    placeholder="Image URL (Optional)"
                                                    value={formData.optionA.imageUrl}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        optionA: { ...formData.optionA, imageUrl: e.target.value }
                                                    })}
                                                    className="w-full bg-darkGray border border-darkGray rounded-lg px-3 py-2 text-sm text-textPrimary"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-red-500 mb-2">Option B (NO Pool)</h4>
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    placeholder="Label (e.g. Lens)"
                                                    value={formData.optionB.label}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        optionB: { ...formData.optionB, label: e.target.value }
                                                    })}
                                                    className="w-full bg-darkGray border border-darkGray rounded-lg px-3 py-2 text-sm text-textPrimary"
                                                />
                                                <input
                                                    type="url"
                                                    placeholder="Image URL (Optional)"
                                                    value={formData.optionB.imageUrl}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        optionB: { ...formData.optionB, imageUrl: e.target.value }
                                                    })}
                                                    className="w-full bg-darkGray border border-darkGray rounded-lg px-3 py-2 text-sm text-textPrimary"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Word Mention Field */}
                        {formData.betType === 'word_mentions' && (
                            <div className="bg-surface border border-darkGray rounded-2xl p-6 animate-fade-in">
                                <label className="block text-sm font-medium text-textPrimary mb-3">
                                    <div className="flex items-center gap-2">
                                        🔤 Word(s) to Track
                                    </div>
                                </label>
                                <input
                                    type="text"
                                    value={formData.wordToMatch}
                                    onChange={(e) => setFormData({ ...formData, wordToMatch: e.target.value })}
                                    className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                                    placeholder="e.g., based"
                                    required
                                />
                            </div>
                        )}

                        {/* Target Cast URL (Optional for context) */}
                        <div className="bg-surface border border-darkGray rounded-2xl p-6">
                            <label className="block text-sm font-medium text-textPrimary mb-3">
                                <div className="flex items-center gap-2">
                                    <LinkIcon className="w-5 h-5 text-primary" />
                                    Target Cast / Post URL (Optional)
                                </div>
                            </label>
                            <input
                                type="url"
                                value={formData.castUrl}
                                onChange={(e) => setFormData({ ...formData, castUrl: e.target.value })}
                                className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                                placeholder="https://warpcast.com/..."
                            />
                            <p className="text-xs text-textSecondary mt-2">
                                Provide a link to the specific post for context (displayed on the card).
                            </p>
                        </div>

                        {/* 4. Target & Timeframe */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {(currentBetType.hasTarget || formData.betType === 'custom_text') && !formData.noTargetValue && (
                                <div className="bg-surface border border-darkGray rounded-2xl p-6">
                                    <label className="block text-sm font-medium text-textPrimary mb-3">
                                        Target Value
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.targetValue}
                                        onChange={(e) => setFormData({ ...formData, targetValue: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary text-2xl font-bold"
                                        min={1}
                                        required={!formData.noTargetValue}
                                    />
                                    <p className="text-sm text-primary mt-2 font-medium">
                                        {formData.targetValue}+ {currentBetType.targetLabel}
                                    </p>
                                </div>
                            )}

                            {/* Optional Prediction Image */}
                            <div className="bg-surface border border-darkGray rounded-2xl p-6">
                                <label className="block text-sm font-medium text-textPrimary mb-3">
                                    Prediction Logo / Image (Optional)
                                </label>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <input
                                            type="url"
                                            value={formData.predictionImage}
                                            onChange={(e) => setFormData({ ...formData, predictionImage: e.target.value })}
                                            className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary text-sm"
                                            placeholder="Paste Image URL..."
                                        />
                                    </div>
                                    <label className="cursor-pointer bg-darkGray border border-darkGray hover:border-primary hover:bg-darkGray/70 rounded-xl px-6 py-3 text-textPrimary transition-all flex items-center justify-center gap-2 whitespace-nowrap min-w-[120px]">
                                        <Upload className="w-4 h-4" />
                                        <span className="text-sm font-bold">Upload</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const fakeUrl = URL.createObjectURL(file);
                                                    setFormData({ ...formData, predictionImage: fakeUrl });
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                                {formData.predictionImage && (
                                    <div className="mt-2 w-10 h-10 rounded overflow-hidden">
                                        <img src={formData.predictionImage} className="w-full h-full object-cover" alt="Preview" />
                                    </div>
                                )}
                            </div>

                            <div className="bg-surface border border-darkGray rounded-2xl p-6">
                                <label className="block text-sm font-medium text-textPrimary mb-3">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-primary" />
                                        Duration
                                    </div>
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {(Object.keys(TIMEFRAME_CONFIG) as Timeframe[]).map((tf) => (
                                        <button
                                            key={tf}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, timeframe: tf })}
                                            className={`p-3 rounded-xl border-2 transition-all ${formData.timeframe === tf
                                                ? 'border-primary bg-primary/10'
                                                : 'border-darkGray hover:border-darkGray/50'
                                                }`}
                                        >
                                            <div className="text-sm font-bold text-textPrimary">
                                                {TIMEFRAME_CONFIG[tf].shortLabel}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Rules Field (Manual Verification or Context) */}
                        <div className="bg-surface border border-darkGray rounded-2xl p-6 mb-6">
                            <label className="block text-sm font-medium text-textPrimary mb-3">
                                <div className="flex items-center gap-2">
                                    <Info className="w-5 h-5 text-primary" />
                                    Verification Rules / Notes
                                </div>
                            </label>
                            <textarea
                                value={formData.rules}
                                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                                className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary min-h-[80px] text-sm"
                                placeholder={formData.autoVerify ? "Auto-verification enabled. Add any extra notes..." : "Describe how the winner will be determined..."}
                            />
                        </div>

                        {/* Admin: Auto Verification */}
                        {address && isAdmin(address) && (
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mb-6 flex items-center justify-between">
                                <div>
                                    <h3 className="text-white font-bold flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-blue-400" />
                                        Auto-Verification (Bot)
                                    </h3>
                                    <p className="text-xs text-white/60">
                                        Automatically resolve based on Neynar API data?
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, autoVerify: !prev.autoVerify }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.autoVerify ? 'bg-blue-500' : 'bg-white/10'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.autoVerify ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                        )}

                        {/* 5. Limits & Economics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-surface border border-darkGray rounded-2xl p-6">
                                <label className="block text-sm font-medium text-textPrimary mb-3">
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-primary" />
                                        Min Bet (USDC)
                                    </div>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.minBet}
                                    onChange={(e) => setFormData({ ...formData, minBet: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                                    min={0.01}
                                    required
                                />
                            </div>
                            <div className="bg-surface border border-darkGray rounded-2xl p-6">
                                <label className="block text-sm font-medium text-textPrimary mb-3">
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-primary" />
                                        Max Bet (USDC)
                                    </div>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.maxBet}
                                    onChange={(e) => setFormData({ ...formData, maxBet: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                                    min={formData.minBet}
                                    max={100}
                                    required
                                />
                                <p className="text-xs text-textSecondary mt-1">
                                    Higher max bet requires more initial seeding.
                                </p>
                            </div>
                        </div>

                        {/* 6. Seed Pool Calculation */}
                        <div className="bg-gradient-to-r from-primary/10 to-transparent border-2 border-primary/30 rounded-2xl p-6">
                            <label className="block text-sm font-medium text-textPrimary mb-4">
                                <div className="flex items-center gap-2">
                                    <Droplets className="w-5 h-5 text-primary" />
                                    Required Seeding
                                </div>
                                <span className="text-xs text-textSecondary font-normal mt-1 block">
                                    You must fund the pool to start the market.
                                </span>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-green-500 mb-1 block font-bold">YES Pool</label>
                                    <div className="w-full bg-black/20 border border-green-500/30 rounded-xl px-4 py-3 text-textPrimary font-bold">
                                        ${requiredSeedPerSide.toFixed(2)}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-red-500 mb-1 block font-bold">NO Pool</label>
                                    <div className="w-full bg-black/20 border border-red-500/30 rounded-xl px-4 py-3 text-textPrimary font-bold">
                                        ${requiredSeedPerSide.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm font-bold text-primary mt-4 text-center">
                                ⚡ Total Liquidity Required: ${totalRequiredSeed.toFixed(2)} USDC
                            </p>
                        </div>
                    </>
                )}

                {/* =================== BET PREVIEW =================== */}
                {(formData.username || formData.predictionQuestion || (creationMode === 'battle' && formData.optionA.label)) && (
                    <div className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 mt-6">

                        {/* Preview Card */}
                        <div className="bg-black/30 rounded-xl overflow-hidden border border-white/5 flex items-stretch">

                            {/* Left Side Image - Mode Dependent */}
                            {creationMode === 'battle' ? (
                                <div className="w-24 min-w-[96px] bg-black/50 border-r border-white/10 flex items-center justify-center relative">
                                    <img
                                        src="/battle-swords.png"
                                        alt="Battle"
                                        className="w-16 h-16 object-contain opacity-90"
                                    />
                                    {/* Neon glow effect behind */}
                                    <div className="absolute inset-0 bg-red-500/10 blur-xl"></div>
                                </div>
                            ) : (
                                <div className="w-24 min-w-[96px] bg-gradient-to-br from-primary/20 to-orange-600/20 border-r border-white/10 flex items-center justify-center">
                                    {formData.pfpUrl || formData.optionA.imageUrl ? (
                                        <img
                                            src={formData.pfpUrl || formData.optionA.imageUrl}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="font-bold text-2xl text-white/40">{(formData.username || formData.optionA.label || '?').slice(0, 2).toUpperCase()}</span>
                                    )}
                                </div>
                            )}

                            {/* Content Side */}
                            <div className="flex-1 p-4 min-w-0 flex flex-col justify-center">
                                <div className="flex-1">
                                    <div className="text-sm text-white/60 mb-1 font-medium">
                                        {creationMode === 'battle'
                                            ? `${formData.optionA.label || '?'} vs ${formData.optionB.label || '?'}`
                                            : (formData.username ? `@${formData.username}` : '')}
                                    </div>
                                    <div className="text-white font-bold text-lg leading-tight mb-3">
                                        {creationMode === 'battle'
                                            ? (formData.battleQuestion || 'Battle Question...')
                                            : (formData.predictionQuestion
                                                || (currentBetType.hasTarget
                                                    ? `Will hit ${formData.targetValue}+ ${currentBetType.targetLabel}?`
                                                    : currentBetType.description
                                                )
                                            )
                                        }
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-[10px] font-bold text-white/40 bg-white/5 px-2 py-1 rounded-md uppercase tracking-wider">⏱️ {formData.timeframe}</span>
                                        <span className="text-[10px] font-bold text-white/40 bg-white/5 px-2 py-1 rounded-md uppercase tracking-wider">💰 ${formData.minBet} - ${formData.maxBet}</span>
                                        <span className="text-[10px] font-bold text-green-400/80 bg-green-900/10 border border-green-500/20 px-2 py-1 rounded-md uppercase tracking-wider">Pool: ${totalRequiredSeed.toFixed(2)}</span>
                                        {formData.castUrl && (
                                            <div className="w-full mt-2">
                                                <a
                                                    href={formData.castUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs font-black text-primary hover:underline bg-primary/10 px-2 py-1 rounded border border-primary/30 transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <LinkIcon className="w-3 h-3" />
                                                    View Target Post
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Battle Mode VS Visuals (Below Card) */}
                        {creationMode === 'battle' && formData.optionA.label && formData.optionB.label && (
                            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-white/10 animate-fade-in">
                                <div className="flex items-center gap-3">
                                    {formData.optionA.imageUrl ? (
                                        <img src={formData.optionA.imageUrl} alt="" className="w-10 h-10 rounded-full border-2 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-xs text-green-500 font-bold border border-green-500/50">P1</div>
                                    )}
                                    <span className="text-green-500 font-bold text-lg">{formData.optionA.label}</span>
                                </div>
                                <span className="text-white/20 font-black text-xl italic px-2">VS</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-red-500 font-bold text-lg">{formData.optionB.label}</span>
                                    {formData.optionB.imageUrl ? (
                                        <img src={formData.optionB.imageUrl} alt="" className="w-10 h-10 rounded-full border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-xs text-red-500 font-bold border border-red-500/50">P2</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Submit - Shared by both modes */}
                <div className="flex gap-4 mt-6">
                    <Link href="/" className="flex-1 bg-darkGray py-3 rounded-xl text-center text-textPrimary hover:bg-white/5 transition-colors">Cancel</Link>
                    <button
                        type="submit"
                        disabled={isSubmitting || (creationMode === 'prediction' && !formData.username && !formData.predictionQuestion) || (creationMode === 'battle' && (!formData.optionA.label || !formData.optionB.label || !formData.battleQuestion)) || totalRequiredSeed <= 0}
                        className={`flex-1 font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg ${creationMode === 'battle' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-red-500/20' : 'bg-gradient-to-r from-primary to-secondary text-background shadow-primary/20'}`}
                    >
                        {isSubmitting ? 'Waiting for Wallet...' : creationMode === 'battle' ? `⚔️ Launch Battle ($${totalRequiredSeed.toFixed(2)})` : `Create Battle ($${totalRequiredSeed.toFixed(2)})`}
                    </button>
                </div>

            </form>
        </div>
    );
}
