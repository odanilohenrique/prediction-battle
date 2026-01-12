'use client';

import { useNetwork } from '@/providers/NetworkProvider';
import { RefreshCcw } from 'lucide-react';

export default function NetworkToggle() {
    const { isMainnet, toggleNetwork } = useNetwork();

    return (
        <button
            onClick={toggleNetwork}
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                ${isMainnet
                    ? 'bg-blue-500/10 border-blue-500 text-blue-400 hover:bg-blue-500/20'
                    : 'bg-green-500/10 border-green-500 text-green-400 hover:bg-green-500/20'}
            `}
            title="Click to switch network"
        >
            <RefreshCcw className="w-3 h-3" />
            <span>{isMainnet ? 'LIVE (Mainnet)' : 'TEST (Sepolia)'}</span>
        </button>
    );
}
