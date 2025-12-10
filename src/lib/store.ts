// In-memory storage for admin-created bets
// Note: In a real production app, this should be replaced by a database (Postgres/Redis)
// Since Vercel serverless functions are stateless, this data will reset on new deployments/cold starts.
// For a production MVP, we should use Vercel KV or Supabase.

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

// Global store
export const adminBets = new Map<string, Bet>();
