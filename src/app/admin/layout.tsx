'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, LogOut, AlertCircle } from 'lucide-react';
import { isAdmin } from '@/lib/config';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    async function checkAuth() {
        try {
            // Check if wallet is connected
            if (typeof window !== 'undefined' && (window as any).ethereum) {
                const accounts = await (window as any).ethereum.request({
                    method: 'eth_accounts'
                });

                if (accounts && accounts[0]) {
                    const address = accounts[0];
                    setWalletAddress(address);

                    // Check if admin
                    if (isAdmin(address)) {
                        setIsAuthenticated(true);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking auth:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleConnect() {
        try {
            if (typeof window !== 'undefined' && (window as any).ethereum) {
                const accounts = await (window as any).ethereum.request({
                    method: 'eth_requestAccounts'
                });

                if (accounts && accounts[0]) {
                    const address = accounts[0];
                    setWalletAddress(address);

                    if (isAdmin(address)) {
                        setIsAuthenticated(true);
                    } else {
                        alert('⛔ Acesso Negado: Este endereço não é admin.');
                    }
                }
            } else {
                alert('Por favor, instale MetaMask ou Coinbase Wallet');
            }
        } catch (error) {
            console.error('Error connecting:', error);
        }
    }

    function handleDisconnect() {
        setWalletAddress(null);
        setIsAuthenticated(false);
        router.push('/');
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <div className="bg-surface border border-darkGray rounded-2xl p-8 text-center">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Shield className="w-8 h-8 text-primary" />
                        </div>

                        <h1 className="text-2xl font-bold text-textPrimary mb-2">
                            Painel Admin
                        </h1>
                        <p className="text-textSecondary mb-6">
                            Conecte sua carteira admin para continuar
                        </p>

                        {walletAddress && !isAdmin(walletAddress) && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <div className="text-left">
                                        <div className="font-bold text-red-500 mb-1">Acesso Negado</div>
                                        <div className="text-sm text-textSecondary">
                                            O endereço {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)} não tem permissão de admin.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleConnect}
                            className="w-full bg-primary hover:bg-secondary text-background font-bold py-3 px-6 rounded-xl transition-all"
                        >
                            Conectar Wallet Admin
                        </button>

                        <div className="mt-6 p-4 bg-darkGray/30 rounded-xl">
                            <p className="text-xs text-textSecondary">
                                💡 <strong>Testnet Mode:</strong> Usando Base Sepolia para testes
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Admin Header */}
            <header className="border-b border-darkGray bg-surface/50 backdrop-blur-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-textPrimary">
                                        Admin Panel
                                    </h1>
                                    <p className="text-xs text-textSecondary">
                                        {walletAddress?.substring(0, 6)}...{walletAddress?.substring(walletAddress.length - 4)}
                                    </p>
                                </div>
                            </div>

                            {/* Navigation */}
                            <nav className="flex items-center gap-1 bg-darkGray/30 p-1 rounded-lg">
                                <a
                                    href="/admin"
                                    className="px-4 py-2 text-sm font-medium text-textPrimary hover:bg-white/5 rounded-md transition-colors"
                                >
                                    Dashboard
                                </a>
                                <a
                                    href="/admin/payouts"
                                    className="px-4 py-2 text-sm font-medium text-textPrimary hover:bg-white/5 rounded-md transition-colors"
                                >
                                    Payouts
                                </a>
                            </nav>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-lg">
                                <span className="text-xs font-medium text-primary">🧪 TESTNET</span>
                            </div>

                            <button
                                onClick={handleDisconnect}
                                className="flex items-center gap-2 bg-darkGray hover:bg-darkGray/70 text-textPrimary px-4 py-2 rounded-xl transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="text-sm">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Admin Content */}
            <main>
                {children}
            </main>
        </div>
    );
}
