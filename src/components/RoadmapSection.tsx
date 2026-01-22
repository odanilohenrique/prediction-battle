'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Zap, Shield, Trophy, Smartphone, Globe } from 'lucide-react';

const ROADMAP_ITEMS = [
    {
        title: "UX/UI Revolution",
        description: "Complete overhaul of the visual experience. Glassmorphism, premium animations, and mobile-first design.",
        status: "current",
        icon: Zap
    },
    {
        title: "Base Miniapp Integration",
        description: "Seamless integration within the Base ecosystem. One-click connection and optimized performance.",
        status: "upcoming",
        icon: Smartphone
    },
    {
        title: "Leaderboard Activation",
        description: "Compete for the top spot. Weekly rankings, badges, and reputation tracking.",
        status: "upcoming",
        icon: Trophy
    },
    {
        title: "PvP Tournaments",
        description: "Direct player-vs-player betting battles. Challenge friends and prove your prediction skills.",
        status: "upcoming",
        icon: Shield
    },
    {
        title: "X (Twitter) Integration",
        description: "Bet directly on X content. Viral prediction markets for the broader social web.",
        status: "upcoming",
        icon: Globe
    },
    {
        title: "Direct Onramp",
        description: "Fiat-to-Crypto made easy. Top up your balance without leaving the app.",
        status: "upcoming",
        icon: CheckCircle2
    },
];

export default function RoadmapSection() {
    return (
        <section className="py-20 px-4 md:px-0 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[500px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="max-w-4xl mx-auto relative z-10">
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase text-white">
                        Battle <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">Roadmap</span>
                    </h2>
                    <p className="text-white/60 max-w-xl mx-auto font-medium">
                        The future of decentralized social prediction markets.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {ROADMAP_ITEMS.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className="group relative p-6 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <item.icon className="w-24 h-24 text-primary" />
                            </div>

                            <div className="relative z-10 flex flex-col h-full">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-3 rounded-xl ${item.status === 'current' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'bg-white/10 text-white/60'}`}>
                                        <item.icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="text-xl font-bold text-white">{item.title}</h3>
                                        <span className={`text-[10px] font-black uppercase tracking-wider ${item.status === 'current' ? 'text-primary' : 'text-white/30'}`}>
                                            {item.status === 'current' ? 'In Progress' : 'Upcoming'}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-sm text-white/60 leading-relaxed font-medium">
                                    {item.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
