import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Circle, Clock } from 'lucide-react';

export default function RoadmapPage() {
    const steps = [
        {
            phase: "Phase 1: Inception",
            status: "completed",
            items: [
                "Launch on Base Testnet (Sepolia)",
                "Core Prediction Logic (Yes/No)",
                "Farcaster Integration (Warpcast)",
                "Basic Admin Tools"
            ]
        },
        {
            phase: "Phase 2: The Arena",
            status: "current",
            items: [
                "Battle Mode (PvP Predictions)",
                "Automated Verification (Neynar API)",
                "UI/UX Overhaul (Dark/Neon Theme)",
                "Mainnet Deployment (Base)"
            ]
        },
        {
            phase: "Phase 3: Community Governance",
            status: "upcoming",
            items: [
                "User-Created Markets",
                "Community Disputes / Resolution",
                "Leaderboard & Reputation System",
                "$BATTLE Governança Airdrop (?)"
            ]
        },
        {
            phase: "Phase 4: Expansion",
            status: "upcoming",
            items: [
                "Multi-chain Support",
                "Integration with other Social Graphs (Lens)",
                "Mobile App"
            ]
        }
    ];

    return (
        <main className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-3xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Arena
                </Link>

                <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                    PROJECT ROADMAP
                </h1>
                <p className="text-xl text-white/60 mb-12 leading-relaxed">
                    Our vision for the future of on-chain social accountability.
                </p>

                <div className="space-y-12 relative border-l-2 border-white/10 ml-4 md:ml-8 pl-8 md:pl-12 py-2">
                    {steps.map((step, index) => (
                        <div key={index} className="relative">
                            {/* Dot */}
                            <div className={`absolute -left-[41px] md:-left-[58px] top-1 w-5 h-5 md:w-6 md:h-6 rounded-full border-4 border-black flex items-center justify-center 
                                ${step.status === 'completed' ? 'bg-green-500 text-black' :
                                    step.status === 'current' ? 'bg-primary animate-pulse' : 'bg-white/10'}`}>
                            </div>

                            <div className="flex items-center gap-3 mb-4">
                                <h2 className={`text-2xl font-bold ${step.status === 'current' ? 'text-white' : 'text-white/40'}`}>
                                    {step.phase}
                                </h2>
                                {step.status === 'current' && (
                                    <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-bold rounded-full border border-primary/30 uppercase tracking-widest">
                                        Active
                                    </span>
                                )}
                            </div>

                            <ul className="space-y-3">
                                {step.items.map((item, i) => (
                                    <li key={i} className={`flex items-start gap-3 ${step.status === 'completed' ? 'text-white/60 line-through decoration-white/20' : 'text-white/80'}`}>
                                        {step.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /> :
                                            step.status === 'current' ? <Clock className="w-5 h-5 text-primary shrink-0" /> :
                                                <Circle className="w-5 h-5 text-white/20 shrink-0" />}
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
