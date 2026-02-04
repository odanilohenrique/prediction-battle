
import { Bet } from '@/lib/store';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface BetHistoryListProps {
    bets: Bet[];
    address: string;
}

export function BetHistoryList({ bets, address }: BetHistoryListProps) {
    if (bets.length === 0) {
        return (
            <div className="text-center py-12 bg-white/5 rounded-3xl border border-white/5">
                <Clock className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/40 font-medium">No betting history found.</p>
                <Link href="/" className="inline-block mt-4 text-primary text-sm font-bold hover:underline">
                    EXPLORE MARKETS
                </Link>
            </div>
        );
    }

    const userLower = address.toLowerCase();

    return (
        <div className="space-y-3">
            {bets.map(bet => {
                const yesP = bet.participants.yes.find(p => p.userId.toLowerCase() === userLower);
                const noP = bet.participants.no.find(p => p.userId.toLowerCase() === userLower);
                const mySide = yesP ? 'yes' : 'no';
                const myAmount = yesP ? yesP.amount : (noP ? noP.amount : 0);
                const isPaid = (yesP?.paid) || (noP?.paid);

                let resultStatus = 'pending';
                if (bet.status === 'completed') {
                    if (bet.result === 'void') resultStatus = 'void';
                    else if (bet.result === mySide) resultStatus = 'won';
                    else resultStatus = 'lost';
                }

                return (
                    <Link
                        key={bet.id}
                        href={`/prediction/${bet.id}`}
                        className="block bg-black/20 hover:bg-white/5 border border-white/5 rounded-xl p-4 transition-all"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-white/40 font-mono">
                                {formatDistanceToNow(bet.createdAt)} ago
                            </span>
                            <StatusBadge status={resultStatus} isPaid={isPaid} />
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex-1">
                                <h4 className="text-white font-bold text-sm leading-tight mb-1 line-clamp-2">
                                    {bet.castText || `Prediction Market #${bet.id.slice(0, 6)}`}
                                </h4>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-white/50">You picked:</span>
                                    <span className={`font-bold uppercase ${mySide === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                                        {mySide}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-white font-bold">${myAmount}</div>
                                <div className="text-[10px] text-white/30 uppercase">Invested</div>
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}

function StatusBadge({ status, isPaid }: { status: string, isPaid?: boolean }) {
    if (status === 'won') {
        return (
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isPaid ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {isPaid ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {isPaid ? 'WON & PAID' : 'WON (UNCLAIMED)'}
            </span>
        );
    }
    if (status === 'lost') {
        return (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                <XCircle className="w-3 h-3" />
                LOST
            </span>
        );
    }
    if (status === 'void') {
        return (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                VOIDED
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
            <Clock className="w-3 h-3" />
            LIVE
        </span>
    );
}
