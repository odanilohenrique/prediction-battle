'use client';

import { AuthKitProvider } from '@farcaster/auth-kit';
import '@farcaster/auth-kit/styles.css';

const config = {
    rpcUrl: 'https://mainnet.optimism.io',
    domain: 'prediction-battle.vercel.app',
    siweUri: 'https://prediction-battle.vercel.app/login',
    relay: 'https://relay.farcaster.xyz',
};

export default function FarcasterProvider({ children }: { children: React.ReactNode }) {
    return (
        <AuthKitProvider config={config}>
            {children}
        </AuthKitProvider>
    );
}
