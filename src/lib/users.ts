import { kv } from '@vercel/kv';

export interface UserProfile {
    wallet_address: string; // Key
    display_name?: string;
    username?: string; // Farcaster username if linked
    pfp_url?: string;
    updated_at: number;
}

const USERS_KEY = 'prediction_users';

export const userStore = {
    // Get user by address (case insensitive)
    async getUser(address: string): Promise<UserProfile | null> {
        if (!address) return null;
        try {
            const user = await kv.hget(USERS_KEY, address.toLowerCase());
            return user as UserProfile | null;
        } catch (error) {
            console.error('Redis Error (getUser):', error);
            return null;
        }
    },

    // Save/Update user
    async saveUser(data: { address: string; displayName?: string; pfpUrl?: string; username?: string }): Promise<UserProfile> {
        try {
            const key = data.address.toLowerCase();
            const existing = await this.getUser(key);

            const updatedUser: UserProfile = {
                wallet_address: key,
                display_name: data.displayName || existing?.display_name,
                pfp_url: data.pfpUrl || existing?.pfp_url,
                username: data.username || existing?.username,
                updated_at: Date.now(),
            };

            await kv.hset(USERS_KEY, { [key]: updatedUser });
            return updatedUser;
        } catch (error) {
            console.error('Redis Error (saveUser):', error);
            throw error;
        }
    }
};
