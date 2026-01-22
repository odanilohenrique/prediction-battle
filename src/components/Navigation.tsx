'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Flame, User, Trophy, LayoutGrid, Book, Users, Wallet, Menu } from 'lucide-react';
// import { cn } from '@/lib/utils'; // Removed to avoid error
import { motion } from 'framer-motion';
import WalletButton from './WalletButton';
import NetworkToggle from './NetworkToggle';
import Image from 'next/image';

// Utility for classes if lib/utils not present (standard in specialized setups, but just in case)
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cnLocal(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const NAV_ITEMS = [
    { label: 'Home', href: '/', icon: Home, active: true },
    { label: 'Trending', href: '/trending', icon: Flame, active: false, soon: true },
    { label: 'Profile', href: '/profile', icon: User, active: true },
    { label: 'Leaderboard', href: '/leaderboard', icon: Trophy, active: false, soon: true },
    { label: 'Categories', href: '/categories', icon: LayoutGrid, active: false, soon: true },
    { label: 'Docs', href: '/docs', icon: Book, active: true }, // Maybe link to external?
    { label: 'Community', href: '/community', icon: Users, active: true }, // Warpcast link?
];

export default function Navigation() {
    const pathname = usePathname();

    return (
        <>
            {/* DESKTOP SIDEBAR */}
            <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 z-50 bg-black/40 backdrop-blur-xl border-r border-white/5">
                {/* Logo Area - Adjusted to fill area and center */}
                <div className="p-8 flex flex-col items-center justify-center gap-4 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
                    <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden shrink-0 ring-4 ring-white/5">
                        <Image
                            src="/icon.png"
                            alt="Logo"
                            width={80}
                            height={80}
                            className="object-cover"
                        />
                    </div>
                    <div className="text-center">
                        <h1 className="text-xl font-black text-white italic tracking-widest uppercase leading-none mb-1">
                            BATTLE
                        </h1>
                        <h1 className="text-xl font-black text-primary italic tracking-widest uppercase leading-none">
                            ARENA
                        </h1>
                    </div>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;

                        // If "Soon", disable link behavior roughly
                        const Tag = item.soon ? 'div' : Link;

                        return (
                            <Tag
                                key={item.label}
                                href={item.soon ? '#' : item.href}
                                className={cnLocal(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative cursor-pointer",
                                    isActive
                                        ? "bg-primary/20 text-white"
                                        : "text-white/40 hover:text-white hover:bg-white/5",
                                    item.soon && "opacity-60 cursor-not-allowed hover:bg-transparent hover:text-white/40"
                                )}
                            >
                                <item.icon className={cnLocal(
                                    "w-5 h-5 transition-colors",
                                    isActive ? "text-primary" : "group-hover:text-white"
                                )} />
                                <span className="font-bold text-sm tracking-wide">{item.label}</span>

                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabDesktop"
                                        className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}

                                {item.soon && (
                                    <span className="ml-auto text-[9px] font-black uppercase bg-white/5 px-1.5 py-0.5 rounded text-white/30 tracking-wider">
                                        Soon
                                    </span>
                                )}
                            </Tag>
                        );
                    })}
                </div>

                {/* Footer / Wallet Area - Constrained and Centered */}
                <div className="p-4 border-t border-white/5 bg-black/40 flex flex-col gap-3">
                    <div className="w-full">
                        <NetworkToggle />
                    </div>
                    <div className="w-full">
                        <WalletButton />
                    </div>
                </div>
            </aside>

            {/* MOBILE TOP BAR (Header Replacement) */}
            <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-black/60 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow shadow-primary/20 overflow-hidden">
                        <Image
                            src="/icon.png"
                            alt="Logo"
                            width={32}
                            height={32}
                            className="object-cover"
                        />
                    </div>
                    <span className="text-sm font-black text-white italic tracking-wide">ARENA</span>
                </div>
                <div className="flex items-center gap-2">
                    <NetworkToggle />
                    <WalletButton />
                </div>
            </header>

            {/* MOBILE BOTTOM NAV */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[80px] bg-black/80 backdrop-blur-xl border-t border-white/5 z-50 px-2 pb-5 pt-2 flex items-center justify-between">
                {/* We pick 4-5 main items for mobile */}
                {[NAV_ITEMS[0], NAV_ITEMS[1], { label: 'Create', href: '/create', icon: LayoutGrid, active: true }, NAV_ITEMS[3], NAV_ITEMS[2]].map((item) => {
                    // Hacky middle button or just standard?
                    // Let's standard for now.
                    // Mapping: Home, Trending, LEADERBOARD? No, let's substitute Create or just keep standards.
                    // User's request: Home, Trending, Profile, Leaderboard, Categs, Docs, Comm.
                    // Mobile fit: Home, Trending, Leaderboard, Profile.
                    // Let's do: Home, Trending, (Create?), Leaderboard, Profile.

                    // actually let's stick to the list I decided: Home, Trending, Leaderboard, Profile.
                    // Wait, the map above uses a manual array.
                    return null;
                })}

                {/* Actual rendering */}
                {['/', '/trending', '/create', '/leaderboard', '/profile'].map((path, idx) => {
                    // Custom mapping for Mobile Bottom Bar visualization
                    let item = NAV_ITEMS.find(n => n.href === path);
                    if (path === '/create') {
                        // Central Action Button
                        return (
                            <Link href="/create" key="mob-create" className="relative -top-5">
                                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-black">
                                    <LayoutGrid className="w-6 h-6 text-white" />
                                </div>
                            </Link>
                        )
                    }

                    if (!item && path === '/leaderboard') item = NAV_ITEMS.find(n => n.label === 'Leaderboard');
                    if (!item) return null; // Should not happen

                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={`mob-${item.label}`}
                            href={item.soon ? '#' : item.href}
                            className="flex flex-col items-center gap-1 min-w-[60px]"
                        >
                            <div className={cnLocal(
                                "p-1.5 rounded-xl transition-all",
                                isActive ? "bg-white/10 text-primary" : "text-white/40"
                            )}>
                                <item.icon className="w-5 h-5" />
                            </div>
                            <span className={cnLocal(
                                "text-[10px] font-medium",
                                isActive ? "text-white" : "text-white/40"
                            )}>
                                {item.label}
                                {item.soon && <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-primary" />}
                            </span>
                        </Link>
                    );
                })}


            </nav>
        </>
    );
}
