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
    // Get all bets (REPLACED WITH DIRECT FETCH TO BYPASS CACHE)
    async getBets(): Promise<Bet[]> {
        const t = Date.now();
        console.log(`[STORE] getBets START at ${new Date(t).toISOString()}`);

        try {
            // BYPASS @vercel/kv SDK caching by using direct fetch
            const url = process.env.KV_REST_API_URL;
            const token = process.env.KV_REST_API_TOKEN;

            if (!url || !token) {
                console.error('[STORE] Missing KV_REST_API_URL or KV_REST_API_TOKEN');
                // Fallback to SDK if env vars missing
                const bets = await kv.hgetall(BETS_KEY);
                return bets ? Object.values(bets) as Bet[] : [];
            }

            // Append timestamp to URL to force fresh request at CDN level
            // Standard Upstash/Redis REST API
            const fetchUrl = `${url}/hgetall/${BETS_KEY}?_t=${t}`;

            console.log(`[STORE] Fetching from REST API using fetch(): ${url}/hgetall/${BETS_KEY} (cache: no-store)`);

            const response = await fetch(fetchUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                cache: 'no-store', // Critical: Force fresh fetch
                next: { revalidate: 0 } // Explicit Next.js revalidation disable
            });

            if (!response.ok) {
                console.error(`[STORE] REST API Error: ${response.status} ${response.statusText}`);
                const text = await response.text();
                // If 404/Null, return empty
                return [];
            }

            const data = await response.json();
            const result = data.result;

            if (!result) {
                console.log(`[STORE] getBets: No result in REST response.`);
                return [];
            }

            let betArray: Bet[] = [];

            if (Array.isArray(result)) {
                // Upstash Redis REST returns ["key", "value", "key", "value"] for HGETALL
                for (let i = 1; i < result.length; i += 2) {
                    const val = result[i];
                    if (typeof val === 'string') {
                        try {
                            betArray.push(JSON.parse(val));
                        } catch (e) {
                            console.error('Json parse error', e);
                        }
                    } else if (typeof val === 'object') {
                        betArray.push(val);
                    }
                }
            } else if (typeof result === 'object') {
                betArray = Object.values(result).map((v: any) => {
                    return typeof v === 'string' ? JSON.parse(v) : v;
                });
            }

            console.log(`[STORE] getBets: Found ${betArray.length} bets from REST API. (Duration: ${Date.now() - t}ms)`);

            if (betArray.length > 0) {
                // Log newest for debug
                const sorted = [...betArray].sort((a, b) => b.createdAt - a.createdAt);
                const newest = sorted[0];
                console.log(`[STORE] Newest Bet ID: ${newest.id}, CreatedAt: ${new Date(newest.createdAt).toISOString()}`);
            }

            return betArray;
        } catch (error) {
            console.error(`[STORE] Error in manual fetch (getBets) after ${Date.now() - t}ms:`, error);
            // Fallback
            console.log('[STORE] Falling back to SDK kv.hgetall...');
            try {
                const bets = await kv.hgetall(BETS_KEY);
                return bets ? Object.values(bets) as Bet[] : [];
            } catch (kverr) {
                return [];
            }
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

    // --- PLAYER METHODS ---

    async getPlayers(): Promise<Player[]> {
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
