import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useEditPrefill } from './useEditPrefill';
import * as mastoClient from '../api/mastoClient';

// Mock dependencies
vi.mock('../api/mastoClient', () => ({
    getClient: vi.fn(() => ({})),
    getStatusSource: vi.fn(),
}));

describe('useEditPrefill', () => {
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
    };

    const mockEditTarget = {
        status: {
            id: 'status-123',
            visibility: 'public',
            sensitive: false,
            mediaAttachments: [
                {
                    id: 'media-1',
                    type: 'image' as const,
                    url: 'https://example.com/media1.png',
                    previewUrl: 'https://example.com/media1-small.png',
                    description: 'Alt text for media',
                },
            ],
        },
        accountSessionId: 'test-account-id',
    };

    const mockStatusSource = {
        id: 'status-123',
        text: 'Original post content',
        spoilerText: '',
    };

    const mockOnPrefill = vi.fn();
    const mockOnError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(mastoClient.getStatusSource).mockResolvedValue(mockStatusSource);
    });

    describe('when modal is closed', () => {
        it('should not fetch and return not loading', () => {
            const { result } = renderHook(() =>
                useEditPrefill({
                    editTarget: mockEditTarget as any,
                    accountSession: mockAccountSession as any,
                    isOpen: false,
                    onPrefill: mockOnPrefill,
                    onError: mockOnError,
                })
            );

            expect(result.current.isLoading).toBe(false);
            expect(mastoClient.getStatusSource).not.toHaveBeenCalled();
        });
    });

    describe('when no editTarget', () => {
        it('should not fetch and return not loading', () => {
            const { result } = renderHook(() =>
                useEditPrefill({
                    editTarget: undefined,
                    accountSession: mockAccountSession as any,
                    isOpen: true,
                    onPrefill: mockOnPrefill,
                    onError: mockOnError,
                })
            );

            expect(result.current.isLoading).toBe(false);
            expect(mastoClient.getStatusSource).not.toHaveBeenCalled();
        });
    });

    describe('when no accountSession', () => {
        it('should not fetch and return not loading', () => {
            const { result } = renderHook(() =>
                useEditPrefill({
                    editTarget: mockEditTarget as any,
                    accountSession: null,
                    isOpen: true,
                    onPrefill: mockOnPrefill,
                    onError: mockOnError,
                })
            );

            expect(result.current.isLoading).toBe(false);
            expect(mastoClient.getStatusSource).not.toHaveBeenCalled();
        });
    });

    describe('when modal opens with edit target', () => {
        it('should fetch status source and call onPrefill', async () => {
            const { result } = renderHook(() =>
                useEditPrefill({
                    editTarget: mockEditTarget as any,
                    accountSession: mockAccountSession as any,
                    isOpen: true,
                    onPrefill: mockOnPrefill,
                    onError: mockOnError,
                })
            );

            // Initially loading
            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mastoClient.getStatusSource).toHaveBeenCalledWith(
                expect.anything(),
                'status-123'
            );

            expect(mockOnPrefill).toHaveBeenCalledWith({
                text: 'Original post content',
                spoilerText: '',
                visibility: 'public',
                sensitive: false,
                mediaFiles: [
                    {
                        localId: 'media-media-1',
                        preview: 'https://example.com/media1.png',
                        uploading: false,
                        uploadedId: 'media-1',
                        altText: 'Alt text for media',
                        isExisting: true,
                        kind: 'image',
                    },
                ],
            });
        });

        it('should call onError on fetch failure', async () => {
            vi.mocked(mastoClient.getStatusSource).mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() =>
                useEditPrefill({
                    editTarget: mockEditTarget as any,
                    accountSession: mockAccountSession as any,
                    isOpen: true,
                    onPrefill: mockOnPrefill,
                    onError: mockOnError,
                })
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockOnError).toHaveBeenCalledWith('編集用データの取得に失敗しました');
            expect(mockOnPrefill).not.toHaveBeenCalled();
        });

        it('should handle status with CW', async () => {
            vi.mocked(mastoClient.getStatusSource).mockResolvedValue({
                id: 'status-123',
                text: 'Content behind CW',
                spoilerText: 'CW text here',
            });

            const { result } = renderHook(() =>
                useEditPrefill({
                    editTarget: {
                        ...mockEditTarget,
                        status: {
                            ...mockEditTarget.status,
                            sensitive: true,
                        },
                    } as any,
                    accountSession: mockAccountSession as any,
                    isOpen: true,
                    onPrefill: mockOnPrefill,
                    onError: mockOnError,
                })
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockOnPrefill).toHaveBeenCalledWith(
                expect.objectContaining({
                    text: 'Content behind CW',
                    spoilerText: 'CW text here',
                    sensitive: true,
                })
            );
        });

        it('should handle status without media', async () => {
            const { result } = renderHook(() =>
                useEditPrefill({
                    editTarget: {
                        ...mockEditTarget,
                        status: {
                            ...mockEditTarget.status,
                            mediaAttachments: [],
                        },
                    } as any,
                    accountSession: mockAccountSession as any,
                    isOpen: true,
                    onPrefill: mockOnPrefill,
                    onError: mockOnError,
                })
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockOnPrefill).toHaveBeenCalledWith(
                expect.objectContaining({
                    mediaFiles: [],
                })
            );
        });
    });

    describe('race condition handling', () => {
        it('should ignore stale response when edit target changes', async () => {
            let resolveFirst: (value: typeof mockStatusSource) => void;
            const firstPromise = new Promise<typeof mockStatusSource>((resolve) => {
                resolveFirst = resolve;
            });

            vi.mocked(mastoClient.getStatusSource)
                .mockReturnValueOnce(firstPromise)
                .mockResolvedValueOnce({
                    id: 'status-456',
                    text: 'Second status',
                    spoilerText: '',
                });

            const { result, rerender } = renderHook(
                ({ editTarget }) =>
                    useEditPrefill({
                        editTarget,
                        accountSession: mockAccountSession as any,
                        isOpen: true,
                        onPrefill: mockOnPrefill,
                        onError: mockOnError,
                    }),
                {
                    initialProps: { editTarget: mockEditTarget as any },
                }
            );

            // Change edit target before first request resolves
            const newEditTarget = {
                status: { ...mockEditTarget.status, id: 'status-456' },
                accountSessionId: 'test-account-id',
            };

            rerender({ editTarget: newEditTarget as any });

            // Resolve the first (stale) request
            await act(async () => {
                resolveFirst!(mockStatusSource);
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Should only have called onPrefill once with the second status
            expect(mockOnPrefill).toHaveBeenCalledTimes(1);
            expect(mockOnPrefill).toHaveBeenCalledWith(
                expect.objectContaining({
                    text: 'Second status',
                })
            );
        });

        it('should ignore stale error response', async () => {
            let resolveFirst: (value: typeof mockStatusSource) => void;
            const firstPromise = new Promise<typeof mockStatusSource>((resolve) => {
                resolveFirst = resolve;
            });

            vi.mocked(mastoClient.getStatusSource)
                .mockReturnValueOnce(firstPromise)
                .mockRejectedValueOnce(new Error('Second error'));

            const { rerender } = renderHook(
                ({ editTarget }) =>
                    useEditPrefill({
                        editTarget,
                        accountSession: mockAccountSession as any,
                        isOpen: true,
                        onPrefill: mockOnPrefill,
                        onError: mockOnError,
                    }),
                {
                    initialProps: { editTarget: mockEditTarget as any },
                }
            );

            // Change edit target
            const newEditTarget = {
                status: { ...mockEditTarget.status, id: 'status-456' },
                accountSessionId: 'test-account-id',
            };

            rerender({ editTarget: newEditTarget as any });

            // Resolve the first request after target changed
            await act(async () => {
                resolveFirst!(mockStatusSource);
            });

            await waitFor(() => {
                expect(mockOnError).toHaveBeenCalled();
            });

            // Should only have called onError once for the second request
            expect(mockOnError).toHaveBeenCalledTimes(1);
        });
    });

    describe('cleanup', () => {
        it('should invalidate pending requests on unmount', async () => {
            let resolveRequest: (value: typeof mockStatusSource) => void;
            const pendingPromise = new Promise<typeof mockStatusSource>((resolve) => {
                resolveRequest = resolve;
            });

            vi.mocked(mastoClient.getStatusSource).mockReturnValue(pendingPromise);

            const { unmount } = renderHook(() =>
                useEditPrefill({
                    editTarget: mockEditTarget as any,
                    accountSession: mockAccountSession as any,
                    isOpen: true,
                    onPrefill: mockOnPrefill,
                    onError: mockOnError,
                })
            );

            // Unmount before request resolves
            unmount();

            // Resolve the request after unmount
            await act(async () => {
                resolveRequest!(mockStatusSource);
            });

            // onPrefill should not be called after unmount
            expect(mockOnPrefill).not.toHaveBeenCalled();
        });
    });
});
