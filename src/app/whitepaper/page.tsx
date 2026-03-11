import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Shield, Scroll, Zap, Users, Globe, Lock, TrendingUp, Code, TriangleAlert, Scale } from 'lucide-react';

function WPSection({ id, icon, color, n, title, children }: { id: string; icon: ReactNode; color: string; n: string; title: string; children: ReactNode }) {
    return (
        <section id={id} className="space-y-4 scroll-mt-24">
            <h2 className={`text-2xl font-bold text-white flex items-center gap-3 border-l-4 pl-3 ${color}`}>
                {icon}
                <span className="text-white/30 font-mono">{n}.</span> {title}
            </h2>
            <div className="space-y-3 text-sm text-white/70 leading-relaxed pl-1">
                {children}
            </div>
        </section>
    );
}

export default function WhitepaperPage() {
    return (
        <main className="min-h-screen bg-transparent text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Arena
                </Link>

                {/* Header */}
                <div className="mb-4">
                    <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500 uppercase">
                        Prediction Battle
                    </h1>
                    <p className="text-xl font-bold text-white/70 mt-1">Technical Whitepaper — v2.0</p>
                    <p className="text-sm text-white/35 mt-1 font-mono">
                        Contract: <a href="https://sepolia.basescan.org/address/0xF8623E94364b58246BC6FaBeA10710563d2dB6ae#code" target="_blank" rel="noreferrer" className="text-primary hover:underline">PredictionBattleV10</a> · Base Sepolia Testnet · March 2026
                    </p>
                </div>

                {/* TOC */}
                <nav className="mb-12 p-5 bg-white/[0.03] rounded-2xl border border-white/5">
                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">Table of Contents</p>
                    <ol className="grid grid-cols-2 gap-2 text-sm text-white/50">
                        {[
                            ['#abstract', 'Abstract'],
                            ['#problem', '1. Problem Statement'],
                            ['#solution', '2. Solution Overview'],
                            ['#mechanics', '3. Market Mechanics'],
                            ['#liquidity', '4. Liquidity & Payout Model'],
                            ['#fees', '5. Fee Structure'],
                            ['#resolution', '6. Decentralized Resolution'],
                            ['#security', '7. Security Architecture'],
                            ['#slash', '8. Punishment & Slashing'],
                            ['#roadmap', '9. Roadmap'],
                        ].map(([href, label]) => (
                            <li key={href}><a href={href} className="hover:text-primary transition-colors">{label}</a></li>
                        ))}
                    </ol>
                </nav>

                <div className="space-y-16">

                    {/* Abstract */}
                    <section id="abstract" className="p-6 bg-white/[0.03] rounded-2xl border border-primary/20">
                        <div className="flex items-center gap-3 mb-3">
                            <BookOpen className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Abstract</h2>
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed">
                            Prediction Battle is a fully non-custodial, permissionless prediction market protocol deployed on Base — Coinbase&apos;s Layer 2 Ethereum network.
                            The protocol enables any participant to create or bet on outcome markets framed as binary disputes between two subjects (e.g., <em>Creator A vs Creator B</em>),
                            with settlement enforced entirely by the <strong className="text-white">PredictionBattleV10</strong> smart contract.
                        </p>
                        <p className="text-sm text-white/70 leading-relaxed mt-3">
                            Resolution is achieved through an optimistic, bond-backed verification system in which economic penalties for dishonesty
                            are hardcoded at the contract level. No central oracle, no trusted third party. All funds — bets, bonds, and fees — flow exclusively through on-chain logic.
                            The protocol earns a fixed 21% fee on profits only, distributed among the treasury, market creator, referrer, and result reporter.
                        </p>
                    </section>

                    {/* 1. Problem */}
                    <WPSection id="problem" n="1" icon={<TrendingUp className="w-5 h-5" />} color="border-red-500" title="Problem Statement">
                        <p>
                            <strong className="text-white">1.1 Zero-stake social predictions:</strong> Social platforms are saturated with unverifiable predictions — crypto debates, influencer rivalries, political forecasts —
                            but participants bear no financial consequence for being wrong. This results in low-quality discourse and no mechanism for price discovery around social outcomes.
                        </p>
                        <p>
                            <strong className="text-white">1.2 Centralized custody risk:</strong> Existing prediction markets (Polymarket, Kalshi, Manifold) rely on centralized operators for fund custody, market creation, and resolution.
                            This introduces counterparty risk, geographic censorship, and settlement opacity.
                        </p>
                        <p>
                            <strong className="text-white">1.3 Oracle centralization:</strong> Most on-chain prediction protocols depend on external oracle providers (Chainlink, UMA, Pyth) that are expensive, slow to integrate, and unsuitable for
                            qualitative or social media-based outcome data. Outcome verification for subjective social events remains an open problem.
                        </p>
                        <p>
                            <strong className="text-white">1.4 High entry barrier:</strong> Complex token bridges, multi-step approvals, and illiquid prediction tokens discourage casual participation.
                            A stablecoin-native (USDC) protocol on a cheap, fast L2 radically lowers this barrier.
                        </p>
                    </WPSection>

                    {/* 2. Solution */}
                    <WPSection id="solution" n="2" icon={<Zap className="w-5 h-5" />} color="border-primary" title="Solution Overview">
                        <p>Prediction Battle addresses these problems through four architectural decisions:</p>
                        <div className="grid md:grid-cols-2 gap-4 mt-2">
                            {[
                                ['Non-Custodial Contracts', 'text-primary', 'All USDC is held exclusively in PredictionBattleV10.sol. No admin wallet, no intermediary. Users interact directly with the contract via ERC-20 approve + transferFrom.'],
                                ['Open-Ended Subject Markets', 'text-blue-400', 'Markets are defined by two named sides (Side A vs Side B), not by a fixed oracle data feed. Any publicly verifiable social event qualifies: follower counts, engagement metrics, publishing frequency, platform metrics.'],
                                ['Optimistic Bond Resolution', 'text-green-400', 'Any user can report the outcome by staking a USDC bond. A 12-hour dispute window allows any other participant to challenge with a larger bond. Honest reporters earn a 1% reward; dishonest reporters lose their bond.'],
                                ['Base L2 Infrastructure', 'text-purple-400', 'Deployed on Base, transactions settle in ~2 seconds at under $0.01 each, making micro-bets of $0.05 USDC economically viable.'],
                            ].map(([title, color, desc]) => (
                                <div key={title} className="p-4 bg-white/[0.03] border border-white/10 rounded-xl">
                                    <h4 className={`font-bold mb-2 ${color}`}>{title}</h4>
                                    <p className="text-xs text-white/55">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </WPSection>

                    {/* 3. Market Mechanics */}
                    <WPSection id="mechanics" n="3" icon={<Users className="w-5 h-5" />} color="border-blue-500" title="Market Mechanics">
                        <p className="font-bold text-white">3.1 Market Creation</p>
                        <p>Any wallet may create a market by depositing a minimum seed of <strong className="text-white">1 USDC</strong> and submitting a question (10–500 characters). The seed is held separately from the betting pools and is fully refundable to the creator after resolution. There is a 1-hour anti-spam cooldown per creator address.</p>

                        <p className="font-bold text-white mt-4">3.2 Market Types</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong className="text-white">Time-Bound:</strong> Has an explicit deadline. Bets are accepted until the deadline passes, after which only outcome proposals are accepted.</li>
                            <li><strong className="text-white">Open-Ended (deadline = 0):</strong> No fixed expiry. Bets accepted until a proposer initiates resolution. The creator must wait 24h before self-proposing.</li>
                        </ul>

                        <p className="font-bold text-white mt-4">3.3 Betting</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Participants choose <strong className="text-white">Side A</strong> or <strong className="text-white">Side B</strong>. Their USDC enters the liquidity pool for their chosen side.</li>
                            <li>Minimum bet: <strong className="text-white">0.05 USDC</strong> · Maximum: <strong className="text-white">100,000 USDC</strong></li>
                            <li>Total market pool cap: <strong className="text-white">1,000,000 USDC</strong></li>
                            <li>Multiple bets on the same side accumulate. The referrer address is locked on the first bet per user per market and cannot be overwritten.</li>
                        </ul>

                        <p className="font-bold text-white mt-4">3.4 Early Bird Bonus</p>
                        <p>Bets placed during the creator-defined bonus window receive <strong className="text-white">1.2× shares</strong> instead of the base 1.0×. Shares determine the proportional claim on the winning pool. This rewards participants who take on greater uncertainty by committing capital early.</p>

                        <p className="font-bold text-white mt-4">3.5 Market States</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {['OPEN', 'PROPOSED', 'DISPUTED', 'RESOLVED'].map((s, i) => {
                                const colors = ['bg-green-500/20 text-green-300 border-green-500/30', 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', 'bg-red-500/20 text-red-300 border-red-500/30', 'bg-blue-500/20 text-blue-300 border-blue-500/30'];
                                return <span key={s} className={`px-3 py-1 rounded-full border text-xs font-bold font-mono ${colors[i]}`}>{s}</span>
                            })}
                        </div>
                    </WPSection>

                    {/* 4. Liquidity */}
                    <WPSection id="liquidity" n="4" icon={<Scale className="w-5 h-5" />} color="border-green-500" title="Liquidity & Payout Model">
                        <p>
                            Prediction Battle uses a <strong className="text-white">Pari-Mutuel</strong> pool model. All bets on each side form two isolated pools. If your side wins, your proportional share of the opposite pool is distributed to you (after fees).
                        </p>

                        <p className="font-bold text-white mt-4">4.1 Share Calculation</p>
                        <div className="bg-[#0d0d0d] p-4 rounded-xl font-mono text-xs border border-white/5">
                            <p className="text-white/40 mb-2">{`// At bet time`}</p>
                            <p><span className="text-primary">shares</span> = f(yourSidePool, opposingPool, betAmount, isEarlyBird)</p>
                            <p className="text-white/40 mt-2 mb-1">{`// At claim time`}</p>
                            <p><span className="text-primary">yourSlice</span> = (yourShares / totalWinningSideShares) × totalLosingPool</p>
                            <p><span className="text-primary">grossPayout</span> = yourOriginalBet + yourSlice</p>
                            <p><span className="text-primary">netPayout</span> = grossPayout − fees (applied to profit only)</p>
                        </div>

                        <p className="font-bold text-white mt-4">4.2 Multiplier Dynamics</p>
                        <p>The effective multiplier is determined by the ratio of the opposing pool to your own pool at market close. A heavily unbalanced market (e.g., $200 on Side A vs $2,000 on Side B) produces a high multiplier (~10×) for Side A bettors and a low multiplier (~1.1×) for Side B bettors. This dynamic price discovery incentivizes contrarian capital to balance pools, improving market efficiency.</p>

                        <p className="font-bold text-white mt-4">4.3 Special Outcomes</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong className="text-white">DRAW:</strong> All bettors receive 100% of their stake back. No fees collected.</li>
                            <li><strong className="text-white">CANCELLED:</strong> Admin voiding. Full stake refund to all participants.</li>
                            <li><strong className="text-white">One-sided pool:</strong> If the losing side has $0, winners reclaim their original stake only (no profit to distribute).</li>
                        </ul>
                    </WPSection>

                    {/* 5. Fees */}
                    <WPSection id="fees" n="5" icon={<Scroll className="w-5 h-5" />} color="border-yellow-500" title="Fee Structure">
                        <p>All fees are calculated and deducted exclusively from the <strong className="text-white">profit margin</strong> (the losing pool distribution). The original stake of every bettor is never subject to fees.</p>

                        <div className="overflow-hidden rounded-xl border border-white/10 mt-3">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="p-3">Recipient</th>
                                        <th className="p-3">Rate</th>
                                        <th className="p-3">Condition</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-xs">
                                    <tr><td className="p-3 font-bold text-white">Protocol Treasury</td><td className="p-3 font-mono text-yellow-400 font-bold">10%</td><td className="p-3">Always collected on resolved markets</td></tr>
                                    <tr><td className="p-3 font-bold text-white">Market Creator</td><td className="p-3 font-mono text-yellow-400 font-bold">5%</td><td className="p-3">Paid to the wallet that created the market</td></tr>
                                    <tr><td className="p-3 font-bold text-white">Referrer</td><td className="p-3 font-mono text-yellow-400 font-bold">5%</td><td className="p-3">Only if a referrer was recorded on first bet; stays in pool otherwise</td></tr>
                                    <tr><td className="p-3 font-bold text-white">Result Reporter</td><td className="p-3 font-mono text-yellow-400 font-bold">1%</td><td className="p-3">Proposer who submitted correct outcome (or winning challenger)</td></tr>
                                    <tr className="bg-white/[0.03]"><td className="p-3 font-bold text-primary">Total</td><td className="p-3 font-mono font-bold text-primary">21%</td><td className="p-3 text-white/40">On profit only; original stakes returned at 100%</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <p className="mt-3">
                            Fees are pre-computed at market resolution (not at claim time), stored as separate balances, and withdrawable by each recipient independently. This design prevents any single actor from blocking fee collection.
                        </p>
                    </WPSection>

                    {/* 6. Resolution */}
                    <WPSection id="resolution" n="6" icon={<Shield className="w-5 h-5" />} color="border-purple-500" title="Decentralized Resolution">
                        <p>Resolution is modeled as an <strong className="text-white">Optimistic Oracle</strong>: assume honesty, penalize dishonesty economically.</p>

                        <div className="space-y-3 mt-3">
                            {[
                                ['1', 'bg-blue-500', 'Proposal', 'Any user submits the winning side plus evidence (URL ≤512 chars) and deposits a USDC bond (minimum 5 USDC, scales with pool size). Market transitions to PROPOSED state instantly.'],
                                ['2', 'bg-yellow-400 text-black', 'Challenge Window (12 Hours)', 'For exactly 43,200 seconds, any other user may submit a counter-proposal by depositing a bond ≥ the original. The proposer cannot self-challenge. Market transitions to DISPUTED.'],
                                ['3', 'bg-green-500 text-black', 'Finalization', 'If the 12h window closes without a dispute, any user calls finalize. The outcome is locked immutably. The proposer receives their bond back + 1% reporter reward.'],
                                ['4', 'bg-red-500', 'Arbitration', 'If disputed, an admin evaluates both evidence sets and calls resolveDispute(winner). The honest party earns their bond + 80% of the liar\'s bond. 20% of the loser\'s bond is slashed to the treasury.'],
                            ].map(([step, bg, title, desc]) => (
                                <div key={step} className="flex gap-4">
                                    <div className={`w-7 h-7 rounded-full ${bg} flex-shrink-0 flex items-center justify-center font-bold text-sm mt-0.5`}>{step}</div>
                                    <div className="flex-1 p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                                        <p className="font-bold text-white text-sm mb-1">{title}</p>
                                        <p className="text-xs text-white/55">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p className="mt-3">
                            The <strong className="text-white">30-day Emergency Timeout</strong> ensures that no market can be permanently stuck. After 30 days without resolution,
                            an admin may void the market and refund all participants.
                        </p>
                    </WPSection>

                    {/* 7. Security */}
                    <WPSection id="security" n="7" icon={<Lock className="w-5 h-5" />} color="border-red-500" title="Security Architecture">
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong className="text-white">Non-Custodial:</strong> All funds are transferred directly to the smart contract via ERC-20 <code className="bg-white/10 px-1 rounded">safeTransferFrom</code>. No EOA or backend wallet holds user funds.</li>
                            <li><strong className="text-white">ReentrancyGuard:</strong> All state-changing functions implement Checks-Effects-Interactions (CEI) and use OpenZeppelin&apos;s ReentrancyGuard.</li>
                            <li><strong className="text-white">AccessControl (Role-based):</strong> Admin functions are protected by <code className="bg-white/10 px-1 rounded">DEFAULT_ADMIN_ROLE</code>. Operator functions by <code className="bg-white/10 px-1 rounded">OPERATOR_ROLE</code>. Role transfers require explicit setOperator() — direct grantRole on OPERATOR_ROLE is blocked.</li>
                            <li><strong className="text-white">Treasury Timelock:</strong> Changes to the treasury address require a 2-day timelock via a two-step propose/execute pattern, preventing immediate rug vectors.</li>
                            <li><strong className="text-white">Global Liability Tracking:</strong> All USDC locked (bets + bonds + seeds) is tracked in <code className="bg-white/10 px-1 rounded">totalLockedAmount</code>, enabling trustless solvency audits at any time.</li>
                            <li><strong className="text-white">Circuit Breakers:</strong> Configurable max bet (100k USDC) and max pool (1M USDC) caps prevent extreme concentration of funds in a single market.</li>
                            <li><strong className="text-white">MEV Protection:</strong> Open-ended markets have a per-user 5-minute cooldown between placing a bet and proposing an outcome on the same market, preventing same-block manipulation.</li>
                            <li><strong className="text-white">Pausable:</strong> Admin can halt all market activity in an emergency without disrupting existing claims.</li>
                            <li><strong className="text-white">Verified on Basescan:</strong> Contract source is publicly verified at <a href="https://basescan.org/address/0x5aB3e14ff6d2d2e5F41111235d4A147a970eBd6c#code" target="_blank" rel="noreferrer" className="text-primary hover:underline">0x5aB3e14ff...eBd6c</a>.</li>
                        </ul>
                    </WPSection>

                    {/* 8. Slash */}
                    <WPSection id="slash" n="8" icon={<TriangleAlert className="w-5 h-5" />} color="border-orange-500" title="Punishment & Slashing">
                        <p>
                            The slashing system is not a discretionary penalty — it is a <strong className="text-white">hardcoded economic deterrent</strong> written into the contract&apos;s resolution logic. Slashing is irreversible once executed on-chain.
                        </p>

                        <p className="font-bold text-white mt-4">8.1 Bond Slashing (Dishonest Reporters)</p>
                        <p>When a dispute is resolved and a liar is identified:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>The liar forfeits 100% of their submitted bond.</li>
                            <li>80% of the forfeited bond is awarded to the honest counterparty as a bounty.</li>
                            <li>20% is transferred directly to the protocol treasury.</li>
                            <li>The honest winner also inherits the 1% Reporter Reward from the market&apos;s profit pool.</li>
                        </ul>

                        <p className="font-bold text-white mt-4">8.2 Seed Confiscation (Fraudulent Market Creators)</p>
                        <p>If an admin determines a market was created fraudulently (fabricated subject, manipulated evidence, collusion):</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>The creator&apos;s seed deposit is permanently confiscated and transferred to the treasury.</li>
                            <li>The market resolves as CANCELLED — all bettors receive 100% stake refunds.</li>
                            <li>This is logged via the <code className="bg-white/10 px-1 rounded">SeedConfiscated</code> event (distinct from voluntary WithdrawSeed).</li>
                        </ul>

                        <p className="font-bold text-white mt-4">8.3 Incentive Alignment Summary</p>
                        <p>
                            The economic game theory model ensures that at every decision point, the cost of lying exceeds the potential gain from lying.
                            As pool sizes grow, bond requirements scale proportionally, making large-scale manipulation progressively more expensive.
                        </p>
                    </WPSection>

                    {/* 9. Roadmap */}
                    <WPSection id="roadmap" n="9" icon={<Globe className="w-5 h-5" />} color="border-cyan-500" title="Roadmap">
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                ['✅ Phase 1 — Beta (Complete)', 'text-green-400', 'Core smart contract (V10), Base Sepolia testnet, frontend MVP, manual resolution, basic market creation.'],
                                ['🚀 Phase 2 — Testnet (Current)', 'text-blue-400', 'Base Sepolia Testnet deployment. Verified contract. Referral system. Early bird bonuses. Production frontend and full decentralized resolution.'],
                                ['🗓 Phase 3 — Scale', 'text-yellow-400', 'Resolution automation. Dispute dashboard improvements. Creator analytics. API for third-party integrations. Expanded market categories (sports, crypto, politics).'],
                                ['🌐 Phase 4 — Decentralization', 'text-purple-400', 'DAO governance for dispute arbitration. Multi-sig treasury. Governance token ($BATTLE) for protocol fee sharing and resolution voting.'],
                            ].map(([title, color, desc]) => (
                                <div key={title} className="p-4 bg-white/[0.03] border border-white/10 rounded-xl">
                                    <h4 className={`font-bold mb-2 text-sm ${color}`}>{title}</h4>
                                    <p className="text-xs text-white/55">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </WPSection>

                    {/* Conclusion */}
                    <section className="p-6 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl border border-primary/20">
                        <h2 className="text-xl font-bold text-white mb-3">Conclusion</h2>
                        <p className="text-sm text-white/70 leading-relaxed">
                            Prediction Battle is a fully on-chain primitive for converting social disagreement into verifiable, economically-settled outcomes.
                            By removing custody from operators and oracle trust from centralized providers, we build a system where the only way to win is to be right —
                            and the only way to lose is to be wrong or to lie. Capital, reputation, and truth align by design.
                        </p>
                        <p className="text-sm text-white/40 mt-3 italic">
                            Join the arena. Stake your claim. Prove you know what&apos;s next.
                        </p>
                    </section>

                </div>
            </div>
        </main>
    );
}
