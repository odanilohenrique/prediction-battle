import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import OnchainProviders from "@/components/OnchainProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Prediction Battle - Bet on Farcaster Casts",
    description: "Bet USDC on whether Farcaster casts will hit engagement targets. Win big if you're right!",
    manifest: '/manifest.json',
    other: {
        "fc:frame": "vNext",
        "fc:frame:image": "https://prediction-battle.vercel.app/og-image.png",
        "fc:frame:button:1": "Launch App",
        "fc:frame:button:1:action": "link",
        "fc:frame:button:1:target": "https://prediction-battle.vercel.app"
    }
};

import { ModalProvider } from "@/providers/ModalProvider";

// ... previous code ...

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <OnchainProviders>
                    <ModalProvider>
                        {children}
                    </ModalProvider>
                </OnchainProviders>
            </body>
        </html>
    );
}
