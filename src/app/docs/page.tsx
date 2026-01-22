
import Link from 'next/link';
import { ArrowLeft, Zap, Shield, HelpCircle, Terminal, Wallet, AlertTriangle, CheckCircle, Clock, Users } from 'lucide-react';

export default function DocsPage() {
    return (
        <main className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Arena
                </Link>

                <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-2">
                    DOCUMENTATION
                </h1>
                <p className="text-xl text-white/60 mb-12">
                    Technical guides for users, creators, and developers.
                </p>

                {/* Table of Contents */}
                <nav className="mb-12 p-6 bg-white/5 rounded-2xl border border-white/10">
                    <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Contents</h2>
                    <ul className="space-y-2 text-sm">
                        <li><a href="#getting-started" className="text-primary hover:underline">1. Getting Started</a></li>
                        <li><a href="#creating-markets" className="text-primary hover:underline">2. Creating Markets</a></li>
                        <li><a href="#placing-bets" className="text-primary hover:underline">3. Placing Bets</a></li>
                        <li><a href="#verification" className="text-primary hover:underline">4. Verification & Resolution</a></li>
                        <li><a href="#disputes" className="text-primary hover:underline">5. Dispute Mechanism</a></li>
                        <li><a href="#claiming" className="text-primary hover:underline">6. Claiming Winnings</a></li>
                        <li><a href="#contracts" className="text-primary hover:underline">7. Smart Contract Reference</a></li>
                        <li><a href="#faq" className="text-primary hover:underline">8. FAQ</a></li>
                    </ul>
                </nav>

                <div className="space-y-16">

                    {/* Getting Started */}
                    <section id="getting-started" className="space-y-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Wallet className="w-6 h-6 text-primary" />
                            1. Getting Started
                        </h2>
                        <div className="space-y-4 text-sm text-white/70">
                            <p>
                                Prediction Battle runs on <strong className="text-white">Base</strong>, Coinbase's Layer 2 network.
                                You'll need a compatible wallet and some USDC to participate.
                            </p>
                            <h3 className="text-lg font-bold text-white mt-6">1.1 Wallet Setup</h3>
                            <ol className="list-decimal pl-6 space-y-2">
                                <li>Install a Web3 wallet: <strong className="text-white">Rabby</strong>, <strong className="text-white">MetaMask</strong>, or <strong className="text-white">Coinbase Wallet</strong>.</li>
                                <li>Add the Base network to your wallet:
                                    <ul className="list-disc pl-6 mt-2 text-xs text-white/50">
                                        <li>Network Name: <code className="bg-white/10 px-1 rounded">Base</code></li>
                                        <li>RPC URL: <code className="bg-white/10 px-1 rounded">https://mainnet.base.org</code></li>
                                        <li>Chain ID: <code className="bg-white/10 px-1 rounded">8453</code></li>
                                        <li>Currency: <code className="bg-white/10 px-1 rounded">ETH</code></li>
                                    </ul>
                                </li>
                                <li>Bridge USDC to Base using the <a href="https://bridge.base.org" target="_blank" rel="noreferrer" className="text-primary hover:underline">Base Bridge</a> or purchase directly via Coinbase.</li>
                            </ol>

                            <h3 className="text-lg font-bold text-white mt-6">1.2 Connecting to the App</h3>
                            <ol className="list-decimal pl-6 space-y-2">
                                <li>Navigate to <a href="https://predictionbattle.xyz" className="text-primary hover:underline">predictionbattle.xyz</a>.</li>
                                <li>Click the <strong className="text-white">"Wallet"</strong> button in the sidebar.</li>
                                <li>Approve the connection request in your wallet.</li>
                                <li>Ensure you are on the correct network (Base Mainnet or Sepolia for testing).</li>
                            </ol>
                        </div>
                    </section>

                    {/* Creating Markets */}
                    <section id="creating-markets" className="space-y-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Zap className="w-6 h-6 text-yellow-500" />
                            2. Creating Markets
                        </h2>
                        <div className="space-y-4 text-sm text-white/70">
                            <p>
                                Anyone can create a prediction market based on a Farcaster Cast. As the creator,
                                you earn <strong className="text-green-400">1% of the winning pot</strong> as a reward.
                            </p>
                            <h3 className="text-lg font-bold text-white mt-6">2.1 Steps to Create</h3>
                            <ol className="list-decimal pl-6 space-y-2">
                                <li>Click <strong className="text-white">"Create Battle"</strong> on the home page.</li>
                                <li>Paste the Farcaster Cast URL (e.g., <code className="bg-white/10 px-1 rounded text-xs">https://warpcast.com/username/0xabc123</code>).</li>
                                <li>Select the engagement metric: <strong>Likes</strong>, <strong>Recasts</strong>, or <strong>Replies</strong>.</li>
                                <li>Set the target value (e.g., "Will this cast hit 500 likes?").</li>
                                <li>Choose the deadline (when the prediction ends).</li>
                                <li>Confirm the transaction in your wallet. This creates the market on-chain.</li>
                            </ol>
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mt-4">
                                <p className="text-xs text-yellow-400">
                                    <strong>Note:</strong> Creating a market requires a small gas fee (~0.001 ETH).
                                    You do not need to stake USDC to create—only to bet.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Placing Bets */}
                    <section id="placing-bets" className="space-y-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Users className="w-6 h-6 text-purple-500" />
                            3. Placing Bets
                        </h2>
                        <div className="space-y-4 text-sm text-white/70">
                            <p>
                                Betting is the core of Prediction Battle. You stake USDC on your prediction.
                            </p>
                            <h3 className="text-lg font-bold text-white mt-6">3.1 How to Bet</h3>
                            <ol className="list-decimal pl-6 space-y-2">
                                <li>Find an active market on the home page ("Official" or "Community" tabs).</li>
                                <li>Click the market card to open the betting modal.</li>
                                <li>Choose your side: <span className="text-green-400 font-bold">YES</span> (target will be hit) or <span className="text-red-400 font-bold">NO</span> (target will not be hit).</li>
                                <li>Enter your bet amount in USDC.</li>
                                <li>If this is your first bet, you'll need to <strong className="text-white">Approve</strong> USDC spending first.</li>
                                <li>Confirm the bet transaction in your wallet.</li>
                            </ol>

                            <h3 className="text-lg font-bold text-white mt-6">3.2 Referral System</h3>
                            <p>
                                Each user has a unique referral code. When someone bets using your code,
                                you earn <strong className="text-purple-400">1% of their winnings</strong> if they win.
                            </p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>Your referral code is displayed after you place your first bet.</li>
                                <li>Share your link: <code className="bg-white/10 px-1 rounded text-xs">predictionbattle.xyz?ref=YOUR_CODE</code></li>
                            </ul>
                        </div>
                    </section>

                    {/* Verification */}
                    <section id="verification" className="space-y-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Shield className="w-6 h-6 text-green-500" />
                            4. Verification & Resolution
                        </h2>
                        <div className="space-y-4 text-sm text-white/70">
                            <p>
                                After the market deadline passes, the outcome must be verified before payouts can occur.
                            </p>
                            <h3 className="text-lg font-bold text-white mt-6">4.1 Automated Verification</h3>
                            <p>
                                Our backend uses the <strong className="text-white">Neynar API</strong> to fetch real-time
                                engagement data from Farcaster. An automated cron job checks expired markets and proposes outcomes.
                            </p>

                            <h3 className="text-lg font-bold text-white mt-6">4.2 Manual Verification</h3>
                            <p>
                                Anyone can manually verify a market by clicking <strong className="text-white">"Verify"</strong>
                                on an expired market card. This calls the <code className="bg-white/10 px-1 rounded">proposeOutcome()</code>
                                function on the smart contract.
                            </p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>You must stake a <strong>verification bond</strong> (defaults to 2 USDC).</li>
                                <li>If your proposal is correct and unchallenged, your bond is returned.</li>
                                <li>If disputed and overturned, you lose your bond to the disputer.</li>
                            </ul>

                            <h3 className="text-lg font-bold text-white mt-6">4.3 Evidence</h3>
                            <p>
                                When proposing, you can attach an <strong>evidence URL</strong> (e.g., a screenshot or archive link).
                                This helps other users validate the result during the dispute window.
                            </p>
                        </div>
                    </section>

                    {/* Disputes */}
                    <section id="disputes" className="space-y-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                            5. Dispute Mechanism
                        </h2>
                        <div className="space-y-4 text-sm text-white/70">
                            <p>
                                To prevent incorrect resolutions, there is a <strong className="text-white">24-hour dispute window</strong>
                                after an outcome is proposed.
                            </p>
                            <h3 className="text-lg font-bold text-white mt-6">5.1 How to Dispute</h3>
                            <ol className="list-decimal pl-6 space-y-2">
                                <li>Find a market in the "Verifying" state.</li>
                                <li>Review the proposed outcome and evidence.</li>
                                <li>If you believe it's wrong, click <strong className="text-red-400">"Dispute"</strong>.</li>
                                <li>Stake a counter-bond (1.5x the original bond).</li>
                                <li>Provide your own evidence URL.</li>
                            </ol>

                            <h3 className="text-lg font-bold text-white mt-6">5.2 Dispute Resolution</h3>
                            <p>
                                Currently, disputes escalate to admin review. In future versions, disputes will
                                be resolved by a decentralized jury or DAO governance.
                            </p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>If the dispute is successful, the disputer receives the original proposer's bond.</li>
                                <li>If the dispute fails, the disputer loses their counter-bond.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Claiming */}
                    <section id="claiming" className="space-y-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <CheckCircle className="w-6 h-6 text-green-400" />
                            6. Claiming Winnings
                        </h2>
                        <div className="space-y-4 text-sm text-white/70">
                            <p>
                                Once a market is finalized (dispute window closed with no challenge), winners can claim.
                            </p>
                            <ol className="list-decimal pl-6 space-y-2">
                                <li>Navigate to your <strong className="text-white">Profile</strong> page.</li>
                                <li>Find the market in your "Completed" bets.</li>
                                <li>Click <strong className="text-green-400">"Claim"</strong>.</li>
                                <li>Confirm the transaction. Your USDC winnings will be sent to your wallet.</li>
                            </ol>
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl mt-4">
                                <p className="text-xs text-green-400">
                                    <strong>Payout Calculation:</strong> Your share = (Your Stake / Total Winning Stake) × Losing Pot × (1 - Fees)
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Contracts */}
                    <section id="contracts" className="space-y-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Terminal className="w-6 h-6 text-cyan-400" />
                            7. Smart Contract Reference
                        </h2>
                        <div className="space-y-4 text-sm text-white/70">
                            <h3 className="text-lg font-bold text-white">Deployed Contracts</h3>
                            <table className="w-full text-left text-xs border border-white/10 rounded-xl overflow-hidden">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="p-3 border-b border-white/10">Network</th>
                                        <th className="p-3 border-b border-white/10">Contract</th>
                                        <th className="p-3 border-b border-white/10">Address</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-white/5">
                                        <td className="p-3">Base Mainnet</td>
                                        <td className="p-3">PredictionBattleV3</td>
                                        <td className="p-3 font-mono text-primary">0x...TBD</td>
                                    </tr>
                                    <tr className="border-b border-white/5">
                                        <td className="p-3">Base Sepolia</td>
                                        <td className="p-3">PredictionBattleV3</td>
                                        <td className="p-3 font-mono text-primary">0x...TBD</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3">Base Mainnet</td>
                                        <td className="p-3">USDC</td>
                                        <td className="p-3 font-mono">0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p className="text-xs text-white/40 mt-2">
                                All contracts are verified on Basescan. View source code on our <a href="https://github.com/odanilohenrique/prediction-battle" target="_blank" rel="noreferrer" className="text-primary hover:underline">GitHub</a>.
                            </p>
                        </div>
                    </section>

                    {/* FAQ */}
                    <section id="faq" className="space-y-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <HelpCircle className="w-6 h-6 text-purple-400" />
                            8. Frequently Asked Questions
                        </h2>
                        <div className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <h4 className="font-bold text-white mb-1">Is this gambling?</h4>
                                <p className="text-xs text-white/60">
                                    Prediction markets are speculative instruments based on real-world outcomes.
                                    Legality varies by jurisdiction. Please consult local laws before participating.
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <h4 className="font-bold text-white mb-1">What happens if no one bets on one side?</h4>
                                <p className="text-xs text-white/60">
                                    If a market resolves with only YES or only NO bets, all participants get their stake back (minus gas fees).
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <h4 className="font-bold text-white mb-1">Can I cancel my bet?</h4>
                                <p className="text-xs text-white/60">
                                    No. Once a bet is placed on-chain, it cannot be reversed. Bets are final.
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <h4 className="font-bold text-white mb-1">What if the Cast is deleted?</h4>
                                <p className="text-xs text-white/60">
                                    If the underlying Cast is deleted before resolution, the market may be voided by an admin.
                                    All participants would then receive their stake back.
                                </p>
                            </div>
                        </div>
                    </section>

                </div>
            </div>
        </main>
    );
}
