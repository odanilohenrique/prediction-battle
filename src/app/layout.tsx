import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";
import OnchainProviders from "@/components/OnchainProviders";
import FarcasterMiniAppProvider from "@/providers/FarcasterMiniAppProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne" });

export const metadata: Metadata = {
    title: "Prediction Battle",
    description: "Arena descentralizada de palpites. Aposte USDC em eventos do mundo real e ganhe com quem perder.",
    icons: {
        icon: '/icon.png',
        shortcut: '/icon.png',
        apple: '/icon.png',
    },
    manifest: '/manifest.json',
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
            <body className={`${inter.variable} ${syne.variable} font-sans`}>
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
