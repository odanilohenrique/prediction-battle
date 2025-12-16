'use client';

import { useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';

interface ResultRevealProps {
    isWin: boolean;
    onComplete: () => void;
    betId: string;
    amount: number;
}

export default function ResultReveal({ isWin, onComplete, betId, amount }: ResultRevealProps) {

    const fireConfetti = useCallback(() => {
        // Create confetti bursts from both sides
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        function randomInRange(min: number, max: number) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            // Confetti from left
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                colors: ['#FF9500', '#FFB84D', '#00FF00', '#FFFFFF', '#FFD700'],
            });

            // Confetti from right
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                colors: ['#FF9500', '#FFB84D', '#00FF00', '#FFFFFF', '#FFD700'],
            });
        }, 250);

        // Clean up after animation
        setTimeout(() => {
            clearInterval(interval);
        }, duration);
    }, []);

    useEffect(() => {
        if (isWin) {
            fireConfetti();
        }

        // Auto close after animation
        const timer = setTimeout(() => {
            onComplete();
        }, 4000);

        return () => clearTimeout(timer);
    }, [isWin, fireConfetti, onComplete]);

    return (
        <div
            className="fixed inset-0 z-[9998] flex items-center justify-center"
            onClick={onComplete}
        >
            {/* Background overlay */}
            <div
                className={`absolute inset-0 transition-all duration-500 ${isWin
                        ? 'bg-gradient-to-b from-green-900/90 to-black/95'
                        : 'bg-gradient-to-b from-gray-900/95 to-black/98'
                    }`}
            />

            {/* Funeral rain effect for losses */}
            {!isWin && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(50)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-0.5 bg-gradient-to-b from-gray-400/30 to-transparent animate-rain"
                            style={{
                                left: `${Math.random() * 100}%`,
                                height: `${20 + Math.random() * 30}px`,
                                animationDelay: `${Math.random() * 2}s`,
                                animationDuration: `${1 + Math.random()}s`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Result content */}
            <div className="relative z-10 text-center p-8">
                {/* Icon */}
                <div className={`text-9xl mb-6 animate-bounce ${isWin ? '' : 'animate-none'}`}>
                    {isWin ? '🎉' : '💀'}
                </div>

                {/* Title */}
                <h1 className={`text-5xl font-black mb-4 ${isWin ? 'text-green-400' : 'text-gray-400'
                    }`}>
                    {isWin ? 'YOU WON!' : 'YOU LOST'}
                </h1>

                {/* Amount */}
                <p className={`text-2xl font-bold mb-6 ${isWin ? 'text-green-300' : 'text-gray-500'
                    }`}>
                    {isWin ? `+$${amount.toFixed(2)} USDC` : `-$${amount.toFixed(2)} USDC`}
                </p>

                {/* Subtitle */}
                <p className="text-textSecondary text-lg mb-8">
                    {isWin
                        ? 'Your prediction was correct! 🔥'
                        : 'Better luck next time...'}
                </p>

                {/* Close button */}
                <button
                    onClick={onComplete}
                    className={`px-8 py-3 rounded-xl font-bold transition-all ${isWin
                            ? 'bg-green-500 hover:bg-green-400 text-black'
                            : 'bg-gray-700 hover:bg-gray-600 text-white'
                        }`}
                >
                    Continue
                </button>
            </div>
        </div>
    );
}
