'use client';

import { useState } from 'react';
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

    // Find Coinbase Wallet connector
    const coinbaseConnector = connectors.find((c) => c.id === 'coinbaseWalletSDK') || connectors[0];

    const handleConnectWallet = () => {
        try {
            connect({ connector: coinbaseConnector });
            onConnect?.();
        } catch (error) {
            console.error('Erro ao conectar carteira:', error);
            alert('Erro ao conectar carteira. Tente novamente.');
        }
    };

    const handleFarcasterLogin = async () => {
        try {
            // TODO: Integrate with Farcaster Auth
            alert('Login com Farcaster será implementado com MiniKit/OnchainKit');
            setFarcasterUser({
                username: 'demo_user',
                fid: 12345
            });
        } catch (error) {
            console.error('Erro no login Farcaster:', error);
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
                    <span className="text-sm font-medium">Sair</span>
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
                <span>Conectar Wallet</span>
            </button>

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
