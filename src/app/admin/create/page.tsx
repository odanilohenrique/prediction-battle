'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Target, Calendar, DollarSign, Users, Sparkles, User, Sword, Droplets } from 'lucide-react';
import Link from 'next/link';
import { USER_PRESETS } from '@/lib/presets';
import { useAccount, useWriteContract, usePublicClient, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';

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
    | 'custom_text';

type Timeframe = '30m' | '6h' | '12h' | '24h' | '7d';

const BET_TYPE_CONFIG: Record<BetType, { label: string; icon: string; targetLabel: string; description: string }> = {
    post_count: { label: 'Number of Posts', icon: '📝', targetLabel: 'posts', description: 'Total new casts posted' },
    likes_total: { label: 'Total Likes', icon: '❤️', targetLabel: 'likes', description: 'Combined likes on all casts' },
    followers_gain: { label: 'Follower Gain', icon: '👥', targetLabel: 'new followers', description: 'New followers gained' },
    emoji_count: { label: 'Emoji Mania 🔥', icon: '🔥', targetLabel: 'emojis', description: 'Total emojis used in casts' },
    mentions: { label: '@ Mentions', icon: '@️', targetLabel: 'mentions', description: 'Times mentioned by others' },
    quotes: { label: 'Quote King', icon: '💬', targetLabel: 'quotes', description: 'Times post was quoted' },
    reply_marathon: { label: 'Reply Marathon', icon: '💬', targetLabel: 'replies', description: 'Total replies posted' },
    thread_length: { label: 'Thread Master', icon: '🧵', targetLabel: 'posts in thread', description: 'Longest thread length' },
    controversial: { label: 'Drama Alert 🌶️', icon: '🌶️', targetLabel: 'controversy score', description: 'Most replies/likes ratio' },
    custom_text: { label: '✍️ Custom Prediction', icon: '✍️', targetLabel: '', description: 'Write any question you want!' },
};

const TIMEFRAME_CONFIG: Record<Timeframe, { label: string; shortLabel: string }> = {
    '30m': { label: '30 Minutes', shortLabel: '30m' },
    '6h': { label: '6 Hours', shortLabel: '6h' },
    '12h': { label: '12 Hours', shortLabel: '12h' },
    '24h': { label: '24 Hours', shortLabel: '24h' },
    '7d': { label: '7 Days', shortLabel: '7d' },
};

export default function CreateBet() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        // User info
        username: '',
        displayName: '',
        pfpUrl: '',
        // Bet config
        betType: 'post_count' as BetType,
        targetValue: 3,
        timeframe: '24h' as Timeframe,
        minBet: 0.05,
        maxBet: 10,
        rules: '',
        castUrl: '', // New field for automation
        // Custom prediction text
        customQuestion: '',
        // Versus Mode
        isVersus: false,
        optionA: { label: '', imageUrl: '' },
        optionB: { label: '', imageUrl: '' },
        // Initial Liquidity
        initialLiquidityYes: 0,
        initialLiquidityNo: 0,
    });

    const currentBetType = BET_TYPE_CONFIG[formData.betType];

    // Wagmi hooks for liquidity
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

    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        if (!selectedId) return;

        const preset = USER_PRESETS.find(p => p.id === selectedId);
        if (preset) {
            setFormData(prev => ({
                ...prev,
                username: preset.username,
                displayName: preset.displayName,
                pfpUrl: preset.pfpUrl
            }));
        }
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // 1. Create the bet first
            const response = await fetch('/api/admin/bets/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!data.success) {
                alert('❌ Error creating bet: ' + (data.error || 'Unknown error'));
                return;
            }

            const betId = data.betId;

            // 2. If liquidity is provided, add it via wallet
            const totalLiquidity = formData.initialLiquidityYes + formData.initialLiquidityNo;
            if (totalLiquidity > 0 && isConnected && address) {
                try {
                    // Switch chain if needed
                    if (chainId !== EXPECTED_CHAIN_ID) {
                        if (switchChainAsync) {
                            await switchChainAsync({ chainId: EXPECTED_CHAIN_ID });
                        }
                    }

                    // Add YES liquidity
                    if (formData.initialLiquidityYes > 0) {
                        const yesAmount = parseUnits(formData.initialLiquidityYes.toString(), 6);
                        const yesHash = await writeContractAsync({
                            address: USDC_ADDRESS as `0x${string}`,
                            abi: [{
                                name: 'transfer',
                                type: 'function',
                                stateMutability: 'nonpayable',
                                inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
                                outputs: [{ name: '', type: 'bool' }]
                            }],
                            functionName: 'transfer',
                            args: [HOUSE_ADDRESS as `0x${string}`, yesAmount],
                            gas: BigInt(200000),
                        });
                        await publicClient!.waitForTransactionReceipt({ hash: yesHash });
                        await fetch('/api/predictions/bet', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                betId,
                                choice: 'yes',
                                amount: formData.initialLiquidityYes,
                                txHash: yesHash,
                                userAddress: address
                            }),
                        });
                    }

                    // Add NO liquidity
                    if (formData.initialLiquidityNo > 0) {
                        const noAmount = parseUnits(formData.initialLiquidityNo.toString(), 6);
                        const noHash = await writeContractAsync({
                            address: USDC_ADDRESS as `0x${string}`,
                            abi: [{
                                name: 'transfer',
                                type: 'function',
                                stateMutability: 'nonpayable',
                                inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
                                outputs: [{ name: '', type: 'bool' }]
                            }],
                            functionName: 'transfer',
                            args: [HOUSE_ADDRESS as `0x${string}`, noAmount],
                            gas: BigInt(200000),
                        });
                        await publicClient!.waitForTransactionReceipt({ hash: noHash });
                        await fetch('/api/predictions/bet', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                betId,
                                choice: 'no',
                                amount: formData.initialLiquidityNo,
                                txHash: noHash,
                                userAddress: address
                            }),
                        });
                    }

                    alert('✅ Bet created with initial liquidity!');
                } catch (walletError) {
                    console.error('Wallet error:', walletError);
                    alert('⚠️ Bet created but liquidity failed. Add liquidity manually via Seed Pool.');
                }
            } else {
                alert('✅ Bet created successfully!');
            }

            router.push('/admin');
        } catch (error) {
            console.error('Error creating bet:', error);
            alert('❌ Failed to create bet');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/admin"
                    className="inline-flex items-center gap-2 text-textSecondary hover:text-textPrimary transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>

                <h1 className="text-3xl font-bold text-textPrimary mb-2">
                    Create New Prediction
                </h1>
                <p className="text-textSecondary">
                    Configure the prediction that users can bet on
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* 1. User Profile Section */}
                <div className="bg-surface border border-darkGray rounded-2xl p-6">
                    <label className="block text-sm font-medium text-textPrimary mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" />
                                Farcaster User
                            </div>
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-secondary" />
                                <span className="text-xs text-textSecondary">Load Preset:</span>
                                <select
                                    className="bg-darkGray border border-darkGray rounded-lg text-xs px-2 py-1 text-textSecondary hover:text-textPrimary cursor-pointer focus:outline-none focus:border-primary"
                                    onChange={handlePresetChange}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Select User...</option>
                                    {USER_PRESETS.map(user => (
                                        <option key={user.id} value={user.id}>{user.displayName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs text-textSecondary mb-1 block">Username *</label>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                                placeholder="jessepollak"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs text-textSecondary mb-1 block">Display Name</label>
                            <input
                                type="text"
                                value={formData.displayName}
                                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                                placeholder="Jesse Pollak"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-textSecondary mb-1 block">Profile Picture URL</label>
                            <input
                                type="url"
                                value={formData.pfpUrl}
                                onChange={(e) => setFormData({ ...formData, pfpUrl: e.target.value })}
                                className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                                placeholder="https://i.imgur.com/..."
                            />
                        </div>
                    </div>
                    {formData.pfpUrl && (
                        <div className="mt-4 flex items-center gap-3">
                            <img
                                src={formData.pfpUrl}
                                alt="Preview"
                                className="w-12 h-12 rounded-full object-cover border-2 border-primary/30"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                            <span className="text-sm text-textSecondary">Avatar preview</span>
                        </div>
                    )}

                    {/* New Cast URL Field */}
                    <div className="mt-6 pt-6 border-t border-darkGray/50">
                        <label className="block text-sm font-medium text-textPrimary mb-2">
                            🔗 Farcaster Cast URL (Optional for Automation)
                        </label>
                        <input
                            type="url"
                            value={formData.castUrl}
                            onChange={(e) => setFormData({ ...formData, castUrl: e.target.value })}
                            className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary"
                            placeholder="https://warpcast.com/jessepollak/0x..."
                        />
                        <p className="text-xs text-textSecondary mt-2">
                            Se colado, o sistema extrairá automaticamente o hash para verificação automática de likes/comentários.
                        </p>
                    </div>
                </div>

                {/* 2. Bet Type */}
                <div className="bg-surface border border-darkGray rounded-2xl p-6">
                    <label className="block text-sm font-medium text-textPrimary mb-4">
                        <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-primary" />
                            Prediction Type
                        </div>
                    </label>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {(Object.keys(BET_TYPE_CONFIG) as BetType[]).map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setFormData({ ...formData, betType: type })}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${formData.betType === type
                                    ? 'border-primary bg-primary/10'
                                    : 'border-darkGray hover:border-darkGray/50'
                                    }`}
                            >
                                <div className="text-2xl mb-1">{BET_TYPE_CONFIG[type].icon}</div>
                                <div className="text-sm font-medium text-textPrimary">
                                    {BET_TYPE_CONFIG[type].label}
                                </div>
                                <div className="text-xs text-textSecondary mt-1">
                                    {BET_TYPE_CONFIG[type].description}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. Custom Question & Versus Options (only for custom_text) */}
                {formData.betType === 'custom_text' && (
                    <div className="bg-surface border border-darkGray rounded-2xl p-6 animate-fade-in">
                        <label className="block text-sm font-medium text-textPrimary mb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    ✍️ Custom Prediction Question
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isVersus}
                                        onChange={(e) => setFormData({ ...formData, isVersus: e.target.checked })}
                                        className="w-4 h-4 rounded border-darkGray bg-darkGray text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-textSecondary font-medium flex items-center gap-1">
                                        <Sword className="w-4 h-4" /> Enable Versus Mode (Buttons)
                                    </span>
                                </div>
                            </div>
                        </label>
                        <textarea
                            value={formData.customQuestion}
                            onChange={(e) => setFormData({ ...formData, customQuestion: e.target.value })}
                            className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary min-h-[100px] text-lg mb-4"
                            placeholder="e.g., Jesse Pollak vs dwr - who gets more engagement this week?"
                            required={(formData.betType as string) === 'custom_text'}
                        />

                        {formData.isVersus && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 p-4 bg-black/20 rounded-xl border border-darkGray/50">
                                <div>
                                    <h4 className="font-bold text-green-500 mb-2">Option A (YES Pool)</h4>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder="Label (e.g. Jesse)"
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
                                            placeholder="Label (e.g. DWR)"
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

                {/* 4. Target Value & Timeframe */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {formData.betType !== 'custom_text' && (
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
                                required={(formData.betType as string) !== 'custom_text'}
                            />
                            <p className="text-sm text-primary mt-2 font-medium">
                                {formData.targetValue}+ {currentBetType.targetLabel}
                            </p>
                        </div>
                    )}

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

                {/* 5. Limits */}
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
                            required
                        />
                    </div>
                </div>

                {/* 6. Rules */}
                <div className="bg-surface border border-darkGray rounded-2xl p-6">
                    <label className="block text-sm font-medium text-textPrimary mb-3">
                        <div className="flex items-center gap-2">
                            📜 Verification Rules
                        </div>
                    </label>
                    <textarea
                        value={formData.rules}
                        onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                        className="w-full bg-darkGray border border-darkGray rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-primary min-h-[100px]"
                        placeholder="e.g., Verified manually by admin at deadline."
                    />
                </div>

                {/* 7. Initial Liquidity (Admin Only) */}
                {isConnected && (
                    <div className="bg-yellow-500/5 border-2 border-yellow-500/30 rounded-2xl p-6">
                        <label className="block text-sm font-medium text-textPrimary mb-4">
                            <div className="flex items-center gap-2">
                                <Droplets className="w-5 h-5 text-yellow-500" />
                                💰 Initial Liquidity (Optional)
                            </div>
                            <span className="text-xs text-yellow-500 font-normal mt-1 block">
                                Add USDC from your wallet to seed the pool when creating.
                            </span>
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-green-500 mb-1 block font-bold">YES Pool (USDC)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.initialLiquidityYes || ''}
                                    onChange={(e) => setFormData({ ...formData, initialLiquidityYes: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-darkGray border border-green-500/30 rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-green-500"
                                    placeholder="0.00"
                                    min={0}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-red-500 mb-1 block font-bold">NO Pool (USDC)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.initialLiquidityNo || ''}
                                    onChange={(e) => setFormData({ ...formData, initialLiquidityNo: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-darkGray border border-red-500/30 rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-red-500"
                                    placeholder="0.00"
                                    min={0}
                                />
                            </div>
                        </div>
                        {(formData.initialLiquidityYes > 0 || formData.initialLiquidityNo > 0) && (
                            <p className="text-xs text-yellow-500 mt-3">
                                ⚡ Total: ${(formData.initialLiquidityYes + formData.initialLiquidityNo).toFixed(2)} USDC will be transferred from your wallet.
                            </p>
                        )}
                    </div>
                )}

                {/* 8. Preview & Submit */}
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-2 border-primary/30 rounded-2xl p-6">
                    <h3 className="font-bold text-textPrimary mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Bet Preview
                    </h3>

                    <div className="flex items-center gap-4 mb-4">
                        {formData.pfpUrl && (
                            <img src={formData.pfpUrl} className="w-16 h-16 rounded-full border-2 border-primary/30" />
                        )}
                        <div>
                            <p className="font-bold text-textPrimary text-lg">
                                {formData.displayName || `@${formData.username || 'username'}`}
                            </p>
                            <p className="text-textSecondary">@{formData.username || 'username'}</p>
                        </div>
                    </div>

                    <p className="text-textPrimary text-lg mb-2">
                        {formData.betType === 'custom_text' ? (
                            <span className="font-bold">{formData.customQuestion || 'Custom Question...'}</span>
                        ) : (
                            <>
                                Will reach <span className="font-bold text-primary">{formData.targetValue}+ {currentBetType.targetLabel}</span>
                            </>
                        )}
                        {' '}in <span className="font-bold">{TIMEFRAME_CONFIG[formData.timeframe].label}</span>?
                    </p>

                    {formData.isVersus && (
                        <div className="flex gap-4 mt-4 mb-4">
                            <button className="flex-1 bg-green-500/20 border border-green-500 text-green-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                                {formData.optionA.imageUrl && <img src={formData.optionA.imageUrl} className="w-6 h-6 rounded-full" />}
                                {formData.optionA.label || 'Option A'}
                            </button>
                            <button className="flex-1 bg-red-500/20 border border-red-500 text-red-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                                {formData.optionB.imageUrl && <img src={formData.optionB.imageUrl} className="w-6 h-6 rounded-full" />}
                                {formData.optionB.label || 'Option B'}
                            </button>
                        </div>
                    )}

                    <div className="flex gap-4 mt-6">
                        <Link href="/admin" className="flex-1 bg-darkGray py-3 rounded-xl text-center text-textPrimary">Cancel</Link>
                        <button type="submit" disabled={isSubmitting || !formData.username} className="flex-1 bg-gradient-to-r from-primary to-secondary text-background font-bold py-3 rounded-xl">
                            {isSubmitting ? 'Creating...' : '🎯 Create Prediction'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
