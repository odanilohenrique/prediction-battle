
import { UserStats } from '@/lib/stats';
import { Trophy, TrendingUp, TrendingDown, Target, Skull, Crown } from 'lucide-react';

export function StatsOverview({ stats }: { stats: UserStats }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full">
            {/* Net Profit Card */}
            <div className="col-span-2 md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className={`absolute inset-0 opacity-10 ${stats.netProfit >= 0 ? 'bg-green-500' : 'bg-red-500'} blur-xl group-hover:opacity-20 transition-opacity`} />
                <div className="relative z-10 text-center">
                    <div className="text-xs text-white/50 uppercase font-bold tracking-widest mb-1">Net Profit</div>
                    <div className={`text-3xl font-black ${stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.netProfit >= 0 ? '+' : ''}{stats.netProfit.toFixed(1)}
                        <span className="text-xs ml-1 opacity-70">USDC</span>
                    </div>
                </div>
            </div>

            {/* Win Rate */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-white/10 transition-colors">
                <Crown className="w-6 h-6 text-yellow-500 mb-2 opacity-80" />
                <div className="text-2xl font-bold text-white">{stats.winRate.toFixed(0)}%</div>
                <div className="text-[10px] text-white/30 uppercase font-bold">Win Rate</div>
            </div>

            {/* Wins */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-white/10 transition-colors">
                <Trophy className="w-6 h-6 text-green-500 mb-2 opacity-80" />
                <div className="text-2xl font-bold text-green-500">{stats.wins}</div>
                <div className="text-[10px] text-white/30 uppercase font-bold">Wins</div>
            </div>

            {/* Losses */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-white/10 transition-colors">
                <Skull className="w-6 h-6 text-red-500 mb-2 opacity-80" />
                <div className="text-2xl font-bold text-red-500">{stats.losses}</div>
                <div className="text-[10px] text-white/30 uppercase font-bold">Losses</div>
            </div>

            {/* Total Volume (Desktop Only or Extra Row) */}
            <div className="col-span-2 bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between px-6 group hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                        <div className="text-[10px] text-white/30 uppercase font-bold">Total Volume</div>
                        <div className="text-sm text-white/60">Lifetime Invested</div>
                    </div>
                </div>
                <div className="text-xl font-bold text-white">
                    ${stats.totalInvested.toFixed(2)}
                </div>
            </div>
        </div>
    );
}
