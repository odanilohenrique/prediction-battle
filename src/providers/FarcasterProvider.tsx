'use client';

import { AuthKitProvider } from '@farcaster/auth-kit';
import '@farcaster/auth-kit/styles.css';

const config = {
    rpcUrl: 'https://mainnet.optimism.io',
    domain: 'predictionbattle.xyz',
    siweUri: 'https://predictionbattle.xyz/login',
    relay: 'https://relay.farcaster.xyz',
};

export default function FarcasterProvider({ children }: { children: React.ReactNode }) {
    return (
        <AuthKitProvider config={config}>
            {children}
        </AuthKitProvider>
    );
}
