'use client';

import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask } from 'wagmi/connectors';

const connectors = [
    metaMask(),
    coinbaseWallet({
        appName: 'Prediction Battle',
    }),
    injected(),
];

export const config = createConfig({
    chains: [base, baseSepolia],
    connectors,
    transports: {
        [base.id]: http(),
        [baseSepolia.id]: http(),
    },
    ssr: true,
});
