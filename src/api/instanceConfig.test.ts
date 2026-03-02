import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getInstanceConfig,
    clearInstanceConfigCache,
    getDefaultConfig,
    supportsQuotes,
} from './instanceConfig';
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
                supportsQuotes: false, // No version in mock, defaults to false
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

        it('should not pollute cache when returned config is mutated', async () => {
            const mockClient = createMockClient({
                maxCharacters: 5000,
                maxMediaAttachments: 5,
                supportedMimeTypes: ['image/jpeg', 'image/png'],
            });

            // First call - get config and mutate it
            const config1 = await getInstanceConfig(mockClient, 'https://example.com');
            config1.maxCharacters = 9999;
            config1.supportedMimeTypes.push('image/mutated');

            // Second call - should return original cached values, not mutated ones
            const config2 = await getInstanceConfig(mockClient, 'https://example.com');

            expect(config2.maxCharacters).toBe(5000);
            expect(config2.supportedMimeTypes).toEqual(['image/jpeg', 'image/png']);
            expect(config2.supportedMimeTypes).not.toContain('image/mutated');
        });

        it('should return new object on each call even when cached', async () => {
            const mockClient = createMockClient({
                maxCharacters: 5000,
                maxMediaAttachments: 5,
                supportedMimeTypes: ['image/jpeg', 'image/png'],
            });

            const config1 = await getInstanceConfig(mockClient, 'https://example.com');
            const config2 = await getInstanceConfig(mockClient, 'https://example.com');

            // Should be different object references
            expect(config1).not.toBe(config2);
            // But have the same values
            expect(config1).toEqual(config2);
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

        describe('URL normalization', () => {
            it('should normalize URLs with trailing slashes', async () => {
                const mockClient = createMockClient({
                    maxCharacters: 5000,
                    maxMediaAttachments: 5,
                    supportedMimeTypes: ['image/jpeg'],
                });

                // Same instance with different URL formats
                await getInstanceConfig(mockClient, 'https://example.com/');
                await getInstanceConfig(mockClient, 'https://example.com');

                // Should only fetch once due to normalization
                expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(1);
            });

            it('should normalize URLs with paths', async () => {
                const mockClient = createMockClient({
                    maxCharacters: 5000,
                    maxMediaAttachments: 5,
                    supportedMimeTypes: ['image/jpeg'],
                });

                // Same instance with URL paths
                await getInstanceConfig(mockClient, 'https://example.com/path');
                await getInstanceConfig(mockClient, 'https://example.com/other');

                // Should only fetch once due to origin normalization
                expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(1);
            });

            it('should treat different URL formats as same instance', async () => {
                const mockClient = createMockClient({
                    maxCharacters: 5000,
                    maxMediaAttachments: 5,
                    supportedMimeTypes: ['image/jpeg'],
                });

                // Various formats of the same instance
                await getInstanceConfig(mockClient, 'https://example.com');
                await getInstanceConfig(mockClient, 'https://example.com/');
                await getInstanceConfig(mockClient, 'https://example.com/api');

                // Should only fetch once
                expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(1);
            });
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
                supportsQuotes: false,
                supportedMimeTypes: [
                    'image/jpeg',
                    'image/png',
                    'image/gif',
                    'image/webp',
                    'video/mp4',
                    'video/webm',
                    'audio/mpeg',
                    'audio/mp3',
                    'audio/mp4',
                    'audio/x-m4a',
                    'audio/m4a',
                    'audio/ogg',
                    'audio/vorbis',
                    'audio/wav',
                    'audio/wave',
                    'audio/x-wav',
                    'audio/x-pn-wave',
                    'audio/vnd.wave',
                    'audio/flac',
                    'audio/aac',
                    'audio/webm',
                    'audio/3gpp',
                    'audio/opus',
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
                'audio/mpeg',
                'audio/mp3',
                'audio/mp4',
                'audio/x-m4a',
                'audio/m4a',
                'audio/ogg',
                'audio/vorbis',
                'audio/wav',
                'audio/wave',
                'audio/x-wav',
                'audio/x-pn-wave',
                'audio/vnd.wave',
                'audio/flac',
                'audio/aac',
                'audio/webm',
                'audio/3gpp',
                'audio/opus',
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
                'audio/mpeg',
                'audio/mp3',
                'audio/mp4',
                'audio/x-m4a',
                'audio/m4a',
                'audio/ogg',
                'audio/vorbis',
                'audio/wav',
                'audio/wave',
                'audio/x-wav',
                'audio/x-pn-wave',
                'audio/vnd.wave',
                'audio/flac',
                'audio/aac',
                'audio/webm',
                'audio/3gpp',
                'audio/opus',
            ]); // default
        });

        describe('error handling', () => {
            it('should propagate network errors to caller', async () => {
                const networkError = new Error('Network request failed');
                const errorClient = {
                    v1: {
                        instance: {
                            fetch: vi.fn().mockRejectedValue(networkError),
                        },
                    },
                } as unknown as MastoClient;

                await expect(getInstanceConfig(errorClient, 'https://example.com')).rejects.toThrow(
                    'Network request failed'
                );
            });

            it('should propagate HTTP errors from API', async () => {
                const httpError = new Error('Request failed with status code 503');
                const errorClient = {
                    v1: {
                        instance: {
                            fetch: vi.fn().mockRejectedValue(httpError),
                        },
                    },
                } as unknown as MastoClient;

                await expect(getInstanceConfig(errorClient, 'https://example.com')).rejects.toThrow(
                    'Request failed with status code 503'
                );
            });

            it('should not cache failed requests', async () => {
                const networkError = new Error('Network error');
                const errorClient = {
                    v1: {
                        instance: {
                            fetch: vi
                                .fn()
                                .mockRejectedValueOnce(networkError)
                                .mockResolvedValueOnce({
                                    configuration: {
                                        statuses: {
                                            maxCharacters: 5000,
                                            maxMediaAttachments: 5,
                                        },
                                        mediaAttachments: {
                                            supportedMimeTypes: ['image/jpeg'],
                                        },
                                    },
                                }),
                        },
                    },
                } as unknown as MastoClient;

                // First call fails
                await expect(getInstanceConfig(errorClient, 'https://example.com')).rejects.toThrow(
                    'Network error'
                );

                // Second call should try fetching again (not use cache)
                const config = await getInstanceConfig(errorClient, 'https://example.com');
                expect(config.maxCharacters).toBe(5000);

                // Verify fetch was called twice (once for failed, once for success)
                expect(errorClient.v1.instance.fetch).toHaveBeenCalledTimes(2);
            });

            it('should preserve original error type and message', async () => {
                class CustomApiError extends Error {
                    statusCode: number;
                    constructor(message: string, statusCode: number) {
                        super(message);
                        this.name = 'CustomApiError';
                        this.statusCode = statusCode;
                    }
                }

                const customError = new CustomApiError('Service unavailable', 503);
                const errorClient = {
                    v1: {
                        instance: {
                            fetch: vi.fn().mockRejectedValue(customError),
                        },
                    },
                } as unknown as MastoClient;

                const caughtError = await getInstanceConfig(
                    errorClient,
                    'https://example.com'
                ).catch((e) => e);

                expect(caughtError).toBeInstanceOf(CustomApiError);
                expect(caughtError.message).toBe('Service unavailable');
                expect(caughtError.statusCode).toBe(503);
            });

            it('should return default config for invalid URL', async () => {
                const mockClient = createMockClient({
                    maxCharacters: 5000,
                    maxMediaAttachments: 5,
                    supportedMimeTypes: ['image/jpeg'],
                });

                // Invalid URL should return default config without calling API
                const config = await getInstanceConfig(mockClient, 'not-a-valid-url');

                expect(config.maxCharacters).toBe(500);
                expect(config.maxMediaAttachments).toBe(4);
                expect(config.supportedMimeTypes).toEqual([
                    'image/jpeg',
                    'image/png',
                    'image/gif',
                    'image/webp',
                    'video/mp4',
                    'video/webm',
                    'audio/mpeg',
                    'audio/mp3',
                    'audio/mp4',
                    'audio/x-m4a',
                    'audio/m4a',
                    'audio/ogg',
                    'audio/vorbis',
                    'audio/wav',
                    'audio/wave',
                    'audio/x-wav',
                    'audio/x-pn-wave',
                    'audio/vnd.wave',
                    'audio/flac',
                    'audio/aac',
                    'audio/webm',
                    'audio/3gpp',
                    'audio/opus',
                ]);
                // API should not be called for invalid URLs
                expect(mockClient.v1.instance.fetch).not.toHaveBeenCalled();
            });
        });

        describe('in-flight request deduplication', () => {
            it('should dedupe concurrent requests to the same instance', async () => {
                let resolveFetch: (value: unknown) => void;
                const fetchPromise = new Promise((resolve) => {
                    resolveFetch = resolve;
                });

                const mockClient = {
                    v1: {
                        instance: {
                            fetch: vi.fn().mockReturnValue(fetchPromise),
                        },
                    },
                } as unknown as MastoClient;

                // Start multiple concurrent requests before the first one resolves
                const request1 = getInstanceConfig(mockClient, 'https://example.com');
                const request2 = getInstanceConfig(mockClient, 'https://example.com');
                const request3 = getInstanceConfig(mockClient, 'https://example.com');

                // Resolve the fetch promise
                resolveFetch!({
                    configuration: {
                        statuses: {
                            maxCharacters: 5000,
                            maxMediaAttachments: 5,
                        },
                        mediaAttachments: {
                            supportedMimeTypes: ['image/jpeg'],
                        },
                    },
                });

                // Wait for all requests to complete
                const [result1, result2, result3] = await Promise.all([
                    request1,
                    request2,
                    request3,
                ]);

                // All requests should return the same config
                expect(result1.maxCharacters).toBe(5000);
                expect(result2.maxCharacters).toBe(5000);
                expect(result3.maxCharacters).toBe(5000);

                // The API should only be called once despite 3 concurrent requests
                expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(1);
            });

            it('should not dedupe requests to different instances', async () => {
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

                // Concurrent requests to different instances
                await Promise.all([
                    getInstanceConfig(mockClient1, 'https://example.com'),
                    getInstanceConfig(mockClient2, 'https://other.com'),
                ]);

                // Each instance should have its own fetch call
                expect(mockClient1.v1.instance.fetch).toHaveBeenCalledTimes(1);
                expect(mockClient2.v1.instance.fetch).toHaveBeenCalledTimes(1);
            });

            it('should clear in-flight request after completion', async () => {
                const mockClient = createMockClient({
                    maxCharacters: 5000,
                    maxMediaAttachments: 5,
                    supportedMimeTypes: ['image/jpeg'],
                });

                // First request
                await getInstanceConfig(mockClient, 'https://example.com');
                expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(1);

                // Clear cache but not in-flight (simulates cache expiry)
                clearInstanceConfigCache('https://example.com');

                // Second request should use cache if in-flight was cleared
                // But since cache was cleared, it should fetch again
                await getInstanceConfig(mockClient, 'https://example.com');
                expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(2);
            });
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

        it('should clear cache for specific instance with normalized URL', async () => {
            const mockClient = createMockClient({
                maxCharacters: 5000,
                maxMediaAttachments: 5,
                supportedMimeTypes: ['image/jpeg'],
            });

            // Cache config with one URL format
            await getInstanceConfig(mockClient, 'https://example.com/');

            // Clear cache with different URL format (same origin)
            clearInstanceConfigCache('https://example.com');

            // Should fetch again due to cache clear
            await getInstanceConfig(mockClient, 'https://example.com');

            // Should have fetched twice (original + after clear)
            expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(2);
        });

        it('should handle invalid URL gracefully when clearing cache', async () => {
            const mockClient = createMockClient({
                maxCharacters: 5000,
                maxMediaAttachments: 5,
                supportedMimeTypes: ['image/jpeg'],
            });

            await getInstanceConfig(mockClient, 'https://example.com');

            // Should not throw when clearing with invalid URL
            expect(() => clearInstanceConfigCache('not-a-valid-url')).not.toThrow();

            // Original cache should still be intact
            await getInstanceConfig(mockClient, 'https://example.com');
            expect(mockClient.v1.instance.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('getDefaultConfig', () => {
        it('should return default configuration', () => {
            const defaultConfig = getDefaultConfig();

            expect(defaultConfig).toEqual({
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
                    'audio/mpeg',
                    'audio/mp3',
                    'audio/mp4',
                    'audio/x-m4a',
                    'audio/m4a',
                    'audio/ogg',
                    'audio/vorbis',
                    'audio/wav',
                    'audio/wave',
                    'audio/x-wav',
                    'audio/x-pn-wave',
                    'audio/vnd.wave',
                    'audio/flac',
                    'audio/aac',
                    'audio/webm',
                    'audio/3gpp',
                    'audio/opus',
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

    describe('supportsQuotes', () => {
        describe('supported versions', () => {
            it('should return true for "4.5.0"', () => {
                expect(supportsQuotes('4.5.0')).toBe(true);
            });

            it('should return true for "4.5.1"', () => {
                expect(supportsQuotes('4.5.1')).toBe(true);
            });

            it('should return true for "4.6.0"', () => {
                expect(supportsQuotes('4.6.0')).toBe(true);
            });

            it('should return true for "5.0.0"', () => {
                expect(supportsQuotes('5.0.0')).toBe(true);
            });
        });

        describe('unsupported versions', () => {
            it('should return false for "4.4.9"', () => {
                expect(supportsQuotes('4.4.9')).toBe(false);
            });

            it('should return false for "4.4.0"', () => {
                expect(supportsQuotes('4.4.0')).toBe(false);
            });

            it('should return false for "3.5.0"', () => {
                expect(supportsQuotes('3.5.0')).toBe(false);
            });
        });

        describe('special formats', () => {
            it('should return true for "4.5.0+glitch" (Glitch edition)', () => {
                expect(supportsQuotes('4.5.0+glitch')).toBe(true);
            });

            it('should return true for "4.5.0rc1" (release candidate)', () => {
                expect(supportsQuotes('4.5.0rc1')).toBe(true);
            });

            it('should return true for "4.6.0+glitch"', () => {
                expect(supportsQuotes('4.6.0+glitch')).toBe(true);
            });

            it('should return false for "4.4.9+glitch"', () => {
                expect(supportsQuotes('4.4.9+glitch')).toBe(false);
            });
        });

        describe('edge cases', () => {
            it('should return false for empty string', () => {
                expect(supportsQuotes('')).toBe(false);
            });

            it('should return false for invalid format "abc"', () => {
                expect(supportsQuotes('abc')).toBe(false);
            });

            it('should return false for invalid format "version4.5.0"', () => {
                expect(supportsQuotes('version4.5.0')).toBe(false);
            });

            it('should return false for partial version "4"', () => {
                expect(supportsQuotes('4')).toBe(false);
            });

            it('should return false for "4."', () => {
                expect(supportsQuotes('4.')).toBe(false);
            });
        });
    });
});
