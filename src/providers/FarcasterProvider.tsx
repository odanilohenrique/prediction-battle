'use client';

import { AuthKitProvider } from '@farcaster/auth-kit';
import '@farcaster/auth-kit/styles.css';

const config = {
    rpcUrl: 'https://mainnet.optimism.io',
    domain: process.env.NEXT_PUBLIC_URL ? new URL(process.env.NEXT_PUBLIC_URL).host : 'predictionbattle.xyz',
    siweUri: process.env.NEXT_PUBLIC_URL ? `${process.env.NEXT_PUBLIC_URL}/login` : 'https://predictionbattle.xyz/login',
    relay: 'https://relay.farcaster.xyz',
};

export default function FarcasterProvider({ children }: { children: React.ReactNode }) {
    return (
        <AuthKitProvider config={config}>
            {children}
        </AuthKitProvider>
    );
}
