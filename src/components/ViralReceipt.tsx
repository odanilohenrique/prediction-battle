'use client';

import { useEffect, useRef, useState } from 'react';
import { Share2, CheckCircle, Smartphone, ShieldCheck, Trophy, X, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPng } from 'html-to-image';

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
        choice: 'YES' | 'NO' | string; // Can be player name
        targetName: string;
        predictionId?: string;
        // Battle specific
        variant?: 'standard' | 'battle';
        opponentName?: string;
        opponentAvatar?: string;
        myFighterAvatar?: string;
    };
}

export default function ViralReceipt({ isOpen, onClose, data }: ViralReceiptProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const ticketRef = useRef<HTMLDivElement>(null);
    const isBattle = data.variant === 'battle';
    const [isCapturing, setIsCapturing] = useState(false);
    const [imageCaptured, setImageCaptured] = useState(false);

    // Capture and save ticket image when opened
    useEffect(() => {
        if (isOpen && ticketRef.current && data.predictionId && !imageCaptured) {
            const captureAndSave = async () => {
                try {
                    // Wait for images to load
                    await new Promise(resolve => setTimeout(resolve, 500));

                    if (!ticketRef.current) return;

                    const dataUrl = await toPng(ticketRef.current, {
                        quality: 0.95,
                        pixelRatio: 2,
                        backgroundColor: isBattle ? '#0f0f0f' : '#ffffff',
                    });

                    // Save to API
                    await fetch('/api/ticket-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            predictionId: data.predictionId,
                            imageBase64: dataUrl,
                        }),
                    });

                    setImageCaptured(true);
                    console.log('[ViralReceipt] Ticket image captured and saved');
                } catch (error) {
                    console.error('[ViralReceipt] Failed to capture ticket:', error);
                }
            };

            captureAndSave();
        }
    }, [isOpen, data.predictionId, imageCaptured, isBattle]);

    useEffect(() => {
        if (isOpen) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: isBattle ? ['#FF0000', '#00FF00', '#FFFFFF'] : ['#FF5F1F', '#FFFFFF', '#0a0a0a']
            });
        }
    }, [isOpen, isBattle]);

    if (!isOpen) return null;

    const handleShare = () => {
        const link = data.predictionId ? `${window.location.origin}/prediction/${data.predictionId}` : window.location.origin;

        const text = isBattle
            ? `just put $${data.amount} on ${data.choice} 🥊\n\nif i'm right, walking away with $${data.potentialWin.toFixed(2)}\n\nwho you got? 👀\n\n${link}`
            : `I predict ${data.choice} 🎯\n\nstaked $${data.amount}, potential win $${data.potentialWin.toFixed(2)}\n\nam i right? 👀\n\n${link}`;

        const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const handleShareX = () => {
        const link = data.predictionId ? `${window.location.origin}/prediction/${data.predictionId}` : window.location.origin;

        const text = isBattle
            ? `just put $${data.amount} on ${data.choice} 🥊\n\nif i'm right, walking away with $${data.potentialWin.toFixed(2)}\n\nwho you got? 👀`
            : `I predict ${data.choice} 🎯\n\nstaked $${data.amount}, potential win $${data.potentialWin.toFixed(2)}\n\nam i right? 👀`;

        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
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

                {/* TICKET CONTAINER */}
                <div
                    ref={ticketRef}
                    className={`
                    relative overflow-hidden shadow-2xl transition-transform duration-300 rotate-1 hover:rotate-0
                    ${isBattle ? 'bg-[#0f0f0f] text-white border border-white/10 rounded-3xl' : 'bg-white text-black font-mono'}
                `}>

                    {/* BATTLE TICKET LAYOUT */}
                    {isBattle ? (
                        <div className="p-0">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-red-600 to-orange-600 p-4 text-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
                                <div className="relative z-10">
                                    <div className="text-2xl font-black italic uppercase tracking-tighter text-white drop-shadow-md">
                                        FIGHT TICKET
                                    </div>
                                    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/80">
                                        OFFICIAL ENTRY
                                    </div>
                                </div>
                            </div>

                            {/* PREDICTION PHRASE */}
                            <div className="px-6 pt-6 text-center z-10 relative">
                                <h3 className="text-white font-bold italic text-lg leading-tight drop-shadow-md">
                                    "{data.targetName}"
                                </h3>
                            </div>

                            {/* VS SECTION */}
                            <div className="p-6 relative pt-4">
                                <div className="flex items-center justify-between gap-4">
                                    {/* MY FIGHTER */}
                                    <div className="flex flex-col items-center gap-2 relative z-10 transition-transform hover:scale-105">
                                        <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg bg-black">
                                            {data.myFighterAvatar ? (
                                                <img src={data.myFighterAvatar} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-white/10" />
                                            )}
                                        </div>
                                        <div className="text-[10px] font-bold text-white/80 uppercase tracking-tight max-w-[70px] truncate text-center">
                                            {data.choice}
                                        </div>
                                    </div>

                                    {/* VS */}
                                    <div className="flex flex-col items-center justify-center -mt-4">
                                        <span className="text-4xl font-black italic text-white/20">VS</span>
                                    </div>

                                    {/* OPPONENT */}
                                    <div className="flex flex-col items-center gap-2 relative z-10 transition-transform hover:scale-105">
                                        <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg bg-black">
                                            {data.opponentAvatar ? (
                                                <img src={data.opponentAvatar} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-white/10" />
                                            )}
                                        </div>
                                        <div className="text-[10px] font-bold text-white/80 uppercase tracking-tight max-w-[70px] truncate text-center">
                                            {data.opponentName}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* DETAILS GRID */}
                            <div className="bg-white/5 border-t border-white/5 p-6 space-y-4">
                                {/* MY PICK ROW - HIGHLIGHTED */}
                                <div className="flex justify-between items-center bg-green-500/20 border border-green-500/50 p-3 rounded-lg -mx-2 shadow-[0_0_15px_rgba(34,197,94,0.2)] relative overflow-hidden">
                                    <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
                                    <div className="text-sm font-black text-green-400 uppercase tracking-widest relative z-10 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" />
                                        MY PICK
                                    </div>
                                    <div className="text-lg font-black text-white uppercase tracking-wider relative z-10">{data.choice}</div>
                                </div>

                                <div className="flex justify-between items-center px-1">
                                    <div className="text-xs text-white/40 uppercase tracking-widest">STAKE</div>
                                    <div className="text-xl font-bold font-mono">${data.amount.toFixed(2)}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-xs text-white/40 uppercase tracking-widest">POTENTIAL WIN</div>
                                    <div className="text-2xl font-black text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                                        ${data.potentialWin.toFixed(2)}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-xs text-white/40 uppercase tracking-widest">MULTIPLIER</div>
                                    <div className="text-sm font-bold text-white/60">{data.multiplier}x</div>
                                </div>
                            </div>

                            {/* FOOTER BAR */}
                            <div className="bg-black/40 p-3 text-center border-t border-white/5">
                                <div className="text-[10px] text-white/20 font-mono tracking-widest break-all">
                                    ID: {Math.random().toString(36).substr(2, 12).toUpperCase()}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* STANDARD RECEIPT LAYOUT */
                        <div className="p-6">
                            {/* Jagged Top */}
                            <div className="absolute top-0 left-0 right-0 h-4 bg-black translate-y-[-50%]" style={{ clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)' }}></div>

                            <div className="text-center mb-6 mt-2">
                                <div className="text-3xl font-black mb-1 uppercase tracking-tighter text-wrap leading-tight">PREDICTION CONFIRMED</div>
                                <div className="text-xs uppercase tracking-widest opacity-60">OFFICIAL RECEIPT</div>
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

                            {/* Jagged Bottom */}
                            <div className="absolute bottom-0 left-0 right-0 h-4 bg-black translate-y-[50%]" style={{ clipPath: 'polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)' }}></div>
                        </div>
                    )}
                </div>

                {/* ACTION BUTTONS */}
                <div className="space-y-3 mt-6">
                    <button
                        onClick={onClose}
                        className="w-full bg-black hover:bg-black/80 text-white font-black py-4 uppercase tracking-wider flex items-center justify-center gap-2 text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all rounded-xl"
                    >
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        Back to Arena
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={handleShare}
                            className="flex-1 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#8B5CF6] font-bold py-3 uppercase tracking-wider flex items-center justify-center gap-2 text-sm transition-all rounded-xl border border-[#8B5CF6]/20"
                        >
                            <Share2 className="w-4 h-4" />
                            Farcaster
                        </button>

                        <button
                            onClick={handleShareX}
                            className="flex-1 bg-black hover:bg-gray-900 text-white font-bold py-3 uppercase tracking-wider flex items-center justify-center gap-2 text-sm transition-all rounded-xl border border-white/10"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            Share on X
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
