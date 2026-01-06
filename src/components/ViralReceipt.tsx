'use client';

import { useEffect, useRef } from 'react';
import { Share2, CheckCircle, Smartphone, ShieldCheck, Trophy, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ViralReceiptProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        avatarUrl?: string;
        username: string;
        action: string; // "JOINED BATTLE", "POSITION SECURED"
        amount: number;
        potentialWin: number;
        multiplier: number;
        choice: 'YES' | 'NO';
        targetName: string;
    };
}

export default function ViralReceipt({ isOpen, onClose, data }: ViralReceiptProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FF5F1F', '#FFFFFF', '#0a0a0a']
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleShare = () => {
        const text = `⚔️ I just entered the Battle Arena!\n\nStaked: $${data.amount} on ${data.choice}\nPotential Win: $${data.potentialWin} (${data.multiplier}x)\n\nTarget: ${data.targetName}\n\nJoin the fight on Prediction Battle! 🥊`;
        const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm" ref={modalRef}>
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-textSecondary hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Thermal Receipt Card */}
                <div className="bg-white text-black p-6 rotate-1 hover:rotate-0 transition-transform duration-300 shadow-2xl relative overflow-hidden font-mono">
                    {/* Jagged Top */}
                    <div className="absolute top-0 left-0 right-0 h-4 bg-black translate-y-[-50%]" style={{ clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)' }}></div>

                    <div className="text-center mb-6 mt-2">
                        <div className="text-4xl font-black mb-1 uppercase tracking-tighter">BATTLE ENTRY</div>
                        <div className="text-xs uppercase tracking-widest opacity-60">CONFIRMED TRANSACTION</div>
                        <div className="text-xs opacity-40 mt-1">{new Date().toLocaleString().toUpperCase()}</div>
                    </div>

                    <div className="border-b-2 border-black/10 my-4 border-dashed"></div>

                    <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold uppercase opacity-60">Player</span>
                            <div className="flex items-center gap-2">
                                {data.avatarUrl && <img src={data.avatarUrl} className="w-6 h-6 rounded-full bg-black/10" />}
                                <span className="font-bold">@{data.username}</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold uppercase opacity-60">Position</span>
                            <span className={`font-black text-xl ${data.choice === 'YES' ? 'text-green-600' : 'text-red-600'}`}>
                                {data.choice}
                            </span>
                        </div>

                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold uppercase opacity-60">Target</span>
                            <span className="font-bold text-right max-w-[150px] leading-tight truncate">
                                {data.targetName}
                            </span>
                        </div>

                        <div className="border-b-2 border-black/10 my-4 border-dashed"></div>

                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold uppercase opacity-60">Stake</span>
                            <span className="font-bold text-xl">${data.amount.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold uppercase opacity-60">Potential Win</span>
                            <span className="font-black text-3xl text-orange-600">${data.potentialWin.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="bg-black text-white p-4 text-center mb-4">
                        <div className="text-xs uppercase opacity-60 mb-1">Battle ID</div>
                        <div className="font-mono text-sm tracking-widest">{Math.random().toString(36).substr(2, 9).toUpperCase()}</div>
                    </div>

                    <button
                        onClick={handleShare}
                        className="w-full bg-[#FF5F1F] hover:bg-[#ff4500] text-white font-black py-4 uppercase tracking-wider flex items-center justify-center gap-2 text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                    >
                        <Share2 className="w-6 h-6" />
                        Share on Farcaster
                    </button>

                    {/* Jagged Bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-black translate-y-[50%]" style={{ clipPath: 'polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)' }}></div>
                </div>
            </div>
        </div>
    );
}
