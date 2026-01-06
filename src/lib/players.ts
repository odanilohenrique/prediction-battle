import { kv } from '@vercel/kv';

export interface Player {
    id: string;
    username: string;
    displayName?: string;
    pfpUrl?: string;
    fid?: number;
    createdAt: number;
}

const PLAYERS_KEY = 'prediction_players';

export const playerStore = {
    // Get all players
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

    // Get single player by username
    async getPlayer(username: string): Promise<Player | null> {
        try {
            const player = await kv.hget(PLAYERS_KEY, username.toLowerCase());
            return player as Player | null;
        } catch (error) {
            console.error('Redis Error (getPlayer):', error);
            return null;
        }
    },

    // Save/Update player (automatically called when new player is used in a battle)
    async savePlayer(player: Omit<Player, 'id' | 'createdAt'>): Promise<Player> {
        try {
            const existingPlayer = await this.getPlayer(player.username);
            if (existingPlayer) {
                // Update existing player with new info if provided
                const updatedPlayer: Player = {
                    ...existingPlayer,
                    displayName: player.displayName || existingPlayer.displayName,
                    pfpUrl: player.pfpUrl || existingPlayer.pfpUrl,
                    fid: player.fid || existingPlayer.fid,
                };
                await kv.hset(PLAYERS_KEY, { [player.username.toLowerCase()]: updatedPlayer });
                return updatedPlayer;
            }

            // Create new player
            const newPlayer: Player = {
                id: `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                username: player.username.toLowerCase(),
                displayName: player.displayName,
                pfpUrl: player.pfpUrl,
                fid: player.fid,
                createdAt: Date.now(),
            };
            await kv.hset(PLAYERS_KEY, { [player.username.toLowerCase()]: newPlayer });
            return newPlayer;
        } catch (error) {
            console.error('Redis Error (savePlayer):', error);
            throw error;
        }
    },

    // Search players by username prefix (for autocomplete)
    async searchPlayers(query: string, limit: number = 10): Promise<Player[]> {
        try {
            const allPlayers = await this.getPlayers();
            const lowerQuery = query.toLowerCase();
            return allPlayers
                .filter(p => p.username.includes(lowerQuery) || p.displayName?.toLowerCase().includes(lowerQuery))
                .slice(0, limit);
        } catch (error) {
            console.error('Redis Error (searchPlayers):', error);
            return [];
        }
    }
};
