
import Link from 'next/link';
import { ArrowLeft, HelpCircle, Zap, ShieldCheck } from 'lucide-react';

export default function DocsPage() {
    return (
        <main className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Arena
                </Link>

                <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-4">
                    HOW IT WORKS
                </h1>
                <p className="text-xl text-white/60 mb-12">
                    Master the Arena. Learn how to create, bet, and win.
                </p>

                <div className="grid gap-8 md:grid-cols-2">
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                        <Zap className="w-8 h-8 text-primary mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">1. Create a Battle</h2>
                        <p className="text-white/60">
                            Find a spicy Cast on Farcaster. Copy the URL. Choose a metric (Likes, Recasts) and a target.
                            Set the deadline. You are now the Market Creator.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                        <HelpCircle className="w-8 h-8 text-purple-500 mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">2. Place Your Bet</h2>
                        <p className="text-white/60">
                            Connect your wallet (Base network). Choose YES if you think the target will be met, or NO if you doubt it.
                            Your funds are held in the smart contract.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                        <ShieldCheck className="w-8 h-8 text-green-500 mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">3. Verification</h2>
                        <p className="text-white/60">
                            When the deadline hits, our automated Oracle (Neynar API) checks the Cast stats.
                            The result is proposed on-chain.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-purple-500 flex items-center justify-center font-black text-black mb-4">$</div>
                        <h2 className="text-2xl font-bold text-white mb-2">4. Claim Winnings</h2>
                        <p className="text-white/60">
                            After the dispute window closes, if you picked the winning side, claim your share of the total pot (minus fees).
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
