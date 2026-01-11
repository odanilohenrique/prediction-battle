
import { Metadata, ResolvingMetadata } from 'next';
import { store } from '@/lib/store';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Zap } from 'lucide-react';
import AdminBetCard from '@/components/AdminBetCard';
import ClientCardWrapper from './ClientCardWrapper';

type Props = {
    params: { id: string }
    searchParams: { [key: string]: string | string[] | undefined }
}

// 1. Generate Metadata for Social Sharing (Farcaster/Twitter)
export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const id = params.id;
    const bet = await store.getBet(id);

    if (!bet) {
        return {
            title: 'Prediction Not Found',
            description: 'This battle does not exist or has been deleted.'
        };
    }

    const title = bet.isVersus
        ? `${bet.optionA?.label || 'Player 1'} VS ${bet.optionB?.label || 'Player 2'}`
        : `Will @${bet.username} hit the target?`;

    const description = bet.castText || `Join the prediction market on specific outcomes! Pot: $${bet.totalPot}`;

    return {
        title: title + ' | Prediction Battle',
        description: description,
        openGraph: {
            title: title,
            description: description,
            images: [`/prediction/${id}/opengraph-image?v=12`], // Dynamic Image Route
        },
        other: {
            'fc:frame': 'vNext',
            'fc:frame:image': `https://predictionbattle.xyz/prediction/${id}/opengraph-image?v=12`,
            'fc:frame:button:1': '🥊 Enter Arena',
            'fc:frame:button:1:action': 'link',
            'fc:frame:button:1:target': `https://predictionbattle.xyz/prediction/${id}`,
        }
    };
}

// 2. The Page Component
export default async function PredictionPage({ params }: Props) {
    const bet = await store.getBet(params.id);

    if (!bet) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <h1 className="text-2xl font-bold text-white mb-4">Battle Not Found</h1>
                <Link href="/" className="px-6 py-3 bg-primary text-black rounded-xl font-bold">
                    Go Home
                </Link>
            </div>
        );
    }

    // Since AdminBetCard is a Client Component (needs onClick etc), we wrap it or use it directly if it handles "view only" gracefully.
    // However, AdminBetCard expects `onBet` callback. We can pass a dummy or redirect.
    // For a cleaner landing, we might want to just show the card and a "Launch App" button if not logged in.

    // Client Wrapper to handle interactions cleanly

    return (
        <div className="min-h-screen bg-background bg-[url('/grid.svg')] text-textPrimary py-12 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-textSecondary hover:text-textPrimary transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Arena
                    </Link>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold text-green-500 uppercase">Live Market</span>
                    </div>
                </div>

                {/* Main Card Area */}
                <div className="mb-8">
                    <ClientCardWrapper bet={bet} />
                </div>

                {/* Call to Action */}
                <div className="text-center space-y-4">
                    <p className="text-white/60 text-sm">
                        Predictions are immutable and settled on-chain.
                    </p>
                    <Link
                        href="/"
                        className="block w-full bg-gradient-to-r from-primary to-secondary text-background font-black text-lg py-4 rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                    >
                        <Zap className="w-5 h-5" />
                        EXPLORE ALL BATTLES
                    </Link>
                </div>
            </div>
        </div>
    );
}
