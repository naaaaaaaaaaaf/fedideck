import type { MastoClient } from './mastoClient';

/**
 * Instance configuration limits
 */
export interface InstanceConfig {
    maxCharacters: number;
    maxMediaAttachments: number;
    supportedMimeTypes: string[];
    supportsQuotes: boolean;
}

/**
 * Cache entry with expiration time
 */
interface CacheEntry {
    config: InstanceConfig;
    expiresAt: number;
}

/**
 * Check if Mastodon version supports quote posts (v4.5.0+)
 */
export function supportsQuotes(version: string): boolean {
    // Mastodon version strings can be:
    // - "4.5.0" (standard)
    // - "4.5.0+glitch" (Glitch edition)
    // - "4.5.0rc1" (release candidate)
    // We only care about the major.minor.patch part
    const match = version.match(/^(\d+)\.(\d+)/);
    if (!match) return false;

    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);

    // Mastodon 4.5.0+ supports quotes
    return major > 4 || (major === 4 && minor >= 5);
}

// In-memory cache using instance URL as key
const configCache = new Map<string, CacheEntry>();
// In-flight requests to dedupe concurrent requests
const inflightRequests = new Map<string, Promise<InstanceConfig>>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Default fallback configuration
 */
const DEFAULT_CONFIG: InstanceConfig = {
    maxCharacters: 500,
    maxMediaAttachments: 4,
    supportsQuotes: false,
    supportedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        // Audio MIME types - matching Mastodon's supported formats
        'audio/mpeg', // .mp3
        'audio/mp3', // .mp3 (alternative)
        'audio/mp4', // .m4a
        'audio/x-m4a', // .m4a (alternative)
        'audio/m4a', // .m4a (alternative)
        'audio/ogg', // .ogg, .opus
        'audio/vorbis', // .ogg (alternative)
        'audio/wav', // .wav
        'audio/wave', // .wav (alternative)
        'audio/x-wav', // .wav (alternative)
        'audio/x-pn-wave', // .wav (RealPlayer/legacy)
        'audio/vnd.wave', // .wav (alternative)
        'audio/flac', // .flac
        'audio/aac', // .aac
        'audio/webm', // .weba (audio in WebM)
        'audio/3gpp', // .3gp (mobile audio)
        'audio/opus', // .opus in Ogg container
    ],
};

/**
 * Fetch instance configuration from Mastodon API
 * Uses in-memory cache with 1-hour TTL
 *
 * @param client - Mastodon API client
 * @param instanceUrl - Instance URL to fetch configuration from
 * @returns Instance configuration with limits and supported MIME types
 *
 * @remarks
 * - Invalid URLs are handled gracefully - default config is returned with a console warning
 * - Returns cached value if available and not expired (1 hour TTL)
 * - Network errors from the API call will propagate to the caller
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
        // Return a copy to prevent cache pollution through mutation
        return {
            ...cached.config,
            supportedMimeTypes: [...cached.config.supportedMimeTypes],
        };
    }

    // Check for in-flight request to dedupe concurrent calls
    const inflight = inflightRequests.get(instanceKey);
    if (inflight) {
        // Wait for the existing request and return a copy of its result
        const config = await inflight;
        return {
            ...config,
            supportedMimeTypes: [...config.supportedMimeTypes],
        };
    }

    // Create the fetch promise
    const fetchPromise = (async (): Promise<InstanceConfig> => {
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
            supportedMimeTypes: apiMimeTypes
                ? [...apiMimeTypes]
                : DEFAULT_CONFIG.supportedMimeTypes,
            supportsQuotes: supportsQuotes(instance.version ?? ''),
        };

        // Cache the result
        configCache.set(instanceKey, {
            config,
            expiresAt: Date.now() + CACHE_TTL,
        });

        return config;
    })();

    // Register in-flight request
    inflightRequests.set(instanceKey, fetchPromise);

    try {
        const config = await fetchPromise;
        // Return a copy to prevent cache pollution through mutation
        return {
            ...config,
            supportedMimeTypes: [...config.supportedMimeTypes],
        };
    } finally {
        // Clean up in-flight request
        inflightRequests.delete(instanceKey);
    }
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
