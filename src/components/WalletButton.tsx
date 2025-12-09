'use client';

import { useState } from 'react';
import { Wallet, LogIn, LogOut, User } from 'lucide-react';

interface WalletButtonProps {
    onConnect?: () => void;
}

export default function WalletButton({ onConnect }: WalletButtonProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [farcasterUser, setFarcasterUser] = useState<{ username: string; fid: number } | null>(null);

    const handleConnectWallet = async () => {
        try {
            // TODO: Integrate with Coinbase OnchainKit wallet connection
            // For now, simulating connection

            // Check if MetaMask/wallet is available
            if (typeof window !== 'undefined' && (window as any).ethereum) {
                const accounts = await (window as any).ethereum.request({
                    method: 'eth_requestAccounts'
                });

                if (accounts && accounts[0]) {
                    setAddress(accounts[0]);
                    setIsConnected(true);
                    onConnect?.();
                }
            } else {
                alert('Por favor, instale uma carteira crypto (MetaMask, Coinbase Wallet, etc.)');
            }
        } catch (error) {
            console.error('Erro ao conectar carteira:', error);
            alert('Erro ao conectar carteira. Tente novamente.');
        }
    };

    const handleFarcasterLogin = async () => {
        try {
            // TODO: Integrate with Farcaster Auth
            // For now, simulating login
            alert('Login com Farcaster será implementado com MiniKit/OnchainKit');

            // Simulate successful login
            setFarcasterUser({
                username: 'demo_user',
                fid: 12345
            });
            setIsConnected(true);
        } catch (error) {
            console.error('Erro no login Farcaster:', error);
        }
    };

    const handleDisconnect = () => {
        setIsConnected(false);
        setAddress(null);
        setFarcasterUser(null);
    };

    const formatAddress = (addr: string) => {
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    if (isConnected && (address || farcasterUser)) {
        return (
            <div className="flex items-center gap-3">
                {/* User Info */}
                <div className="flex items-center gap-2 bg-surface border border-darkGray rounded-xl px-4 py-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-textPrimary">
                        {farcasterUser ? `@${farcasterUser.username}` : formatAddress(address!)}
                    </span>
                </div>

                {/* Disconnect Button */}
                <button
                    onClick={handleDisconnect}
                    className="flex items-center gap-2 bg-darkGray hover:bg-darkGray/70 text-textPrimary px-4 py-2 rounded-xl transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Sair</span>
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            {/* Connect Wallet Button */}
            <button
                onClick={handleConnectWallet}
                className="flex items-center gap-2 bg-primary hover:bg-secondary text-background font-bold px-4 py-2 rounded-xl transition-all"
            >
                <Wallet className="w-5 h-5" />
                <span>Conectar Wallet</span>
            </button>

            {/* Farcaster Login Button */}
            <button
                onClick={handleFarcasterLogin}
                className="flex items-center gap-2 bg-surface border border-primary hover:border-secondary text-primary hover:text-secondary px-4 py-2 rounded-xl transition-all"
            >
                <LogIn className="w-5 h-5" />
                <span className="font-medium">Login Farcaster</span>
            </button>
        </div>
    );
}
