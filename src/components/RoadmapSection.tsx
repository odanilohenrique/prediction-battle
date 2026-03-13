'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Zap, Shield, Trophy, Smartphone, Globe, TrendingUp, CreditCard } from 'lucide-react';

const ROADMAP_ITEMS = [
    {
        title: "Foundation (Complete)",
        description: "Core smart contract (v1.0), Base Sepolia testnet, frontend MVP, decentralized resolution logic, and referral system.",
        status: "current",
        icon: CheckCircle2
    },
    {
        title: "Base & Farcaster Native App",
        description: "Deep integration within the Base ecosystem and Farcaster clients for instant distribution and one-click connection.",
        status: "upcoming",
        icon: Smartphone
    },
    {
        title: "Viral Social Hooks",
        description: "Automated winner flex-cards and one-click sharing mechanics to drive organic growth across all platforms.",
        status: "upcoming",
        icon: Zap
    },
    {
        title: "Omnichannel Integrations",
        description: "Expanding prediction markets beyond Farcaster to include TikTok, YouTube, Instagram, and other major social networks.",
        status: "upcoming",
        icon: Globe
    },
    {
        title: "Decentralized Oracles",
        description: "Integration with UMA or Kleros to fully decentralize the dispute resolution process, removing the dependency on a central Administrator.",
        status: "upcoming",
        icon: Shield
    },
    {
        title: "Orderbook & AMM Transition",
        description: "Upgrading from the Pari-Mutuel model to an automated market maker or orderbook, enabling advanced position trading.",
        status: "upcoming",
        icon: TrendingUp
    },
    {
        title: "Fiat Onramp Solution",
        description: "Direct fiat-to-crypto payments allowing mainstream users to participate seamlessly without holding ETH.",
        status: "upcoming",
        icon: CreditCard
    },
    {
        title: "Governance & Tokenization",
        description: "Launch of the native token to initiate full protocol decentralization, where staked tokens will be the central element in result verification, dispute arbitration solutions, voting, and protocol governance.",
        status: "upcoming",
        icon: Trophy
    },
];

export default function RoadmapSection() {
    return (
        <section className="py-20 px-4 md:px-8 relative overflow-hidden bg-[#0F0F0F]">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-purple-500/5 blur-[150px] rounded-full pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10 w-full">
                <div className="text-center mb-24 space-y-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="py-2"
                    >
                        <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase text-white drop-shadow-sm leading-tight">
                            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400 pr-2">Master</span> Plan
                        </h2>
                    </motion.div>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-white/40 max-w-xl mx-auto font-medium text-sm md:text-base"
                    >
                        A clear, uncompromising path to becoming the liquidity layer for all social consensus.
                    </motion.p>
                </div>

                {/* Timeline Container */}
                <div className="relative w-full">
                    {/* Central Vertical Line (Desktop) */}
                    <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2" />
                    
                    {/* Animated Ray on the central line */}
                    <motion.div 
                        className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/50 to-transparent -translate-x-1/2"
                        initial={{ height: "0%" }}
                        whileInView={{ height: "100%" }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        viewport={{ once: true, margin: "-50px" }}
                    />

                    {/* Timeline Vertical Line (Mobile) */}
                    <div className="block md:hidden absolute left-6 top-0 bottom-0 w-px bg-white/5" />

                    <div className="space-y-12 md:space-y-20">
                        {ROADMAP_ITEMS.map((item, index) => {
                            const isEven = index % 2 === 0;
                            const isCompleted = item.status === 'current';

                            return (
                                <div key={index} className="relative flex flex-col md:flex-row items-center justify-between w-full">
                                    
                                    {/* Left Spacer (Desktop) - Only show if odd */}
                                    {!isEven && <div className="hidden md:block w-full md:w-[45%]" />}

                                    {/* Content (Desktop) */}
                                    <div className={`hidden md:flex w-full md:w-[45%] ${isEven ? 'justify-end md:pr-16 lg:pr-24' : 'justify-start md:pl-16 lg:pl-24'}`}>
                                        <motion.div
                                            initial={{ opacity: 0, x: isEven ? -20 : 20 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.4, delay: index * 0.1 }}
                                            viewport={{ once: true, margin: "-50px" }}
                                            className={`w-full max-w-md text-left`}
                                        >
                                            <div className="group p-6 md:p-8 rounded-2xl md:rounded-3xl bg-white/[0.015] border border-white/5 hover:bg-white/[0.03] hover:border-white/10 backdrop-blur-md transition-all duration-300 shadow-sm relative overflow-hidden">
                                                {/* Ambient subtle glow inside card based on status */}
                                                {isCompleted && <div className="absolute inset-0 bg-primary/5 opacity-50 pointer-events-none mix-blend-screen" />}
                                                
                                                <div className="flex items-center gap-4 mb-4 flex-row">
                                                    <div className={`p-3 rounded-xl flex-shrink-0 ${isCompleted ? 'bg-primary/10 text-primary' : 'bg-white/[0.03] text-white/30 group-hover:text-white/60'} transition-colors`}>
                                                        <item.icon className="w-5 h-5 md:w-6 md:h-6" />
                                                    </div>
                                                    <h3 className={`text-base md:text-lg tracking-wider uppercase font-bold ${isCompleted ? 'text-primary' : 'text-white/80'}`}>
                                                        {item.title}
                                                    </h3>
                                                </div>
                                                <p className="text-white/50 text-sm leading-relaxed font-light text-left">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* Right Spacer (Desktop) */}
                                    {isEven && <div className="hidden md:block w-full md:w-[45%]" />}

                                    {/* Center Node (Desktop) */}
                                    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-8 h-8 items-center justify-center z-20">
                                        <motion.div
                                            initial={{ scale: 0, opacity: 0 }}
                                            whileInView={{ scale: 1, opacity: 1 }}
                                            transition={{ duration: 0.3, delay: (index * 0.1) + 0.1 }}
                                            viewport={{ once: true }}
                                            className={`w-3 h-3 rounded-full border-2 ${isCompleted ? 'bg-primary border-primary shadow-[0_0_15px_rgba(255,149,0,0.8)]' : 'bg-[#0F0F0F] border-white/20'} z-20`}
                                        />
                                        {isCompleted && (
                                            <div className="absolute w-8 h-8 rounded-full bg-primary/20 animate-ping opacity-50" />
                                        )}
                                    </div>

                                    {/* Mobile Layout */}
                                    <div className="flex md:hidden w-full pl-16 relative">
                                        {/* Mobile Node */}
                                        <div className="absolute left-6 -translate-x-1/2 top-5 w-8 h-8 flex items-center justify-center z-20">
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                whileInView={{ scale: 1 }}
                                                viewport={{ once: true }}
                                                className={`w-2.5 h-2.5 rounded-full border-2 ${isCompleted ? 'bg-primary border-primary shadow-[0_0_8px_rgba(255,149,0,0.6)]' : 'bg-[#0F0F0F] border-white/20'}`}
                                            />
                                        </div>

                                        <motion.div
                                            initial={{ opacity: 0, y: 15 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4 }}
                                            viewport={{ once: true }}
                                            className="w-full"
                                        >
                                            <div className="p-5 rounded-xl bg-white/[0.015] border border-white/5 backdrop-blur-md">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className={`p-2 rounded-lg ${isCompleted ? 'bg-primary/10 text-primary' : 'bg-white/[0.03] text-white/30'}`}>
                                                        <item.icon className="w-4 h-4" />
                                                    </div>
                                                    <h3 className="text-sm tracking-wide uppercase font-bold text-white/80">
                                                        {item.title}
                                                    </h3>
                                                </div>
                                                <p className="text-xs text-white/50 leading-relaxed font-light">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </motion.div>
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
