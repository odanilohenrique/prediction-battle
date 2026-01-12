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
                            <div className="flex flex-col min-h-screen">
                                <div className="flex-grow">
                                    {children}
                                </div>
                                <Footer />
                            </div>
                        </ModalProvider>
                    </OnchainProviders>
                </FarcasterMiniAppProvider>
            </body>
        </html>
    );
}
