import Link from 'next/link';
import { Twitter, Github, BookOpen, Map, FileText } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="w-full border-t border-white/5 bg-black/20 mt-20">
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    {/* Brand */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-black text-white italic tracking-tighter">
                            PREDICTION BATTLE
                        </h3>
                        <p className="text-sm text-white/40 leading-relaxed">
                            The ultimate on-chain prediction arena where engagement meets accountability.
                            Built on Base.
                        </p>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                            Resources
                        </h4>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <Link href="/roadmap" className="text-white/60 hover:text-primary transition-colors flex items-center gap-2">
                                    <Map className="w-4 h-4" />
                                    Roadmap
                                </Link>
                            </li>
                            <li>
                                <a href="https://docs.predictionbattle.xyz" target="_blank" rel="noreferrer" className="text-white/60 hover:text-primary transition-colors flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    Whitepaper / Docs
                                </a>
                            </li>
                            <li>
                                <a href="#" className="text-white/60 hover:text-primary transition-colors flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Terms of Service
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Community */}
                    <div>
                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                            Community
                        </h4>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <a href="https://warpcast.com/~/channel/predictionbattle" target="_blank" rel="noreferrer" className="text-white/60 hover:text-purple-400 transition-colors flex items-center gap-2">
                                    <div className="w-4 h-4 bg-purple-500 rounded-sm"></div> {/* Farcaster Icon Placeholder */}
                                    Warpcast
                                </a>
                            </li>
                            <li>
                                <a href="https://twitter.com" target="_blank" rel="noreferrer" className="text-white/60 hover:text-blue-400 transition-colors flex items-center gap-2">
                                    <Twitter className="w-4 h-4" />
                                    Twitter (X)
                                </a>
                            </li>
                            <li>
                                <a href="https://github.com/predictionbattle" target="_blank" rel="noreferrer" className="text-white/60 hover:text-white transition-colors flex items-center gap-2">
                                    <Github className="w-4 h-4" />
                                    GitHub
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/20">
                    <p>© 2026 Prediction Battle. All rights reserved.</p>
                    <div className="flex items-center gap-4">
                        <span>Powered by Base</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
