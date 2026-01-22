
import Link from 'next/link';
import { ArrowLeft, BookOpen, Shield, Scroll, Zap, Users, Globe, Lock, TrendingUp, Code } from 'lucide-react';

export default function WhitepaperPage() {
    return (
        <main className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Arena
                </Link>

                <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                    BATTLE ARENA
                </h1>
                <p className="text-2xl font-bold text-white/80 mb-2">
                    Technical Whitepaper v1.0
                </p>
                <p className="text-sm text-white/40 mb-12">
                    Decentralized Social Prediction Markets on Base
                </p>

                <div className="space-y-16 text-white/80 leading-relaxed">

                    {/* Abstract */}
                    <section className="space-y-4 p-6 bg-white/5 rounded-2xl border border-white/10">
                        <h2 className="text-xl font-bold text-white">Abstract</h2>
                        <p className="text-sm">
                            Prediction Battle is a decentralized prediction market protocol built on the Base blockchain that
                            enables users to create and participate in prediction markets tied to verifiable social media outcomes.
                            By leveraging smart contracts for trustless settlement and the Neynar API for oracle-based verification,
                            the protocol provides a transparent, permissionless, and censorship-resistant platform for monetizing
                            social engagement predictions.
                        </p>
                    </section>

                    {/* Problem Statement */}
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <TrendingUp className="w-6 h-6 text-red-500" />
                            1. Problem Statement
                        </h2>
                        <div className="space-y-4 text-sm">
                            <p>
                                <strong className="text-white">1.1 Lack of Accountability in Social Predictions:</strong>
                                Social media is filled with predictions about viral content, engagement metrics, and user behavior.
                                However, there is no mechanism for users to back their predictions with economic stakes, leading to
                                low-quality discourse and zero accountability.
                            </p>
                            <p>
                                <strong className="text-white">1.2 Centralized Prediction Markets:</strong>
                                Existing prediction market platforms (Polymarket, Kalshi) rely on centralized operators for market
                                creation, resolution, and fund custody. This introduces counterparty risk, censorship concerns, and
                                geographic restrictions.
                            </p>
                            <p>
                                <strong className="text-white">1.3 Oracle Problem for Social Data:</strong>
                                Traditional smart contract oracles (Chainlink, UMA) are not optimized for real-time social media
                                metrics. A purpose-built solution is needed to bridge on-chain contracts with off-chain social data.
                            </p>
                            <p>
                                <strong className="text-white">1.4 High Friction User Experience:</strong>
                                Many on-chain prediction markets require complex token swaps, bridging, and wallet management.
                                This creates barriers to entry for mainstream users.
                            </p>
                        </div>
                    </section>

                    {/* Solution */}
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Zap className="w-6 h-6 text-primary" />
                            2. The Prediction Battle Solution
                        </h2>
                        <div className="space-y-4 text-sm">
                            <p>
                                Prediction Battle addresses these problems through a vertically integrated stack:
                            </p>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <h4 className="font-bold text-primary mb-2">Non-Custodial Smart Contracts</h4>
                                    <p className="text-xs text-white/60">
                                        All funds are held in auditable, open-source smart contracts on Base.
                                        Users interact directly with the protocol—no intermediary holds funds.
                                    </p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <h4 className="font-bold text-purple-400 mb-2">Neynar-Powered Oracle</h4>
                                    <p className="text-xs text-white/60">
                                        We use the Neynar API as a trusted data source for Farcaster engagement metrics
                                        (likes, recasts, replies, followers). Results are proposed on-chain with a dispute window.
                                    </p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <h4 className="font-bold text-green-400 mb-2">Optimistic Resolution</h4>
                                    <p className="text-xs text-white/60">
                                        An optimistic oracle pattern is used: a proposer stakes a bond to submit a result.
                                        If undisputed within the challenge period, the result is finalized and payouts are enabled.
                                    </p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <h4 className="font-bold text-blue-400 mb-2">Base L2 for Scalability</h4>
                                    <p className="text-xs text-white/60">
                                        Built on Coinbase's Base L2, transactions are fast (~2s finality) and cheap
                                        (&lt;$0.01 per tx), making micro-betting economically viable.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Technical Architecture */}
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Code className="w-6 h-6 text-cyan-400" />
                            3. Technical Architecture
                        </h2>
                        <div className="space-y-4 text-sm">
                            <p className="font-bold text-white">3.1 Smart Contract Stack (Solidity)</p>
                            <ul className="list-disc pl-6 space-y-2 text-white/70">
                                <li><code className="bg-white/10 px-1 rounded">PredictionBattleV3.sol</code>: Core market logic. Handles market creation, betting (YES/NO), proposal, dispute, and claim functions.</li>
                                <li><code className="bg-white/10 px-1 rounded">IERC20 (USDC)</code>: All bets are denominated in USDC for stablecoin-based payouts.</li>
                                <li><code className="bg-white/10 px-1 rounded">Ownable</code>: Admin controls for emergency functions (pause, void).</li>
                            </ul>

                            <p className="font-bold text-white mt-6">3.2 Key Contract Functions</p>
                            <div className="bg-[#111] p-4 rounded-xl font-mono text-xs overflow-x-auto">
                                <pre>{`function createPrediction(bytes32 id, uint256 deadline, string calldata castUrl) external;
function placeBet(bytes32 id, bool isYes, uint256 amount, address referrer) external;
function proposeOutcome(bytes32 id, bool result, string calldata evidenceUrl) external;
function disputeOutcome(bytes32 id, bool newResult, string calldata evidenceUrl) external;
function finalizeOutcome(bytes32 id) external;
function claimWinnings(bytes32 id) external;`}</pre>
                            </div>

                            <p className="font-bold text-white mt-6">3.3 Resolution Flow</p>
                            <ol className="list-decimal pl-6 space-y-2 text-white/70">
                                <li><strong>Market Expiry:</strong> Deadline passes, market enters EXPIRED state.</li>
                                <li><strong>Proposal:</strong> Anyone can call <code className="bg-white/10 px-1 rounded">proposeOutcome()</code> with a bond. Market enters PROPOSED state.</li>
                                <li><strong>Dispute Window:</strong> A 24-hour window opens. Anyone can dispute by calling <code className="bg-white/10 px-1 rounded">disputeOutcome()</code> with a counter-bond.</li>
                                <li><strong>Finalization:</strong> If no dispute, <code className="bg-white/10 px-1 rounded">finalizeOutcome()</code> is called. Market enters RESOLVED state.</li>
                                <li><strong>Claim:</strong> Winners call <code className="bg-white/10 px-1 rounded">claimWinnings()</code> to receive their pro-rata share of the losing pot.</li>
                            </ol>
                        </div>
                    </section>

                    {/* Tokenomics */}
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Scroll className="w-6 h-6 text-yellow-500" />
                            4. Economics & Fee Structure
                        </h2>
                        <div className="space-y-4 text-sm">
                            <p>
                                The protocol is designed to be sustainable while rewarding key participants:
                            </p>
                            <table className="w-full text-left text-xs border border-white/10 rounded-xl overflow-hidden">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="p-3 border-b border-white/10">Fee Type</th>
                                        <th className="p-3 border-b border-white/10">Percentage</th>
                                        <th className="p-3 border-b border-white/10">Recipient</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-white/5">
                                        <td className="p-3">Platform Fee</td>
                                        <td className="p-3 text-primary font-bold">2%</td>
                                        <td className="p-3">Protocol Treasury</td>
                                    </tr>
                                    <tr className="border-b border-white/5">
                                        <td className="p-3">Creator Fee</td>
                                        <td className="p-3 text-green-400 font-bold">1%</td>
                                        <td className="p-3">Market Creator Wallet</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3">Referral Fee</td>
                                        <td className="p-3 text-purple-400 font-bold">1%</td>
                                        <td className="p-3">Referrer Wallet</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p className="text-xs text-white/40">
                                Fees are deducted from the winning pool upon claim. Losers receive nothing; their entire stake goes to winners (minus fees).
                            </p>
                        </div>
                    </section>

                    {/* Security */}
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Lock className="w-6 h-6 text-red-400" />
                            5. Security Considerations
                        </h2>
                        <div className="space-y-4 text-sm">
                            <ul className="list-disc pl-6 space-y-2 text-white/70">
                                <li><strong>Non-Custodial:</strong> Users approve and transfer USDC directly to the contract. No EOA holds user funds.</li>
                                <li><strong>Verified Contracts:</strong> All production contracts are verified on Basescan.</li>
                                <li><strong>Dispute Mechanism:</strong> The optimistic oracle allows for human-driven corrections, preventing single-point-of-failure oracle attacks.</li>
                                <li><strong>Reentrancy Guard:</strong> All state-changing functions use checks-effects-interactions pattern.</li>
                                <li><strong>Admin Keys:</strong> Emergency pause and void functions are protected by a multisig (planned).</li>
                            </ul>
                        </div>
                    </section>

                    {/* Roadmap */}
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Globe className="w-6 h-6 text-blue-500" />
                            6. Future Development
                        </h2>
                        <div className="space-y-4 text-sm">
                            <ul className="list-disc pl-6 space-y-2 text-white/70">
                                <li><strong>Governance Token ($BATTLE):</strong> Community-driven dispute resolution and protocol upgrades.</li>
                                <li><strong>X (Twitter) Integration:</strong> Expand prediction markets to Twitter/X engagement metrics.</li>
                                <li><strong>Mobile App:</strong> Native iOS/Android experience with biometric wallet support.</li>
                                <li><strong>Multi-Chain Deployment:</strong> Arbitrum, Optimism, and Polygon for broader reach.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Conclusion */}
                    <section className="space-y-4 p-6 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl border border-primary/20">
                        <h2 className="text-xl font-bold text-white">Conclusion</h2>
                        <p className="text-sm">
                            Prediction Battle represents a new paradigm for social prediction markets: permissionless, transparent,
                            and built on the infrastructure of the decentralized web. By aligning incentives between creators,
                            bettors, and verifiers, we create a self-sustaining ecosystem where reputation and capital are at stake.
                        </p>
                        <p className="text-sm text-white/60">
                            Join the arena. Stake your claim. Prove you know what's next.
                        </p>
                    </section>

                </div>
            </div>
        </main>
    );
}
