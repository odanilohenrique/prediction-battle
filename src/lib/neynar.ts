// Neynar API client utilities

import { Cast } from './types';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';
const NEYNAR_API_BASE = 'https://api.neynar.com/v2';

/**
 * Fetch trending casts from the last few hours
 */
export async function getTrendingCasts(limit: number = 20): Promise<Cast[]> {
    try {
        const response = await fetch(
            `${NEYNAR_API_BASE}/farcaster/feed/trending?limit=${limit}`,
            {
                headers: {
                    'api_key': NEYNAR_API_KEY,
                },
                next: { revalidate: 300 }, // Cache for 5 minutes
            }
        );

        if (!response.ok) {
            if (response.status === 402) {
                console.warn('Neynar API Payment Required (Trending): Returning empty list.');
                return [];
            }
            throw new Error(`Neynar API error: ${response.statusText}`);
        }

        const data = await response.json();

        return data.casts.map((cast: any) => ({
            hash: cast.hash,
            author: {
                username: cast.author.username,
                displayName: cast.author.display_name || cast.author.username,
                pfp: {
                    url: cast.author.pfp_url || '',
                },
                fid: cast.author.fid,
            },
            text: cast.text,
            reactions: {
                likes_count: cast.reactions?.likes_count || 0,
                recasts_count: cast.reactions?.recasts_count || 0,
                replies_count: cast.replies?.count || 0,
            },
            timestamp: cast.timestamp,
        }));
    } catch (error) {
        console.error('Error fetching trending casts:', error);
        return [];
    }
}

/**
 * Get a specific cast by its hash
 */
export async function getCastByHash(hash: string): Promise<Cast | null> {
    try {
        const response = await fetch(
            `${NEYNAR_API_BASE}/farcaster/cast?identifier=${hash}&type=hash`,
            {
                headers: {
                    'api_key': NEYNAR_API_KEY,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Neynar API error: ${response.statusText}`);
        }

        const data = await response.json();
        const cast = data.cast;

        return {
            hash: cast.hash,
            author: {
                username: cast.author.username,
                displayName: cast.author.display_name || cast.author.username,
                pfp: {
                    url: cast.author.pfp_url || '',
                },
                fid: cast.author.fid,
            },
            text: cast.text,
            reactions: {
                likes_count: cast.reactions?.likes_count || 0,
                recasts_count: cast.reactions?.recasts_count || 0,
                replies_count: cast.replies?.count || 0,
            },
            timestamp: cast.timestamp,
        };
    } catch (error) {
        console.error('Error fetching cast:', error);
        return null;
    }
}

/**
 * Get current engagement stats for a cast
 */
export async function getCastStats(hash: string): Promise<{
    likes: number;
    recasts: number;
    replies: number;
} | null> {
    const cast = await getCastByHash(hash);

    if (!cast) return null;

    return {
        likes: cast.reactions.likes_count,
        recasts: cast.reactions.recasts_count,
        replies: cast.reactions.replies_count,
    };
}

/**
 * Get user profile by Farcaster username
 */
export async function getUserByUsername(username: string): Promise<{
    username: string;
    displayName: string;
    pfpUrl: string;
    fid: number;
} | null> {
    try {
        // Remove @ if present
        const cleanUsername = username.replace(/^@/, '');

        const response = await fetch(
            `${NEYNAR_API_BASE}/farcaster/user/by_username?username=${cleanUsername}`,
            {
                headers: {
                    'api_key': NEYNAR_API_KEY,
                },
            }
        );

        if (!response.ok) {
            // Handle Payment Required (402) specifically
            if (response.status === 402) {
                console.warn('Neynar API Payment Required: Returning fallback/null data.');
                return null;
            }
            console.error(`Neynar API error for username ${cleanUsername}: ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        const user = data.user;

        return {
            username: user.username,
            displayName: user.display_name || user.username,
            pfpUrl: user.pfp_url || '',
            fid: user.fid,
        };
    } catch (error) {
        console.error('Error fetching user by username:', error);
        return null;
    }
}


/**
 * Get user stats (followers, following)
 */
export async function getUserStats(username: string): Promise<{
    followers: number;
    following: number;
} | null> {
    const user = await getUserByUsername(username);
    if (!user) return null;

    try {
        const response = await fetch(
            `${NEYNAR_API_BASE}/farcaster/user?fid=${user.fid}`,
            {
                headers: { 'api_key': NEYNAR_API_KEY }
            }
        );
        const data = await response.json();
        return {
            followers: data.user.follower_count,
            following: data.user.following_count
        };
    } catch (e) {
        console.error('Error fetching user stats:', e);
        return null;
    }
}

/**
 * Get user's recent casts
 */
export async function getUserRecentCasts(fid: number, limit: number = 20): Promise<any[]> {
    try {
        const response = await fetch(
            `${NEYNAR_API_BASE}/farcaster/feed/user/casts?fid=${fid}&limit=${limit}`,
            {
                headers: { 'api_key': NEYNAR_API_KEY }
            }
        );
        const data = await response.json();
        return data.casts || [];
    } catch (e) {
        console.error('Error fetching recent casts:', e);
        return [];
    }
}
