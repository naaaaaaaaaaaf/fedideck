import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInstanceConfig, clearInstanceConfigCache, getDefaultConfig } from './instanceConfig';
import type { MastoClient } from './mastoClient';

// Mock masto client
const createMockClient = (config: {
    maxCharacters: number;
    maxMediaAttachments: number;
    supportedMimeTypes: string[];
}): MastoClient => {
    return {
        v1: {
            instance: {
                fetch: vi.fn().mockResolvedValue({
                    configuration: {
                        statuses: {
                            maxCharacters: config.maxCharacters,
                            maxMediaAttachments: config.maxMediaAttachments,
                        },
                        mediaAttachments: {
                            supportedMimeTypes: config.supportedMimeTypes,
                        },
                    },
                }),
            },
        },
    } as unknown as MastoClient;
};

describe('instanceConfig', () => {
    beforeEach(() => {
        // Clear cache before each test
        clearInstanceConfigCache();
        vi.clearAllMocks();
    });

    describe('getInstanceConfig', () => {
        it('should fetch instance configuration from API', async () => {
            const mockClient = createMockClient({
                maxCharacters: 5000,
                maxMediaAttachments: 5,
                supportedMimeTypes: ['image/jpeg', 'image/png'],
            });

            const config = await getInstanceConfig(mockClient, 'https://example.com');

            expect(config).toEqual({
                maxCharacters: 5000,
                maxMediaAttachments: 5,
                supportedMimeTypes: ['image/jpeg', 'image/png'],
            });
            expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(1);
        });

        it('should cache configuration and reuse on second call', async () => {
            const mockClient = createMockClient({
                maxCharacters: 5000,
                maxMediaAttachments: 5,
                supportedMimeTypes: ['image/jpeg', 'image/png'],
            });

            // First call
            await getInstanceConfig(mockClient, 'https://example.com');
            // Second call - should use cache
            await getInstanceConfig(mockClient, 'https://example.com');

            expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(1);
        });

        it('should cache separately for different instances', async () => {
            const mockClient1 = createMockClient({
                maxCharacters: 5000,
                maxMediaAttachments: 5,
                supportedMimeTypes: ['image/jpeg'],
            });
            const mockClient2 = createMockClient({
                maxCharacters: 1000,
                maxMediaAttachments: 3,
                supportedMimeTypes: ['image/png'],
            });

            await getInstanceConfig(mockClient1, 'https://example.com');
            await getInstanceConfig(mockClient2, 'https://other.com');

            expect(mockClient1.v1.instance.fetch).toHaveBeenCalledTimes(1);
            expect(mockClient2.v1.instance.fetch).toHaveBeenCalledTimes(1);
        });

        it('should fetch again after cache expires', async () => {
            // Mock Date to control time
            const now = Date.now();
            vi.spyOn(Date, 'now').mockReturnValue(now);

            const mockClient = createMockClient({
                maxCharacters: 5000,
                maxMediaAttachments: 5,
                supportedMimeTypes: ['image/jpeg'],
            });

            // First call
            await getInstanceConfig(mockClient, 'https://example.com');

            // Advance time past cache TTL (1 hour + 1 ms)
            vi.spyOn(Date, 'now').mockReturnValue(now + 60 * 60 * 1000 + 1);

            // Second call - should fetch again
            await getInstanceConfig(mockClient, 'https://example.com');

            expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(2);
        });

        it('should use default values when configuration is missing', async () => {
            const malformedClient = {
                v1: {
                    instance: {
                        fetch: vi.fn().mockResolvedValue({
                            configuration: undefined,
                        }),
                    },
                },
            } as unknown as MastoClient;

            const config = await getInstanceConfig(malformedClient, 'https://example.com');

            // Should fall back to defaults
            expect(config).toEqual({
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
            });
        });

        it('should use default values when nested properties are missing', async () => {
            const malformedClient = {
                v1: {
                    instance: {
                        fetch: vi.fn().mockResolvedValue({
                            configuration: {
                                statuses: undefined,
                                mediaAttachments: undefined,
                            },
                        }),
                    },
                },
            } as unknown as MastoClient;

            const config = await getInstanceConfig(malformedClient, 'https://example.com');

            // Should fall back to defaults
            expect(config.maxCharacters).toBe(500);
            expect(config.maxMediaAttachments).toBe(4);
            expect(config.supportedMimeTypes).toEqual([
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'video/mp4',
                'video/webm',
            ]);
        });

        it('should use default values when individual properties are missing', async () => {
            const partialClient = {
                v1: {
                    instance: {
                        fetch: vi.fn().mockResolvedValue({
                            configuration: {
                                statuses: {
                                    maxCharacters: 1000,
                                    // maxMediaAttachments missing
                                },
                                mediaAttachments: {
                                    // supportedMimeTypes missing
                                },
                            },
                        }),
                    },
                },
            } as unknown as MastoClient;

            const config = await getInstanceConfig(partialClient, 'https://example.com');

            // Should mix API values with defaults
            expect(config.maxCharacters).toBe(1000);
            expect(config.maxMediaAttachments).toBe(4); // default
            expect(config.supportedMimeTypes).toEqual([
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'video/mp4',
                'video/webm',
            ]); // default
        });
    });

    describe('clearInstanceConfigCache', () => {
        it('should clear all cache when called without arguments', async () => {
            const mockClient = createMockClient({
                maxCharacters: 5000,
                maxMediaAttachments: 5,
                supportedMimeTypes: ['image/jpeg'],
            });

            await getInstanceConfig(mockClient, 'https://example.com');
            clearInstanceConfigCache();

            // Should fetch again after cache clear
            await getInstanceConfig(mockClient, 'https://example.com');

            expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(2);
        });

        it('should clear cache for specific instance', async () => {
            const mockClient = createMockClient({
                maxCharacters: 5000,
                maxMediaAttachments: 5,
                supportedMimeTypes: ['image/jpeg'],
            });

            await getInstanceConfig(mockClient, 'https://example.com');
            await getInstanceConfig(mockClient, 'https://other.com');

            clearInstanceConfigCache('https://example.com');

            // Should fetch again for cleared instance
            await getInstanceConfig(mockClient, 'https://example.com');
            // Should use cache for other instance
            await getInstanceConfig(mockClient, 'https://other.com');

            // First instance fetched twice (initial + after clear)
            // Second instance fetched once (cached)
            expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(3);
        });
    });

    describe('getDefaultConfig', () => {
        it('should return default configuration', () => {
            const defaultConfig = getDefaultConfig();

            expect(defaultConfig).toEqual({
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
            });
        });

        it('should return a new object each time', () => {
            const config1 = getDefaultConfig();
            const config2 = getDefaultConfig();

            expect(config1).not.toBe(config2);
            expect(config1).toEqual(config2);
        });
    });
});
