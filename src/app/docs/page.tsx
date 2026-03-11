import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Swords, Coins, Scale, Clock, Shield, Flame, HelpCircle, TriangleAlert } from 'lucide-react';

function Section({ id, icon, color, number, title, children }: { id: string; icon: ReactNode; color: string; number: string; title: string; children: ReactNode }) {
    return (
        <section id={id} className="space-y-5 scroll-mt-24">
            <h2 className={`text-2xl font-black italic tracking-wider text-white flex items-center gap-3 uppercase border-l-4 pl-4 ${color}`}>
                {icon}
                <span className="text-white/30 font-mono text-lg">{number}</span>
                {title}
            </h2>
            <div className="space-y-4 text-base text-white/70 leading-relaxed pl-2">
                {children}
            </div>
        </section>
    );
}

function InfoBox({ type, children }: { type: 'note' | 'warning' | 'danger' | 'success'; children: ReactNode }) {
    const styles = {
        note: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
        warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
        danger: 'bg-red-500/10 border-red-500/30 text-red-300',
        success: 'bg-green-500/10 border-green-500/30 text-green-300',
    };
    return (
        <div className={`p-4 border rounded-xl text-sm ${styles[type]}`}>
            {children}
        </div>
    );
}

export default function DocsPage() {
    return (
        <main className="min-h-screen bg-transparent text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Arena
                </Link>

                <div className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-2 uppercase text-white">
                        Documentation
                    </h1>
                    <p className="text-lg text-white/50">
                        Contract-accurate reference for all market rules, fee structures, and decentralized resolution mechanics.
                    </p>
                    <p className="text-xs text-white/30 mt-2 font-mono">
                        Contract: <a href="https://sepolia.basescan.org/address/0xF8623E94364b58246BC6FaBeA10710563d2dB6ae#code" target="_blank" rel="noreferrer" className="text-primary hover:underline">0xF8623E94364b58246BC6FaBeA10710563d2dB6ae</a> · Base Sepolia Testnet
                    </p>
                </div>

                {/* Table of Contents */}
                <nav className="mb-12 p-6 bg-white/[0.03] rounded-2xl border border-white/5">
                    <h2 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Contents</h2>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 text-sm">
                        {[
                            ['#what-is', '1. What Is Prediction Battle'],
                            ['#markets', '2. Markets & Creation Rules'],
                            ['#betting', '3. Betting & Liquidity Mechanics'],
                            ['#fees', '4. Fee Structure'],
                            ['#payouts', '5. Winning, Losing & Scenarios'],
                            ['#resolution', '6. Decentralized Resolution'],
                            ['#slash', '7. Punishment & Slashing'],
                            ['#faq', '8. FAQ'],
                        ].map(([href, label]) => (
                            <li key={href}><a href={href} className="text-white/50 hover:text-primary transition-colors">{label}</a></li>
                        ))}
                    </ul>
                </nav>

                <div className="space-y-16">

                    {/* 1 */}
                    <Section id="what-is" number="01" icon={<Flame className="w-5 h-5" />} color="border-orange-500" title="What Is Prediction Battle">
                        <p>
                            Prediction Battle is a <strong className="text-white">non-custodial prediction market</strong> running fully on the <strong className="text-white">Base blockchain</strong>.
                            All funds are held exclusively by a verified smart contract. No central authority can freeze, move, or confiscate your stake — except in explicitly defined <a href="#slash" className="text-primary hover:underline">slash conditions</a>.
                        </p>
                        <p>
                            Markets are structured as <strong className="text-white">binary disputes</strong> between two sides (e.g., <em>Creator A vs Creator B</em>, <em>Ethereum vs Solana this quarter</em>, <em>Will @user hit 1M followers before @other?</em>).
                            Participants stake USDC on the side they believe will win. Winners claim a share of the losing pool.
                        </p>
                        <InfoBox type="note">
                            <strong>No House Edge in the traditional sense.</strong> The "house" only takes a fixed fee percentage. There is no counter-party risk — the protocol never bets against you.
                        </InfoBox>
                    </Section>

                    {/* 2 */}
                    <Section id="markets" number="02" icon={<Swords className="w-5 h-5" />} color="border-blue-500" title="Markets & Creation Rules">
                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2">Who Can Create</h3>
                        <p>Any connected wallet can create a market. There is a <strong className="text-white">1-hour cooldown</strong> between market creations per address (anti-spam).</p>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">Creation Requirements</h3>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong className="text-white">Seed Liquidity (minimum 1 USDC):</strong> The creator must deposit a USDC seed to bootstrap the market. This amount is NOT part of the betting pool and is fully refundable to the creator after market resolution. It is held separately by the contract.</li>
                            <li><strong className="text-white">Question:</strong> Must be between 10 and 500 characters.</li>
                            <li><strong className="text-white">Deadline:</strong> A future timestamp after which no new bets are accepted and the result can be proposed. Markets with no deadline ("open-ended") accept bets until someone proposes the first outcome.</li>
                        </ul>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">Market Types</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <h4 className="font-bold text-white mb-1">⏱ Time-Bound Market</h4>
                                <p className="text-sm">Has an explicit expiration. Result can only be proposed after the deadline. Examples: <em>"Who gets more retweets this week?"</em>, <em>"Who posts first on Sunday?"</em></p>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <h4 className="font-bold text-white mb-1">🔓 Open-Ended Market</h4>
                                <p className="text-sm">No deadline. Anyone can propose the result at any time. Creator must wait 24h after creation before proposing. Great for events with no fixed end date.</p>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">Examples of Valid Markets</h3>
                        <ul className="space-y-2">
                            {[
                                ['🏛️', 'Politics', 'Who will get more mentions on X this month: Trump or Biden?'],
                                ['⛓️', 'Crypto Tribalism', 'Which chain will have more active wallets in Q2: Solana or Ethereum?'],
                                ['📱', 'Social Warfare', `Will @elonmusk's next post get more likes than @MrBeast's next YouTube link on X?`],
                                ['🎭', 'Influencer Drama', 'Who will hit 10M followers on X first: Creator A or Creator B?'],
                                ['🏆', 'Sports Predictions', `Which team's announcement post will get more shares this weekend?`],
                            ].map(([icon, label, desc]) => (
                                <li key={label} className="flex gap-3 text-sm">
                                    <span>{icon}</span>
                                    <div><strong className="text-white">{label}:</strong> {desc}</div>
                                </li>
                            ))}
                        </ul>

                        <InfoBox type="warning">
                            <strong>Market Cap:</strong> The maximum total betting pool per market is <strong>1,000,000 USDC</strong>. No single bet may exceed <strong>100,000 USDC</strong>.
                        </InfoBox>
                    </Section>

                    {/* 3 */}
                    <Section id="betting" number="03" icon={<Coins className="w-5 h-5" />} color="border-green-500" title="Betting & Liquidity Mechanics">
                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2">Bet Limits</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong className="text-white">Minimum bet:</strong> 0.05 USDC</li>
                            <li><strong className="text-white">Maximum bet:</strong> 100,000 USDC</li>
                            <li>Bets can only be placed while the market is in <strong className="text-white">OPEN</strong> state and before the deadline.</li>
                            <li>You may bet multiple times on the same market and same side. Each bet accumulates your position.</li>
                        </ul>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">How the Multiplier Works (Pari-Mutuel System)</h3>
                        <p>
                            Your USDC goes directly into the liquidity pool of the side you chose. There are two separate pools: <strong className="text-white">Side A Pool</strong> and <strong className="text-white">Side B Pool</strong>.
                            If your side wins, you are entitled to a proportional share of the losing side's pool.
                        </p>
                        <p className="mt-2">
                            Your payout multiplier is determined entirely by the <strong className="text-white">ratio of the two pools</strong> at market close:
                        </p>
                        <div className="p-5 bg-white/5 border border-white/10 rounded-xl mt-4 font-mono text-sm">
                            <p className="text-white/50 mb-2">{`// Simplified formula`}</p>
                            <p><span className="text-primary">yourShare</span> = (yourBet / totalWinningSidePool) × totalLosingPool</p>
                            <p><span className="text-primary">grossPayout</span> = yourShare + yourOriginalBet</p>
                            <p><span className="text-primary">netPayout</span> = grossPayout − 21% fees (on profit only)</p>
                        </div>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">Numerical Example</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-sm">
                                <h4 className="font-bold text-white mb-2">🏗️ Setup</h4>
                                <ul className="space-y-1">
                                    <li>Side A pool: <strong className="text-white">$200 USDC</strong></li>
                                    <li>Side B pool: <strong className="text-white">$1,000 USDC</strong></li>
                                    <li>Your bet: <strong className="text-green-400">$100 on Side A</strong></li>
                                    <li>Your share of Side A: 100 / 300 = <strong className="text-white">33.3%</strong></li>
                                </ul>
                            </div>
                            <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl text-sm">
                                <h4 className="font-bold text-green-400 mb-2">✅ If Side A Wins</h4>
                                <ul className="space-y-1">
                                    <li>Your slice of losing pool: 33.3% × $1,000 = $333</li>
                                    <li>Gross payout: $333 + $100 = <strong className="text-white">$433</strong></li>
                                    <li>Profit: $333 → 21% fee = ~$70</li>
                                    <li>Net payout: ≈ <strong className="text-green-400">$363 USDC</strong></li>
                                </ul>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">Early Bird Bonus</h3>
                        <p>
                            Bets placed during the <strong className="text-white">Bonus Window</strong> (a time range defined by the creator at market creation) receive <strong className="text-white">up to 1.2x</strong> the shares compared to bets placed after the bonus period.
                            This rewards early participants for taking on greater uncertainty.
                        </p>
                        <InfoBox type="note">
                            Shares determine your proportional claim on the winning pool. More shares = bigger slice of the pie. After the bonus window closes, all new bets receive 1.0x shares.
                        </InfoBox>
                    </Section>

                    {/* 4 */}
                    <Section id="fees" number="04" icon={<Clock className="w-5 h-5" />} color="border-yellow-500" title="Fee Structure">
                        <p>
                            All fees are deducted <strong className="text-white">only from the profit</strong> (i.e., from the losing side's pool before it is distributed to winners). Your original stake is never subject to fees.
                        </p>

                        <div className="overflow-hidden rounded-xl border border-white/10 mt-4">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white/5 text-white/50 uppercase text-xs tracking-wider">
                                    <tr>
                                        <th className="p-4">Recipient</th>
                                        <th className="p-4">Rate</th>
                                        <th className="p-4">Who</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    <tr className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-bold text-white">Protocol Treasury</td>
                                        <td className="p-4 font-mono text-yellow-400">10%</td>
                                        <td className="p-4">Maintenance, security, development</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-bold text-white">Market Creator</td>
                                        <td className="p-4 font-mono text-yellow-400">5%</td>
                                        <td className="p-4">The wallet that created the market</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-bold text-white">Referrer</td>
                                        <td className="p-4 font-mono text-yellow-400">5%</td>
                                        <td className="p-4">Wallet that referred the winning bettor (if any)</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-bold text-white">Result Reporter</td>
                                        <td className="p-4 font-mono text-yellow-400">1%</td>
                                        <td className="p-4">Whoever proposed the correct final outcome on-chain</td>
                                    </tr>
                                    <tr className="bg-white/5">
                                        <td className="p-4 font-bold text-primary">Total</td>
                                        <td className="p-4 font-mono font-bold text-primary">21%</td>
                                        <td className="p-4 text-white/50">Applied to the profit portion only</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <InfoBox type="note">
                            If no referrer was recorded for a winning bettor, the 5% referrer share is not collected — it stays in the pool and is distributed to all other winners, increasing their payout.
                        </InfoBox>
                    </Section>

                    {/* 5 */}
                    <Section id="payouts" number="05" icon={<Scale className="w-5 h-5" />} color="border-purple-500" title="Winning, Losing & Scenarios">
                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2">If You Win</h3>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>You receive <strong className="text-white">100% of your original stake back.</strong></li>
                            <li>You receive a proportional share of the losing side's pool.</li>
                            <li>From that profit, 21% is deducted in fees (see Section 4).</li>
                            <li>Your net USDC is available to claim on your Profile page once the market is finalized.</li>
                        </ol>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">If You Lose</h3>
                        <p>
                            You lose <strong className="text-red-400">100%</strong> of your staked USDC. Your funds are immediately locked in the contract and transferred to the winning pool for distribution. There is no partial refund and no cancellation after a bet is placed.
                        </p>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">DRAW — Technical Tie</h3>
                        <p>
                            If the market resolves as a <strong className="text-white">technical draw</strong> (e.g., exact tie in a measurable metric), <strong className="text-white">all bettors on both sides</strong> receive their original stake back in full. The protocol does NOT collect fees on a draw.
                        </p>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">CANCELLED — Admin Void</h3>
                        <p>
                            If an admin cancels the market (e.g., the subject became unverifiable, or the market was fraudulently created), <strong className="text-white">all participants receive 100% of their stake back.</strong> Gas fees spent placing bets are not refunded.
                        </p>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">One-sided Market (No Losers)</h3>
                        <p>
                            If a market resolves and the losing side had <strong className="text-white">$0 in bets</strong> (everyone bet on the same side), there is no losing pool to distribute. All participants simply receive their original stake back, net of nothing.
                        </p>
                    </Section>

                    {/* 6 */}
                    <Section id="resolution" number="06" icon={<Shield className="w-5 h-5" />} color="border-cyan-500" title="Decentralized Resolution">
                        <p>
                            Market resolution does not depend on a central server or oracle. It uses a <strong className="text-white">Bond-backed proposal system</strong> where economic incentives punish dishonest reporters.
                        </p>

                        <div className="space-y-4 mt-6">
                            {[
                                {
                                    step: '1',
                                    color: 'bg-blue-500 shadow-blue-500/30',
                                    title: 'Proposal (Verification)',
                                    body: <>
                                        After the market deadline, any user clicks <strong className="text-white">"Verify / Approve Result"</strong>. They must submit a <strong className="text-white">Bond</strong> starting at <strong className="text-white">5 USDC</strong> (scales with total pool size) along with a link to evidence (e.g. a screenshot or archive URL).
                                        <br /><br />
                                        The proposer defines the winning side. The market immediately enters the <strong className="text-white">PROPOSED</strong> state.
                                    </>
                                },
                                {
                                    step: '2',
                                    color: 'bg-yellow-500 shadow-yellow-500/30 text-black',
                                    title: '12-Hour Dispute Window',
                                    body: <>
                                        The market is frozen in <strong className="text-white">PROPOSED</strong> state for exactly <strong className="text-white">12 hours (43,200 seconds)</strong>. During this time, anyone who believes the result is incorrect can submit a <strong className="text-white">Challenge</strong>.
                                        <br /><br />
                                        To challenge, the disputer must deposit a bond <strong className="text-white">at least equal to the original proposal bond</strong>. The proposer cannot challenge their own proposal.
                                    </>
                                },
                                {
                                    step: '3',
                                    color: 'bg-green-500 shadow-green-500/30 text-black',
                                    title: 'Finalization (No Dispute)',
                                    body: <>
                                        If the 12-hour window passes without a challenge, any user can call <strong className="text-white">"Finalize Market"</strong>. The proposed outcome is locked on-chain permanently. The proposer receives:
                                        <ul className="list-disc pl-5 mt-2 space-y-1">
                                            <li>Their full bond returned.</li>
                                            <li>The <strong className="text-white">1% Reporter Reward</strong> from the market's profit pool.</li>
                                        </ul>
                                    </>
                                },
                                {
                                    step: '4',
                                    color: 'bg-red-500 shadow-red-500/30',
                                    title: 'Admin Arbitration (If Disputed)',
                                    body: <>
                                        If a challenge is submitted, the market enters <strong className="text-white">DISPUTED</strong> state. An admin (or in future, a DAO) reviews both evidence URLs and decides the correct outcome.
                                        <ul className="list-disc pl-5 mt-2 space-y-1">
                                            <li>The <strong className="text-white">honest party</strong> gets their bond back + <strong className="text-white">80% of the liar's bond</strong> as a bounty reward.</li>
                                            <li>The <strong className="text-red-400">dishonest party</strong> loses their entire bond. 20% goes to the protocol treasury.</li>
                                            <li>The winning party also inherits the <strong className="text-white">1% Reporter Reward</strong>.</li>
                                        </ul>
                                    </>
                                },
                            ].map(({ step, color, title, body }) => (
                                <div key={step} className="relative flex gap-5">
                                    <div className={`w-8 h-8 rounded-full ${color} flex-shrink-0 flex items-center justify-center font-bold text-sm shadow-lg mt-1`}>{step}</div>
                                    <div className="flex-1 p-5 bg-white/[0.03] border border-white/5 rounded-xl">
                                        <h4 className="font-bold text-white mb-2 text-base">{title}</h4>
                                        <div className="text-sm text-white/60">{body}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* 7 */}
                    <Section id="slash" number="07" icon={<TriangleAlert className="w-5 h-5" />} color="border-red-500" title="Punishment & Slashing">
                        <InfoBox type="danger">
                            <strong>⚠️ Slashing is irreversible.</strong> Once a slash is executed on-chain, funds are permanently confiscated and sent to the protocol treasury. There is no appeal process after on-chain execution.
                        </InfoBox>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">1. Bond Slashing (Dishonest Reporter)</h3>
                        <p>
                            If a user submits a false outcome proposal and is successfully challenged and overturned in arbitration, they are slashed:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2">
                            <li>The liar loses <strong className="text-red-400">100%</strong> of their bond.</li>
                            <li><strong className="text-white">80%</strong> of that bond is awarded to the honest challenger as a bounty.</li>
                            <li><strong className="text-white">20%</strong> is permanently sent to the protocol treasury.</li>
                        </ul>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">2. Seed Confiscation (Fraudulent Market Creator)</h3>
                        <p>
                            If an admin determines that a market was created with fraudulent intent (e.g., designed to deceive bettors, with manipulated subject matter, or citing fabricated content), the creator's seed deposit is permanently confiscated:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2">
                            <li>The creator's seed (minimum 1 USDC, can be any deposited amount) is transferred in full to the protocol treasury.</li>
                            <li>The creator loses all right to recover their seed.</li>
                            <li>Bettors of the market are protected — their stakes are refunded (the market resolves as CANCELLED).</li>
                        </ul>

                        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">What Triggers a Slash?</h3>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>Submitting a false result as a verifier/proposer.</li>
                            <li>Creating a market with fabricated or unverifiable questions designed to steal bets.</li>
                            <li>Collusion attempts detected by the arbitration process.</li>
                        </ul>

                        <InfoBox type="warning">
                            The slash mechanism exists to make dishonest behavior more expensive than honest behavior. The bond requirement scales with pool size, so attempting to manipulate a large market requires a proportionally large bond at risk.
                        </InfoBox>
                    </Section>

                    {/* 8 */}
                    <Section id="faq" number="08" icon={<HelpCircle className="w-5 h-5" />} color="border-white/20" title="FAQ">
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                ['Can I cancel my bet?', 'No. Blockchain transactions are immutable. Once your stake is submitted to the contract, it is locked until the market resolves. Bets cannot be reversed.'],
                                ['Can I bet on both sides?', 'Technically yes, but the contract treats each side independently. Betting on both sides does not create arbitrage; you will simply win on one side and lose on the other, netting negative due to fees.'],
                                ['What happens if the market expires but no one verifies it?', 'The market stays in OPEN state indefinitely until someone submits a proposal. There is an Emergency Timeout of 30 days after which the admin can force-void the market and refund all bettors.'],
                                ['Who gets the creator fee if the creator is slashed?', 'If the creator was slashed (fraudulent market), the market is cancelled. No fees are collected on cancelled markets — all bettors receive 100% refunds.'],
                                ['Is there a fee to create a market?', 'No protocol fee for creation. You only need to deposit the Seed (min 1 USDC). That seed is returned to you after resolution. You will pay a small gas fee (~$0.01 or less on Base).'],
                                ['Can the same wallet bet multiple times on the same market?', 'Yes. Multiple bets from the same wallet on the same side are accumulated into a single position. You cannot bet on both sides with the same wallet.'],
                                ['What is the minimum to participate?', 'The minimum bet is 0.05 USDC. The minimum to create a market is a 1 USDC seed deposit.'],
                                ['Is this legal in my country?', 'Prediction markets are speculative instruments under DeFi. Their legal classification varies by jurisdiction. Consult local regulations before participating.'],
                            ].map(([q, a]) => (
                                <div key={q} className="p-5 bg-white/[0.03] rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <h4 className="font-bold text-white mb-2 text-sm">{q}</h4>
                                    <p className="text-xs text-white/50 leading-relaxed">{a}</p>
                                </div>
                            ))}
                        </div>
                    </Section>

                </div>
            </div>
        </main>
    );
}
