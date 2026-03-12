'use client';

import { ShieldCheck } from 'lucide-react';

export default function NetworkToggle() {
    // Replaced the toggle button with a static badge to force Mainnet usage
    return (
        <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-blue-500/10 border border-blue-500/30 text-blue-400"
            title="Application is running securely on Base Mainnet"
        >
            <ShieldCheck className="w-3 h-3" />
            <span>BASE MAINNET</span>
        </div>
    );
}
