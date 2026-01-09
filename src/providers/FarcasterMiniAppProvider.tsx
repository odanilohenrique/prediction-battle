'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import sdk from '@farcaster/frame-sdk';

interface FarcasterUser {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
}

interface FarcasterMiniAppContextType {
    isMiniApp: boolean;
    user: FarcasterUser | null;
    isLoading: boolean;
}

const FarcasterMiniAppContext = createContext<FarcasterMiniAppContextType>({
    isMiniApp: false,
    user: null,
    isLoading: true,
});

export const useFarcasterMiniApp = () => useContext(FarcasterMiniAppContext);

export default function FarcasterMiniAppProvider({ children }: { children: ReactNode }) {
    const [isMiniApp, setIsMiniApp] = useState(false);
    const [user, setUser] = useState<FarcasterUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            try {
                // Check if running in a frame context
                const context = await sdk.context;

                if (context && context.user) {
                    console.log('Farcaster Mini App detected:', context.user);
                    setIsMiniApp(true);
                    setUser({
                        fid: context.user.fid,
                        username: context.user.username,
                        displayName: context.user.displayName,
                        pfpUrl: context.user.pfpUrl,
                    });
                } else {
                    console.log('Not running in Farcaster Mini App context');
                }

                // Always signal ready
                await sdk.actions.ready();
            } catch (error) {
                console.error('Error initializing Farcaster Mini App:', error);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, []);

    return (
        <FarcasterMiniAppContext.Provider value={{ isMiniApp, user, isLoading }}>
            {children}
        </FarcasterMiniAppContext.Provider>
    );
}
