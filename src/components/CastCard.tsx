'use client';

import { Heart, Repeat2, MessageCircle, TrendingUp } from 'lucide-react';
import { Cast } from '@/lib/types';
import Image from 'next/image';

interface CastCardProps {
    cast: Cast;
    onPredict: () => void;
}

export default function CastCard({ cast, onPredict }: CastCardProps) {
    const formatNumber = (num: number): string => {
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}k`;
        }
        return num.toString();
    };

    return (
        <div className="bg-surface border border-darkGray rounded-2xl p-6 hover:border-primary/30 transition-all duration-200 group">
            {/* Author Info */}
            <div className="flex items-start gap-3 mb-4">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-darkGray flex-shrink-0">
                    {cast.author.pfp.url ? (
                        <Image
                            src={cast.author.pfp.url}
                            alt={cast.author.username}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-textSecondary text-xl font-bold">
                            {cast.author.username[0].toUpperCase()}
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-textPrimary truncate">
                            {cast.author.displayName}
                        </span>
                    </div>
                    <span className="text-sm text-textSecondary">@{cast.author.username}</span>
                </div>
            </div>

            {/* Cast Text */}
            <p className="text-textPrimary mb-4 line-clamp-3">
                {cast.text}
            </p>

            {/* Engagement Stats */}
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-darkGray">
                <div className="flex items-center gap-1.5 text-textSecondary">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm font-medium">{formatNumber(cast.reactions.likes_count)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-textSecondary">
                    <Repeat2 className="w-4 h-4" />
                    <span className="text-sm font-medium">{formatNumber(cast.reactions.recasts_count)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-textSecondary">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{formatNumber(cast.reactions.replies_count)}</span>
                </div>
            </div>

            {/* Predict Button */}
            <button
                onClick={onPredict}
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-background font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group-hover:scale-[1.02]"
            >
                <TrendingUp className="w-5 h-5" />
                Make a Prediction
            </button>
        </div>
    );
}
