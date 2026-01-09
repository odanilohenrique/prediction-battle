'use client';

import { Wallet, LogOut, User } from 'lucide-react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useModal } from '@/providers/ModalProvider';
import { SignInButton, useProfile } from '@farcaster/auth-kit';
import { useFarcasterMiniApp } from '@/providers/FarcasterMiniAppProvider';

interface WalletButtonProps {
    onConnect?: () => void;
}

export default function WalletButton({ onConnect }: WalletButtonProps) {
    const { showAlert } = useModal();
    const { isConnected, address } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();

    // 1. Mini App Context (Auto-Login)
    const { isMiniApp, user: miniAppUser } = useFarcasterMiniApp();

    // 2. Web Auth Kit - useProfile to check auth state
    const { isAuthenticated, profile } = useProfile();

    const handleConnectWallet = () => {
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

    const handleDisconnect = () => {
        if (isConnected) disconnect();
        // Note: SignInButton handles its own sign-out state
    };

    const formatAddress = (addr: string) => {
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    // Unified Auth Logic
    const isWebAuthenticated = isAuthenticated && !!profile;
    const isMiniAppAuthenticated = !!miniAppUser;
    const isLoggedIn = isConnected || isWebAuthenticated || isMiniAppAuthenticated;

    // Display Name Logic
    const getFarcasterName = () => {
        if (miniAppUser?.username) return `@${miniAppUser.username}`;
        if (profile?.username) return `@${profile.username}`;
        return 'Farcaster User';
    };

    if (isLoggedIn) {
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

                {/* Identity Badge */}
                <div className="flex items-center gap-2 bg-surface border border-darkGray rounded-xl px-3 py-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-textPrimary">
                        {isWebAuthenticated || isMiniAppAuthenticated
                            ? getFarcasterName()
                            : (address && formatAddress(address))}
                    </span>
                </div>

                {/* Logout - Only for wallet/web auth, not Mini App */}
                {(!isMiniAppAuthenticated) && (
                    <button
                        onClick={handleDisconnect}
                        className="flex items-center gap-2 bg-darkGray hover:bg-red-500/20 hover:text-red-400 text-textPrimary px-3 py-2 rounded-xl transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium hidden sm:inline">Logout</span>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            {/* Wallet Connect Button */}
            <button
                onClick={handleConnectWallet}
                className="flex items-center gap-1.5 bg-primary hover:bg-secondary text-background font-bold px-3 py-1.5 rounded-lg transition-all text-xs md:text-sm md:px-4 md:py-2"
            >
                <Wallet className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>Wallet</span>
            </button>

            {/* Official Farcaster SignInButton - Only show on Web, not Mini App */}
            {!isMiniApp && (
                <SignInButton
                    onSuccess={({ fid, username }) => {
                        console.log('Farcaster auth success:', { fid, username });
                    }}
                    onError={(error) => {
                        console.error('Farcaster auth error:', error);
                        showAlert('Login Error', String(error), 'error');
                    }}
                />
            )}
        </div>
    );
}

