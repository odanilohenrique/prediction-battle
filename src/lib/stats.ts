
import { Bet } from './store';
import { formatUnits } from 'viem';

export interface UserStats {
    totalBets: number;
    wins: number;
    losses: number;
    voids: number;
    winRate: number;
    totalInvested: number;
    totalClaimed: number;
    netProfit: number;
    activeBetsCount: number;
}

export function calculateUserStats(address: string, allBets: Bet[]): UserStats {
    const stats: UserStats = {
        totalBets: 0,
        wins: 0,
        losses: 0,
        voids: 0,
        winRate: 0,
        totalInvested: 0,
        totalClaimed: 0,
        netProfit: 0,
        activeBetsCount: 0
    };

    if (!address || !allBets) return stats;
    const userLower = address.toLowerCase();

    allBets.forEach(bet => {
        // Participants are stored in yes/no arrays
        const yesParticipant = bet.participants.yes.find(p => p.userId.toLowerCase() === userLower);
        const noParticipant = bet.participants.no.find(p => p.userId.toLowerCase() === userLower);

        const participant = yesParticipant || noParticipant;

        if (!participant) return;

        stats.totalBets++;
        stats.totalInvested += participant.amount;

        // Check status
        if (bet.status === 'active') {
            stats.activeBetsCount++;
        } else if (bet.status === 'completed') {
            // Determine result
            // Check if we won
            const mySide = yesParticipant ? 'yes' : 'no';

            if (bet.result === 'void') {
                stats.voids++;
                // In void, you verify refund usually, keeping logic simple for now
                // Assuming void = refund, net 0 change ideally, or +claimed = +invested
            } else if (bet.result === mySide) {
                stats.wins++;
                // If they claimed, add to totalClaimed
                // We depend on 'paid' flag or 'payout' field
                if (participant.paid && participant.payout) {
                    stats.totalClaimed += participant.payout;
                }
            } else if (bet.result && bet.result !== mySide) {
                stats.losses++;
            }
        }
    });

    if (stats.wins + stats.losses > 0) {
        stats.winRate = (stats.wins / (stats.wins + stats.losses)) * 100;
    }

    stats.netProfit = stats.totalClaimed - stats.totalInvested;
    // Note: Net Profit is tricky if active bets are included in invested but not yet claimed. 
    // Usually PnL is Realized PnL.
    // Let's adjust: Realized Invested = Total Invested - Active Invested

    // Actually, for "Net Profit" usually we see detailed breakdown. 
    // Let's stick to simple "Claimed - Invested" for now, but usually investment in active bets shouldn't count as loss yet.
    // Correcting Net Profit to be Realized only:

    // Re-calc realized invested
    let realizedInvested = 0;
    allBets.forEach(bet => {
        const p = bet.participants.yes.find(u => u.userId.toLowerCase() === userLower) ||
            bet.participants.no.find(u => u.userId.toLowerCase() === userLower);
        if (p && bet.status === 'completed') {
            realizedInvested += p.amount;
        }
    });

    stats.netProfit = stats.totalClaimed - realizedInvested;

    return stats;
}
