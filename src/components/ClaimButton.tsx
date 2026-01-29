'use client';

import { Coins, Sparkles, Zap } from 'lucide-react';

interface ClaimButtonProps {
    amount: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    label?: string;
    subtext?: string;
}

export default function ClaimButton({ amount, onClick, disabled, loading, label, subtext }: ClaimButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`
                relative w-full group overflow-hidden rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]
                ${disabled
                    ? 'bg-gray-800 cursor-not-allowed opacity-50 border border-white/10'
                    : 'bg-gradient-to-r from-green-600/80 via-emerald-600/80 to-green-700/80 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] border border-green-500/30'
                }
            `}
        >
            {/* Glossy Overlay */}
            {!disabled && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}

            {/* Shine Animation */}
            {!disabled && !loading && (
                <div className="absolute inset-0 -translate-x-full group-hover:animate-shine bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg]" />
            )}

            <div className="relative px-6 py-4 flex items-center justify-between">
                {/* Left Side: Icon & Label */}
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${disabled ? 'bg-white/5' : 'bg-white/20 backdrop-blur-sm'}`}>
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Coins className={`w-6 h-6 ${disabled ? 'text-white/30' : 'text-yellow-300 drop-shadow-md'}`} />
                        )}
                    </div>
                    <div className="text-left">
                        <div className={`text-xs font-bold uppercase tracking-wider ${disabled ? 'text-white/40' : 'text-green-100'}`}>
                            {label || (disabled ? 'Reward Claimed' : 'Claim Winnings')}
                        </div>
                        <div className={`text-lg font-black leading-none ${disabled ? 'text-white/60' : 'text-white drop-shadow-sm'}`}>
                            {subtext || (disabled ? 'PAID' : 'GET PAID')}
                        </div>
                    </div>
                </div>

                {/* Right Side: Amount */}
                {(!loading && (amount !== '0.00' || (!disabled && amount === '0.00'))) && (
                    <div className="flex flex-col items-end">
                        <div className="text-xs text-green-200/80 font-medium mb-0.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-yellow-500/80" />
                            {disabled ? 'TOTAL WON' : 'YOU WON'}
                        </div>
                        <div className="text-xl font-black text-white drop-shadow-md tracking-tight">
                            ${amount}
                        </div>
                    </div>
                )}
            </div>

            {/* Pulsing Border for Attention */}
            {!disabled && !loading && (
                <div className="absolute inset-0 rounded-xl border-2 border-green-400/50 opacity-0 group-hover:opacity-100 animate-pulse transition-opacity" />
            )}
        </button>
    );
}
