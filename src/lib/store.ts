import { kv } from '@vercel/kv';
import { unstable_noStore as noStore } from 'next/cache';

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
    isVersus?: boolean;   // Flag for Battle (A vs B) mode
    optionA?: { label: string; imageUrl?: string }; // Maps to 'yes'
    optionB?: { label: string; imageUrl?: string }; // Maps to 'no'

    // Optional prediction image (logo/visual)
    predictionImage?: string;

    // Settlement Data
    feeAmount?: number;         // Total Fee Deducted (20%)
    protocolFeeAmount?: number; // Fee going to the protocol
    creatorFeeAmount?: number;  // Fee going to the creator (if applicable)
    winnerPool?: number;        // Remaining 80% for winners

    creatorAddress?: string;    // Wallet address of the battle creator
    wordToMatch?: string;       // For 'word_mentions' type

    // Automated Verification Metadata
    verification?: {
        enabled: boolean;
        type: 'likes' | 'recasts' | 'replies' | 'followers' | 'keyword';
        target: number | string; // e.g. 1000 or "build"
        url?: string; // Link to the specific cast to verify (for engagement bets)
        username?: string; // User to check (for follower/keyword bets)
        wordToMatch?: string; // If keyword type
    };
}

const BETS_KEY = 'prediction_bets';
const PLAYERS_KEY = 'prediction_players';

export interface Player {
    username: string; // Unique identifier (handle)
    displayName: string;
    pfpUrl: string;
}

export const store = {
    // Get all bets
    async getBets(): Promise<Bet[]> {
        noStore(); // Opt out of static optimizations
        const t = Date.now();
        console.log(`[STORE] getBets START at ${new Date(t).toISOString()}`);

        try {
            const bets = await kv.hgetall(BETS_KEY);
            if (!bets) {
                console.log(`[STORE] getBets: No bets found in Redis. (Duration: ${Date.now() - t}ms)`);
                return [];
            }
            // Redis returns object with id keys, convert to array
            const betArray = Object.values(bets) as Bet[];

            console.log(`[STORE] getBets: Found ${betArray.length} bets via SDK. (Duration: ${Date.now() - t}ms)`);

            if (betArray.length > 0) {
                const sorted = [...betArray].sort((a, b) => b.createdAt - a.createdAt);
                const newest = sorted[0];
                console.log(`[STORE] Newest Bet ID: ${newest.id}, CreatedAt: ${new Date(newest.createdAt).toISOString()}`);
            }

            return betArray;
        } catch (error) {
            console.error(`[STORE] Redis Error (getBets) after ${Date.now() - t}ms:`, error);
            return [];
        }
    },

    // Get single bet
    async getBet(id: string): Promise<Bet | null> {
        noStore();
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
            console.log(`[STORE] Saving bet with ID: ${bet.id}, creatorAddress: ${bet.creatorAddress}, status: ${bet.status}`);
            await kv.hset(BETS_KEY, { [bet.id]: bet });
            console.log(`[STORE] Bet ${bet.id} saved successfully!`);
        } catch (error) {
            console.error('[STORE] Redis Error (saveBet):', error);
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
    },

    // Nuke all bets (Phase 3 Reset)
    async deleteAllBets(): Promise<void> {
        try {
            await kv.del(BETS_KEY);
            console.log('[STORE] All bets deleted (Nuked).');
        } catch (error) {
            console.error('Redis Error (deleteAllBets):', error);
            throw error;
        }
    },

    // --- PLAYER METHODS ---

    async getPlayers(): Promise<Player[]> {
        noStore();
        try {
            const players = await kv.hgetall(PLAYERS_KEY);
            if (!players) return [];
            return Object.values(players) as Player[];
        } catch (error) {
            console.error('Redis Error (getPlayers):', error);
            return [];
        }
    },

    async savePlayer(player: Player): Promise<void> {
        try {
            const key = player.username.toLowerCase();
            await kv.hset(PLAYERS_KEY, { [key]: { ...player, username: key } });
        } catch (error) {
            console.error('Redis Error (savePlayer):', error);
            throw error;
        }
    },

    async savePlayers(players: Player[]): Promise<void> {
        try {
            const hashObj: Record<string, Player> = {};
            players.forEach(p => {
                const key = p.username.toLowerCase();
                hashObj[key] = { ...p, username: key };
            });
            if (Object.keys(hashObj).length > 0) {
                await kv.hset(PLAYERS_KEY, hashObj);
            }
        } catch (error) {
            console.error('Redis Error (savePlayers):', error);
            throw error;
        }
    }
};
