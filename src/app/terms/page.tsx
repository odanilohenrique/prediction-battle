
import Link from 'next/link';
import { ArrowLeft, Scale } from 'lucide-react';

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Arena
                </Link>

                <h1 className="text-4xl font-black italic tracking-tighter mb-8 text-white">
                    TERMS OF SERVICE
                </h1>

                <div className="space-y-8 text-white/70 text-sm leading-relaxed border-l-2 border-white/10 pl-6">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-2">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using the Battle Arena ("Platform"), you agree to be bound by these Terms of Service.
                            If you do not agree to all of these terms, do not use our services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-2">2. Nature of Services</h2>
                        <p>
                            Battle Arena allows users to interact with smart contracts on the Base blockchain to create and participate in prediction markets.
                            You understand that we provide an interface to these decentralized protocols and do not have custody of your funds.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-2">3. Risks</h2>
                        <p>
                            Usage of the Platform involves significant risks, including but not limited to: high volatility, smart contract bugs, and regulatory uncertainty.
                            You acknowledge that you are using the Platform at your own risk.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-2">4. User Responsibilities</h2>
                        <p>
                            You represent that you are of legal age and jurisdiction to participate in prediction markets.
                            You are responsible for the security of your wallet and private keys.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-2">5. Protocol Ownership</h2>
                        <p>
                            Battle Arena and its underlying IP are protected. However, the smart contracts are public and permissionless.
                        </p>
                    </section>
                </div>
            </div>
        </main>
    );
}
