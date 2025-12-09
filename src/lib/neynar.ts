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
