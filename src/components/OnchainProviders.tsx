'use client';

import { type ReactNode, useState } from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { config } from '@/lib/wagmi';
import FarcasterProvider from '@/providers/FarcasterProvider';
import { NetworkProvider, useNetwork } from '@/providers/NetworkProvider';

function ProvidersContent({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());
    const { isMainnet } = useNetwork();

    const selectedChain = isMainnet ? base : baseSepolia;

    return (
        <FarcasterProvider>
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                    <OnchainKitProvider
                        apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
                        chain={selectedChain as any}
                    >
                        {children}
                    </OnchainKitProvider>
                </QueryClientProvider>
            </WagmiProvider>
        </FarcasterProvider>
    );
}

export default function OnchainProviders({ children }: { children: ReactNode }) {
    return (
        <NetworkProvider>
            <ProvidersContent>{children}</ProvidersContent>
        </NetworkProvider>
    );
}
