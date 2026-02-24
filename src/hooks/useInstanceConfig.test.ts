/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useInstanceConfig } from './useInstanceConfig';
import * as instanceConfigApi from '../api/instanceConfig';

// Mock dependencies
vi.mock('../api/mastoClient', () => ({
    getClient: vi.fn(),
}));

vi.mock('../api/instanceConfig', () => ({
    getInstanceConfig: vi.fn(),
    getDefaultConfig: vi.fn(),
}));

describe('useInstanceConfig', () => {
    const mockAccountSession = {
        id: 'test-account-id',
        instanceUrl: 'https://example.com',
        accessToken: 'test-token',
        account: {
            id: '123',
            username: 'testuser',
            displayName: 'Test User',
            url: 'https://example.com/@testuser',
            avatar: 'https://example.com/avatar.png',
        },
    } as any;

    const mockInstanceConfig = {
        maxCharacters: 500,
        maxMediaAttachments: 4,
        supportedMimeTypes: ['image/jpeg', 'image/png', 'video/mp4'],
    };

    const defaultConfig = {
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

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(instanceConfigApi.getDefaultConfig).mockReturnValue(defaultConfig);
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('when modal is closed', () => {
        it('should return null config and not loading', () => {
            const { result } = renderHook(() =>
                useInstanceConfig({
                    accountSession: mockAccountSession,
                    isOpen: false,
                })
            );

            expect(result.current.instanceConfig).toBeNull();
            expect(result.current.isLoading).toBe(false);
        });

        it('should not fetch instance config', () => {
            renderHook(() =>
                useInstanceConfig({
                    accountSession: mockAccountSession,
                    isOpen: false,
                })
            );

            expect(instanceConfigApi.getInstanceConfig).not.toHaveBeenCalled();
        });
    });

    describe('when accountSession is null', () => {
        it('should return null config and not loading', () => {
            const { result } = renderHook(() =>
                useInstanceConfig({
                    accountSession: null,
                    isOpen: true,
                })
            );

            expect(result.current.instanceConfig).toBeNull();
            expect(result.current.isLoading).toBe(false);
        });
    });

    describe('when modal opens with valid account', () => {
        it('should fetch instance config', async () => {
            vi.mocked(instanceConfigApi.getInstanceConfig).mockResolvedValue(mockInstanceConfig);

            const { result } = renderHook(() =>
                useInstanceConfig({
                    accountSession: mockAccountSession,
                    isOpen: true,
                })
            );

            // Initially loading
            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.instanceConfig).toEqual(mockInstanceConfig);
            expect(instanceConfigApi.getInstanceConfig).toHaveBeenCalledTimes(1);
        });

        it('should use default config on error', async () => {
            vi.mocked(instanceConfigApi.getInstanceConfig).mockRejectedValue(
                new Error('Network error')
            );

            const { result } = renderHook(() =>
                useInstanceConfig({
                    accountSession: mockAccountSession,
                    isOpen: true,
                })
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.instanceConfig).toEqual(defaultConfig);
        });
    });

    describe('race condition handling', () => {
        it('should ignore stale response when account changes', async () => {
            let resolveFirst: (value: typeof mockInstanceConfig) => void;
            const firstPromise = new Promise<typeof mockInstanceConfig>((resolve) => {
                resolveFirst = resolve;
            });

            vi.mocked(instanceConfigApi.getInstanceConfig)
                .mockReturnValueOnce(firstPromise)
                .mockResolvedValueOnce({ ...mockInstanceConfig, maxCharacters: 1000 });

            const { result, rerender } = renderHook(
                ({ accountSession }) =>
                    useInstanceConfig({
                        accountSession,
                        isOpen: true,
                    }),
                {
                    initialProps: { accountSession: mockAccountSession },
                }
            );

            // Wait for loading to start
            expect(result.current.isLoading).toBe(true);

            // Change account before first request resolves
            const newAccountSession = {
                ...mockAccountSession,
                id: 'different-account-id',
                instanceUrl: 'https://different.com',
            };

            rerender({ accountSession: newAccountSession });

            // Resolve the first (stale) request
            await act(async () => {
                resolveFirst!(mockInstanceConfig);
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Should have the second request's config, not the first
            expect(result.current.instanceConfig?.maxCharacters).toBe(1000);
        });

        it('should increment request sequence on account change', async () => {
            vi.mocked(instanceConfigApi.getInstanceConfig).mockResolvedValue(mockInstanceConfig);

            const { rerender } = renderHook(
                ({ accountSession }) =>
                    useInstanceConfig({
                        accountSession,
                        isOpen: true,
                    }),
                {
                    initialProps: { accountSession: mockAccountSession },
                }
            );

            await waitFor(() => {
                expect(instanceConfigApi.getInstanceConfig).toHaveBeenCalledTimes(1);
            });

            // Change account
            const newAccountSession = {
                ...mockAccountSession,
                id: 'different-account-id',
            };

            rerender({ accountSession: newAccountSession });

            await waitFor(() => {
                expect(instanceConfigApi.getInstanceConfig).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('when modal closes', () => {
        it('should reset config to null', async () => {
            vi.mocked(instanceConfigApi.getInstanceConfig).mockResolvedValue(mockInstanceConfig);

            const { result, rerender } = renderHook(
                ({ isOpen }) =>
                    useInstanceConfig({
                        accountSession: mockAccountSession,
                        isOpen,
                    }),
                {
                    initialProps: { isOpen: true },
                }
            );

            await waitFor(() => {
                expect(result.current.instanceConfig).toEqual(mockInstanceConfig);
            });

            // Close modal
            rerender({ isOpen: false });

            expect(result.current.instanceConfig).toBeNull();
            expect(result.current.isLoading).toBe(false);
        });
    });

    describe('cleanup', () => {
        it('should invalidate pending requests on unmount', async () => {
            let resolveRequest: (value: typeof mockInstanceConfig) => void;
            const pendingPromise = new Promise<typeof mockInstanceConfig>((resolve) => {
                resolveRequest = resolve;
            });

            vi.mocked(instanceConfigApi.getInstanceConfig).mockReturnValue(pendingPromise);

            const { unmount } = renderHook(() =>
                useInstanceConfig({
                    accountSession: mockAccountSession,
                    isOpen: true,
                })
            );

            // Unmount before request resolves
            unmount();

            // Resolve the request after unmount
            await act(async () => {
                resolveRequest!(mockInstanceConfig);
            });

            // The promise resolved but state update should be ignored
            // No error should be thrown
        });
    });
});
