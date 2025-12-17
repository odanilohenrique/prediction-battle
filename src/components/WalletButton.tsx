'use client';

import { useState } from 'react';
import { Wallet, LogOut, User } from 'lucide-react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

interface WalletButtonProps {
    onConnect?: () => void;
}

export default function WalletButton({ onConnect }: WalletButtonProps) {
    const { isConnected, address } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();

    const handleConnectWallet = () => {
        // Priority: Injected (Rabby/MetaMask) > MetaMask > Coinbase
        const injectedConnector = connectors.find((c) => c.id === 'injected');
        const metaMaskConnector = connectors.find((c) => c.id === 'metaMask');
        const coinbaseConnector = connectors.find((c) => c.id === 'coinbaseWalletSDK');

        const targetConnector = injectedConnector || metaMaskConnector || coinbaseConnector || connectors[0];

        if (!targetConnector) {
            alert('No wallet found. Please install Rabby or MetaMask.');
            return;
        }

        try {
            connect({ connector: targetConnector });
            onConnect?.();
        } catch (error) {
            console.error('Error connecting wallet:', error);
            alert('Error connecting wallet. Please try again.');
        }
    };

    const handleDisconnect = () => {
        disconnect();
    };

    const formatAddress = (addr: string) => {
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    if (isConnected && address) {
        return (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-surface border border-darkGray rounded-xl px-4 py-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-textPrimary">
                        {formatAddress(address)}
                    </span>
                </div>

                <button
                    onClick={handleDisconnect}
                    className="flex items-center gap-2 bg-darkGray hover:bg-darkGray/70 text-textPrimary px-4 py-2 rounded-xl transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Logout</span>
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleConnectWallet}
            className="flex items-center gap-2 bg-primary hover:bg-secondary text-background font-bold px-4 py-2 rounded-xl transition-all"
        >
            <Wallet className="w-5 h-5" />
            <span>Connect Wallet</span>
        </button>
    );
}
