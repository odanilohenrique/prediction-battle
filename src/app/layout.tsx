import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import OnchainProviders from "@/components/OnchainProviders";
import FarcasterMiniAppProvider from "@/providers/FarcasterMiniAppProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Prediction Battle - Bet on Farcaster Casts",
    description: "Bet USDC on whether Farcaster casts will hit engagement targets. Win big if you're right!",
    manifest: '/manifest.json',
    other: {
        "fc:frame": "vNext",
        "fc:frame:image": "https://predictionbattle.xyz/og-image.png",
        "fc:frame:button:1": "Launch App",
        "fc:frame:button:1:action": "link",
        "fc:frame:button:1:target": "https://predictionbattle.xyz"
    }
};

import { ModalProvider } from "@/providers/ModalProvider";

// ... previous code ...

import Footer from "@/components/Footer";

// ... existing code ...

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <FarcasterMiniAppProvider>
                    <OnchainProviders>
                        <ModalProvider>
                            <div className="flex min-h-screen bg-[#0a0a0a]"> {/* Dark bg enforced */}
                                <NavigationWrapper />
                                <main className="flex-1 md:ml-64 pt-16 md:pt-0 pb-20 md:pb-0 min-h-screen flex flex-col">
                                    {children}
                                    {/* Spacer to push footer below the fold */}
                                    <div className="min-h-[50vh]" />
                                    <div className="md:ml-0">
                                        <Footer />
                                    </div>
                                </main>
                            </div>
                        </ModalProvider>
                    </OnchainProviders>
                </FarcasterMiniAppProvider>
            </body>
        </html>
    );
}

import Navigation from "@/components/Navigation";
function NavigationWrapper() {
    return <Navigation />;
}
