import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Prediction Battle - Bet on Farcaster Casts",
    description: "Bet USDC on whether Farcaster casts will hit engagement targets. Win big if you're right!",
};

import OnchainProviders from "@/components/OnchainProviders";

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
                    {children}
                </OnchainProviders>
            </body>
        </html>
    );
}
