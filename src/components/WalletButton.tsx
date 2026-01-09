'use client';

import { useState } from 'react';
import { Wallet, LogIn, LogOut, User } from 'lucide-react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

interface WalletButtonProps {
    onConnect?: () => void;
}

import { useModal } from '@/providers/ModalProvider';

// ... (interface)

import { useSignIn, useProfile } from '@farcaster/auth-kit';

export default function WalletButton({ onConnect }: WalletButtonProps) {
    const { showAlert } = useModal();
    const { isConnected, address } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();

    // Farcaster Auth Kit Hooks
    const { signIn, signOut } = useSignIn({});
    const { isAuthenticated, profile } = useProfile();

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
        // DEBUG: Temporary alert to verify click functionality
        alert("DEBUG: Click received. Attempting login...");

        console.log("Attempting Farcaster Login...", { signIn });

        if (!signIn) {
            alert("CRITICAL ERROR: signIn function is undefined. AuthKit may not be initialized.");
            return;
        }

        try {
            await signIn();
        } catch (error) {
            console.error("Login failed:", error);
            // Show the actual error message in the alert
            alert(`Login Failed: ${error instanceof Error ? error.message : String(error)}`);
            showAlert('Login Error', 'Failed to initiate Farcaster login. Please try again.', 'error');
        }
    };

    const handleDisconnect = () => {
        if (isConnected) disconnect();
        if (isAuthenticated) signOut();
        // Note: Cannot "logout" of Mini App context easily as it's provided by the frame
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
                {/* Profile Link (Unified) */}
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

                {/* Logout (Only show if Web Auth or Wallet - Hiding for Mini App as it's native) */}
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
            <button
                onClick={handleConnectWallet}
                className="flex items-center gap-1.5 bg-primary hover:bg-secondary text-background font-bold px-3 py-1.5 rounded-lg transition-all text-xs md:text-sm md:px-4 md:py-2"
            >
                <Wallet className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>Wallet</span>
            </button>

            {/* Only show Farcaster Login if NOT in Mini App context (because Mini App auto-logs in) */}
            {!isMiniApp && (
                <button
                    onClick={handleFarcasterLogin}
                    className="relative z-10 flex items-center gap-1.5 bg-surface border border-primary hover:border-secondary text-primary hover:text-secondary px-3 py-1.5 rounded-lg transition-all text-xs md:text-sm md:px-4 md:py-2 whitespace-nowrap"
                >
                    <LogIn className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span>Farcaster Login</span>
                </button>
            )}
        </div>
    );
}
