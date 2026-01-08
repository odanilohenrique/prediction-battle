'use client';

import { useState } from 'react';
import { Wallet, LogIn, LogOut, User } from 'lucide-react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

interface WalletButtonProps {
    onConnect?: () => void;
}

import { useModal } from '@/providers/ModalProvider';

// ... (interface)

export default function WalletButton({ onConnect }: WalletButtonProps) {
    const { showAlert } = useModal();
    const { isConnected, address } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const [farcasterUser, setFarcasterUser] = useState<{ username: string; fid: number } | null>(null);

    const handleConnectWallet = () => {
        // Priority: Rabby (injected) > MetaMask > Coinbase
        const rabbyConnector = connectors.find((c) => c.id === 'io.rabby');
        const injectedConnector = connectors.find((c) => c.id === 'injected');
        const metaMaskConnector = connectors.find((c) => c.id === 'metaMask');
        const coinbaseConnector = connectors.find((c) => c.id === 'coinbaseWalletSDK');

        const targetConnector = rabbyConnector || injectedConnector || metaMaskConnector || coinbaseConnector || connectors[0];

        if (!targetConnector) {
            showAlert('Wallet Not Found', 'Please install Rabby or MetaMask.', 'warning');
            return;
        }

        connect({ connector: targetConnector });
        onConnect?.();
    };

    const handleFarcasterLogin = async () => {
        // TODO: Integrate with Farcaster Auth
        showAlert('Coming Soon', 'Farcaster login will be implemented with MiniKit/OnchainKit', 'info');
        // Removing demo toggle for now or keeping it? The user might use it for demo.
        // I will keep the state update as it was, but just show the alert first.
        setFarcasterUser({
            username: 'demo_user',
            fid: 12345
        });
    };

    const handleDisconnect = () => {
        disconnect();
        setFarcasterUser(null);
    };

    const formatAddress = (addr: string) => {
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    if (isConnected || farcasterUser) {
        return (
            <div className="flex items-center gap-2">
                {/* Profile Link */}
                <a
                    href="/profile"
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2 rounded-xl transition-colors"
                >
                    <User className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium hidden sm:inline">Profile</span>
                </a>

                {/* Wallet Address */}
                <div className="flex items-center gap-2 bg-surface border border-darkGray rounded-xl px-3 py-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-textPrimary">
                        {farcasterUser ? `@${farcasterUser.username}` : (address && formatAddress(address))}
                    </span>
                </div>

                {/* Logout */}
                <button
                    onClick={handleDisconnect}
                    className="flex items-center gap-2 bg-darkGray hover:bg-red-500/20 hover:text-red-400 text-textPrimary px-3 py-2 rounded-xl transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">Logout</span>
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <button
                onClick={handleConnectWallet}
                className="flex items-center gap-2 bg-primary hover:bg-secondary text-background font-bold px-4 py-2 rounded-xl transition-all"
            >
                <Wallet className="w-5 h-5" />
                <span>Connect Wallet</span>
            </button>

            <button
                onClick={handleFarcasterLogin}
                className="flex items-center gap-2 bg-surface border border-primary hover:border-secondary text-primary hover:text-secondary px-4 py-2 rounded-xl transition-all"
            >
                <LogIn className="w-5 h-5" />
                <span className="font-medium">Farcaster Login</span>
            </button>
        </div>
    );
}
