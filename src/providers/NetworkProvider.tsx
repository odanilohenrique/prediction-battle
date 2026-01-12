'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { base, baseSepolia } from 'viem/chains';

type NetworkContextType = {
    isMainnet: boolean;
    toggleNetwork: () => void;
    currentChainId: number;
};

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
    // Default to Testnet (false) initially to be safe
    const [isMainnet, setIsMainnet] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem('prediction-battle-is-mainnet');
        if (stored) {
            setIsMainnet(stored === 'true');
        } else {
            // Default based on ENV if no storage
            setIsMainnet(process.env.NEXT_PUBLIC_USE_MAINNET === 'true');
        }
    }, []);

    const toggleNetwork = () => {
        const newValue = !isMainnet;
        setIsMainnet(newValue);
        localStorage.setItem('prediction-battle-is-mainnet', String(newValue));
        // Force reload to ensure all config/providers update cleanly
        window.location.reload();
    };

    const currentChainId = isMainnet ? base.id : baseSepolia.id;

    if (!mounted) return null; // Prevent hydration mismatch

    return (
        <NetworkContext.Provider value={{ isMainnet, toggleNetwork, currentChainId }}>
            {children}
        </NetworkContext.Provider>
    );
}

export function useNetwork() {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return context;
}
