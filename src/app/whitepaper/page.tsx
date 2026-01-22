
import Link from 'next/link';
import { ArrowLeft, BookOpen, Shield, Scroll } from 'lucide-react';

export default function WhitepaperPage() {
    return (
        <main className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Arena
                </Link>

                <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                    BATTLE ARENA WP
                </h1>
                <p className="text-xl text-white/60 mb-12">
                    Version 1.0 - The Official Whitepaper
                </p>

                <div className="space-y-12 text-white/80 leading-relaxed font-light">
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-primary" />
                            1. Introduction
                        </h2>
                        <p>
                            Prediction Battle is the ultimate on-chain social prediction arena built on Base.
                            It bridges the gap between social engagement on Farcaster and financial accountability on the blockchain.
                            Users can bet on the outcome of real social interactions—likes, recasts, and replies—turning social capital into tangible value.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Shield className="w-6 h-6 text-primary" />
                            2. Core Mechanism
                        </h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Create:</strong> Any user can create a prediction market based on a Farcaster Cast URL.</li>
                            <li><strong>Bet:</strong> Users stake USDC on YES (Target Hit) or NO (Target Miss).</li>
                            <li><strong>Verify:</strong> We utilize the Neynar API for automated verification of social metrics.</li>
                            <li><strong>Resolve:</strong> Markets are resolved trustlessly. Winners interact with the contract to claim their share of the pool.</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Scroll className="w-6 h-6 text-primary" />
                            3. Tokenomics & Fees
                        </h2>
                        <p>
                            The platform operates on a lean fee model to sustain development and the community treasury.
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Platform Fee:</strong> 2% on winning pots.</li>
                            <li><strong>Referral Reward:</strong> 1% goes to the referrer (if applicable).</li>
                            <li><strong>Creator Reward:</strong> 1% goes to the market creator.</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Shield className="w-6 h-6 text-primary" />
                            4. Security & Decentralization
                        </h2>
                        <p>
                            Built on Base for low fees and high security. Contracts are verified and non-custodial.
                            Disputes can be raised during a specific window, allowing the community (via governance) to overturn incorrect automated results.
                        </p>
                    </section>
                </div>
            </div>
        </main>
    );
}
