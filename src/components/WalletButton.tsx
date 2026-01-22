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
            <div className="flex items-center gap-2 w-full">
                {/* Identity Badge */}
                <div className="flex-1 flex items-center justify-center gap-1.5 bg-surface border border-darkGray rounded-lg px-2 py-2 min-w-0">
                    <Wallet className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs font-bold text-textPrimary truncate">
                        {isWebAuthenticated || isMiniAppAuthenticated
                            ? getFarcasterName()
                            : (address && formatAddress(address))}
                    </span>
                </div>

                {/* Logout - Compact */}
                {(!isMiniAppAuthenticated) && (
                    <button
                        onClick={handleDisconnect}
                        className="flex items-center justify-center gap-1.5 bg-darkGray hover:bg-red-500/20 hover:text-red-400 text-textPrimary px-2 py-2 rounded-lg transition-colors shrink-0"
                        title="Logout"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold sm:inline">Exit</span>
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
                <div className="login-button-wrapper">
                    <SignInButton
                        onSuccess={({ fid, username }) => {
                            console.log('Farcaster auth success:', { fid, username });
                        }}
                        onError={(error) => {
                            console.error('Farcaster auth error:', error);
                            showAlert('Login Error', String(error), 'error');
                        }}
                    />
                    <style jsx global>{`
                        .login-button-wrapper button {
                            background-color: rgb(var(--surface)) !important;
                            border: 1px solid rgb(var(--primary)) !important;
                            color: rgb(var(--primary)) !important;
                            font-size: 0.75rem !important; /* text-xs */
                            padding: 6px 12px !important;
                            border-radius: 0.5rem !important; /* rounded-lg */
                            height: auto !important;
                            min-height: 0 !important;
                            font-weight: 500 !important;
                            transition: all 0.2s !important;
                        }
                        .login-button-wrapper button:hover {
                            border-color: rgb(var(--secondary)) !important;
                            color: rgb(var(--secondary)) !important;
                        }
                        @media (min-width: 768px) {
                            .login-button-wrapper button {
                                font-size: 0.875rem !important; /* text-sm */
                                padding: 8px 16px !important;
                            }
                        }
                        .login-button-wrapper button .fc-auth-button-icon {
                            width: 14px !important;
                            height: 14px !important;
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}

