import Link from 'next/link';
import { Twitter, Github, BookOpen, Map, FileText } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="w-full border-t border-white/5 bg-black/40 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    {/* Brand */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-black text-white italic tracking-tighter">
                            PREDICTION BATTLE
                        </h3>
                        <p className="text-xs text-white/40 leading-relaxed max-w-xs">
                            The ultimate on-chain prediction arena where engagement meets accountability.
                            Built on Base.
                        </p>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
                            Resources
                        </h4>
                        <ul className="space-y-2 text-xs">
                            <li>
                                <Link href="/roadmap" className="text-white/50 hover:text-primary transition-colors flex items-center gap-2">
                                    <Map className="w-3 h-3" />
                                    Roadmap
                                </Link>
                            </li>
                            <li>
                                <Link href="/whitepaper" className="text-white/50 hover:text-primary transition-colors flex items-center gap-2">
                                    <BookOpen className="w-3 h-3" />
                                    Whitepaper
                                </Link>
                            </li>
                            <li>
                                <Link href="/docs" className="text-white/50 hover:text-primary transition-colors flex items-center gap-2">
                                    <FileText className="w-3 h-3" />
                                    Docs
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms" className="text-white/50 hover:text-primary transition-colors flex items-center gap-2">
                                    <FileText className="w-3 h-3" />
                                    Terms of Service
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Community */}
                    <div>
                        <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
                            Community
                        </h4>
                        <ul className="space-y-2 text-xs">
                            <li>
                                <a href="https://warpcast.com" target="_blank" rel="noreferrer" className="text-white/50 hover:text-purple-400 transition-colors flex items-center gap-2">
                                    <div className="w-3 h-3 bg-purple-500 rounded-sm"></div>
                                    Warpcast
                                </a>
                            </li>
                            <li>
                                <a href="https://x.com/predictbattleHQ" target="_blank" rel="noreferrer" className="text-white/50 hover:text-blue-400 transition-colors flex items-center gap-2">
                                    <Twitter className="w-3 h-3" />
                                    Twitter (X)
                                </a>
                            </li>
                            <li>
                                <a href="https://github.com/odanilohenrique/prediction-battle" target="_blank" rel="noreferrer" className="text-white/50 hover:text-white transition-colors flex items-center gap-2">
                                    <Github className="w-3 h-3" />
                                    GitHub
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-white/20">
                    <p>© 2026 Prediction Battle. All rights reserved.</p>
                    <div className="flex items-center gap-4">
                        <span>Powered by Base</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
