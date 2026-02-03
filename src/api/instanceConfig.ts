import type { MastoClient } from './mastoClient';

/**
 * Instance configuration limits
 */
export interface InstanceConfig {
    maxCharacters: number;
    maxMediaAttachments: number;
    supportedMimeTypes: string[];
}

/**
 * Cache entry with expiration time
 */
interface CacheEntry {
    config: InstanceConfig;
    expiresAt: number;
}

// In-memory cache using instance URL as key
const configCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Default fallback configuration
 */
const DEFAULT_CONFIG: InstanceConfig = {
    maxCharacters: 500,
    maxMediaAttachments: 4,
    supportedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
    ],
};

/**
 * Fetch instance configuration from Mastodon API
 * Uses in-memory cache with 1-hour TTL
 * @throws {TypeError} If instanceUrl is not a valid URL string
 */
export async function getInstanceConfig(
    client: MastoClient,
    instanceUrl: string
): Promise<InstanceConfig> {
    // Normalize instance URL for consistent cache keys (matches emojiCache pattern)
    let instanceKey: string;
    try {
        instanceKey = new URL(instanceUrl).origin;
    } catch (e) {
        if (e instanceof TypeError) {
            console.warn(`Invalid instance URL: ${instanceUrl}, using default config`);
            return getDefaultConfig();
        }
        throw e;
    }

    // Check cache first
    const cached = configCache.get(instanceKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.config;
    }

    // Fetch from API
    const instance = await client.v1.instance.fetch();

    // Extract configuration values with defensive fallbacks
    const apiMimeTypes = instance.configuration?.mediaAttachments?.supportedMimeTypes;
    const config: InstanceConfig = {
        maxCharacters:
            instance.configuration?.statuses?.maxCharacters ?? DEFAULT_CONFIG.maxCharacters,
        maxMediaAttachments:
            instance.configuration?.statuses?.maxMediaAttachments ??
            DEFAULT_CONFIG.maxMediaAttachments,
        // Create a copy to prevent mutations to the cached value
        supportedMimeTypes: apiMimeTypes ? [...apiMimeTypes] : DEFAULT_CONFIG.supportedMimeTypes,
    };

    // Cache the result
    configCache.set(instanceKey, {
        config,
        expiresAt: Date.now() + CACHE_TTL,
    });

    return config;
}

/**
 * Clear cached instance configuration
 * @param instanceUrl - If provided, only clear cache for this instance. Otherwise clear all.
 */
export function clearInstanceConfigCache(instanceUrl?: string): void {
    if (instanceUrl) {
        try {
            const instanceKey = new URL(instanceUrl).origin;
            configCache.delete(instanceKey);
        } catch {
            // If URL is invalid, silently ignore - no cache entry would exist for it
            console.debug(
                `Invalid instance URL provided to clearInstanceConfigCache: ${instanceUrl}`
            );
        }
    } else {
        configCache.clear();
    }
}

/**
 * Get default configuration for fallback
 * Returns a deep copy to prevent shared array references
 */
export function getDefaultConfig(): InstanceConfig {
    return {
        ...DEFAULT_CONFIG,
        supportedMimeTypes: [...DEFAULT_CONFIG.supportedMimeTypes],
    };
}
