import type { mastodon } from 'masto';
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
 */
export async function getInstanceConfig(
    client: MastoClient,
    instanceUrl: string
): Promise<InstanceConfig> {
    // Check cache first
    const cached = configCache.get(instanceUrl);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.config;
    }

    // Fetch from API
    const instance = await client.v1.instance.fetch();

    // Extract configuration values
    const config: InstanceConfig = {
        maxCharacters: instance.configuration.statuses.maxCharacters,
        maxMediaAttachments: instance.configuration.statuses.maxMediaAttachments,
        supportedMimeTypes: instance.configuration.mediaAttachments.supportedMimeTypes,
    };

    // Cache the result
    configCache.set(instanceUrl, {
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
        configCache.delete(instanceUrl);
    } else {
        configCache.clear();
    }
}

/**
 * Get default configuration for fallback
 */
export function getDefaultConfig(): InstanceConfig {
    return { ...DEFAULT_CONFIG };
}
