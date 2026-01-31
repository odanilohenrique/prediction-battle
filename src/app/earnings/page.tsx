'use client';

import EarningsCard from '@/components/EarningsCard';
import { Wallet } from 'lucide-react';
import Navigation from '@/components/Navigation';

export default function EarningsPage() {
    return (
        <div className="min-h-screen bg-background">
            {/* Desktop Sidebar / Mobile Nav moved to layout ideally, but including Navigation here if not in root layout */}
            {/* Assuming Navigation is global in layout, but previous files suggest manual inclusion or layout wrapper. 
                Checking layout.tsx later. For now, we assume layout handles main structure or we just render content. 
                Based on admin/page.tsx, it seems pages handle their content. 
                Let's stick to content only as Layout likely wraps it.
            */}

            <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 rounded-xl bg-green-500/20 text-green-400">
                        <Wallet className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-wide">
                            My Earnings
                        </h1>
                        <p className="text-textSecondary">
                            Manage your rewards, accumulating fees, and bond returns.
                        </p>
                    </div>
                </div>

                <div className="grid gap-8">
                    {/* Main Earnings Card */}
                    <EarningsCard />

                    {/* Information Section */}
                    <div className="bg-surface border border-darkGray rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4">
                            How Earnings Work
                        </h2>
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <h3 className="text-primary font-bold">Creator Fees (5%)</h3>
                                <p className="text-sm text-textSecondary leading-relaxed">
                                    As a market creator, you earn 5% of the total pot for every market you create.
                                    These fees accumulate here and can be claimed at any time.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-purple-400 font-bold">Referral Rewards (5%)</h3>
                                <p className="text-sm text-textSecondary leading-relaxed">
                                    When users bet using your referral link, you earn 5% of their bet amount.
                                    Share your link to start earning passively!
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-yellow-400 font-bold">Bond Returns</h3>
                                <p className="text-sm text-textSecondary leading-relaxed">
                                    If you successfully resolved a dispute (Proposer), your bond plus the challenger's bond
                                    and a 1% reward from the pool will appear here after resolution.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
