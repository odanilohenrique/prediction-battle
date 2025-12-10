import { kv } from '@vercel/kv';

export interface BetParticipant {
    userId: string;
    choice: 'yes' | 'no';
    amount: number;
    timestamp: number;
}

export interface Bet {
    id: string;
    username: string;
    type: string;
    target: number;
    timeframe: string;
    minBet: number;
    maxBet: number;
    createdAt: number;
    expiresAt: number;
    status: 'active' | 'completed';
    totalPot: number;
    participantCount: number;
    participants: {
        yes: BetParticipant[];
        no: BetParticipant[];
    };
}

const BETS_KEY = 'prediction_bets';

export const store = {
    // Get all bets
    async getBets(): Promise<Bet[]> {
        try {
            const bets = await kv.hgetall(BETS_KEY);
            if (!bets) return [];
            // Redis returns object with id keys, convert to array
            return Object.values(bets) as Bet[];
        } catch (error) {
            console.error('Redis Error (getBets):', error);
            return [];
        }
    },

    // Get single bet
    async getBet(id: string): Promise<Bet | null> {
        try {
            const bet = await kv.hget(BETS_KEY, id);
            return bet as Bet | null;
        } catch (error) {
            console.error('Redis Error (getBet):', error);
            return null;
        }
    },

    // Save/Update bet
    async saveBet(bet: Bet): Promise<void> {
        try {
            await kv.hset(BETS_KEY, { [bet.id]: bet });
        } catch (error) {
            console.error('Redis Error (saveBet):', error);
            throw error;
        }
    },

    // Delete bet (optional, for cleanup)
    async deleteBet(id: string): Promise<void> {
        try {
            await kv.hdel(BETS_KEY, id);
        } catch (error) {
            console.error('Redis Error (deleteBet):', error);
            throw error;
        }
    }
};
