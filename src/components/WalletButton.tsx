'use client';

import { useState, useEffect } from 'react';
import { Wallet, LogIn, LogOut, User } from 'lucide-react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

interface WalletButtonProps {
    onConnect?: () => void;
}

export default function WalletButton({ onConnect }: WalletButtonProps) {
    const { isConnected, address } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const [farcasterUser, setFarcasterUser] = useState<{ username: string; fid: number } | null>(null);

    const [showWalletModal, setShowWalletModal] = useState(false);

    const handleConnectClick = () => {
        if (connectors.length === 0) {
            alert('No wallet connectors found. Please install a wallet.');
            return;
        }
        setShowWalletModal(true);
    };

    const handleConnect = (connector: any) => {
        try {
            connect({ connector });
            onConnect?.();
            setShowWalletModal(false);
        } catch (error) {
            console.error('Error connecting wallet:', error);
            alert('Error connecting wallet. Please try again.');
        }
    };

    const handleFarcasterLogin = async () => {
        try {
            // TODO: Integrate with Farcaster Auth
            alert('Farcaster login will be implemented with MiniKit/OnchainKit');
            setFarcasterUser({
                username: 'demo_user',
                fid: 12345
            });
        } catch (error) {
            console.error('Farcaster login error:', error);
        }
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
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-surface border border-darkGray rounded-xl px-4 py-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-textPrimary">
                        {farcasterUser ? `@${farcasterUser.username}` : (address && formatAddress(address))}
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
        <>
            <div className="flex items-center gap-3">
                <button
                    onClick={handleConnectClick}
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

            {/* Wallet Selection Modal */}
            {showWalletModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-darkGray rounded-3xl max-w-sm w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-textPrimary">Connect Wallet</h3>
                            <button
                                onClick={() => setShowWalletModal(false)}
                                className="w-8 h-8 rounded-full bg-darkGray flex items-center justify-center hover:bg-darkGray/70"
                            >
                                <span className="text-textSecondary">✕</span>
                            </button>
                        </div>

                        <div className="space-y-3">
                            {connectors.map((connector) => (
                                <button
                                    key={connector.id}
                                    onClick={() => handleConnect(connector)}
                                    className="w-full flex items-center justify-between p-4 rounded-xl border border-darkGray hover:border-primary/50 hover:bg-darkGray/20 transition-all group"
                                >
                                    <span className="font-medium text-textPrimary group-hover:text-primary">
                                        {connector.name}
                                    </span>
                                    {connector.icon && (
                                        <img src={connector.icon} alt={connector.name} className="w-6 h-6" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
