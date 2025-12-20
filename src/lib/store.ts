import { kv } from '@vercel/kv';

export interface BetParticipant {
    userId: string;
    choice: 'yes' | 'no';
    amount: number;
    timestamp: number;
    paid?: boolean; // Track if user has been paid
    txHash?: string; // Track payout transaction hash
}

export interface Bet {
    id: string;
    username: string;
    displayName?: string;  // Farcaster display name (e.g., "Dan Romero")
    pfpUrl?: string;       // Profile picture URL from Neynar
    fid?: number;          // Farcaster ID for verification
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
    rules?: string;        // Verification rules text
    // Optional fields for user-created viral bets (specific cast)
    castHash?: string;
    castUrl?: string;
    castAuthor?: string;
    castText?: string;
    initialValue?: number;
    result?: 'yes' | 'no';
    finalValue?: number;
    // Versus Mode Options (maps to yes/no)
    optionA?: { label: string; imageUrl?: string }; // Maps to 'yes'
    optionB?: { label: string; imageUrl?: string }; // Maps to 'no'
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
