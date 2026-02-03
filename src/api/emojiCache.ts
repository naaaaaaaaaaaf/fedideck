import { getClient } from './mastoClient';
import type { Session } from '../auth/sessions';

/**
 * Custom emoji cache entry
 */
interface CachedEmojis {
    emojis: CustomEmoji[];
    timestamp: number;
}

export interface CustomEmoji {
    shortcode: string;
    url: string;
    staticUrl: string;
    visibleInPicker: boolean;
    category?: string | null;
}

// Cache instance URL -> emoji data
const emojiCache = new Map<string, CachedEmojis>();

// Cache for 1 hour
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Get custom emojis for an instance, using cache if available
 */
export async function getCustomEmojis(session: Session): Promise<CustomEmoji[]> {
    const instanceUrl = new URL(session.instanceUrl).hostname;
    const cached = emojiCache.get(instanceUrl);

    // Return cached emojis if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.emojis;
    }

    // Fetch fresh emojis
    const client = getClient(session);
    const emojis = await client.v1.customEmojis.list();

    const transformed: CustomEmoji[] = emojis.map((emoji) => ({
        shortcode: emoji.shortcode,
        url: emoji.url,
        staticUrl: emoji.staticUrl,
        visibleInPicker: emoji.visibleInPicker,
        category: emoji.category ?? null,
    }));

    // Update cache
    emojiCache.set(instanceUrl, {
        emojis: transformed,
        timestamp: Date.now(),
    });

    return transformed;
}

/**
 * Clear emoji cache for a specific instance
 */
export function clearEmojiCache(instanceUrl: string): void {
    const hostname = new URL(instanceUrl).hostname;
    emojiCache.delete(hostname);
}

/**
 * Clear all emoji cache
 */
export function clearAllEmojiCache(): void {
    emojiCache.clear();
}
