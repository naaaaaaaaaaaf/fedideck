import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStatusActions } from './useStatusActions';
import type { mastodon } from 'masto';
import * as mastoClient from '../api/mastoClient';

// Mock the mastoClient module
vi.mock('../api/mastoClient', () => ({
    getClient: vi.fn(),
    favouriteStatus: vi.fn(),
    unfavouriteStatus: vi.fn(),
    reblogStatus: vi.fn(),
    unreblogStatus: vi.fn(),
    bookmarkStatus: vi.fn(),
    unbookmarkStatus: vi.fn(),
}));

const mockAccountSession = {
    id: 'test-session-id',
    instanceUrl: 'https://example.com',
    accessToken: 'test-token',
    account: {
        id: 'account-id',
        username: 'testuser',
        acct: 'testuser@example.com',
        displayName: 'Test User',
        url: 'https://example.com/@testuser',
        avatar: 'https://example.com/avatar.png',
    } as mastodon.v1.Account,
};

const createMockStatus = (overrides: Partial<mastodon.v1.Status> = {}): mastodon.v1.Status =>
    ({
        id: 'status-1',
        uri: 'https://example.com/status/1',
        url: 'https://example.com/@testuser/1',
        createdAt: '2024-01-01T00:00:00Z',
        account: {
            id: 'account-id',
            username: 'testuser',
            acct: 'testuser@example.com',
            displayName: 'Test User',
            url: 'https://example.com/@testuser',
            avatar: 'https://example.com/avatar.png',
        } as mastodon.v1.Account,
        content: '<p>Test status</p>',
        visibility: 'public',
        sensitive: false,
        spoilerText: '',
        mediaAttachments: [],
        mentions: [],
        tags: [],
        emojis: [],
        reblogsCount: 5,
        favouritesCount: 10,
        repliesCount: 2,
        favourited: false,
        reblogged: false,
        bookmarked: false,
        ...overrides,
    }) as mastodon.v1.Status;

describe('useStatusActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial state sync', () => {
        it('should sync initial state from props', () => {
            const status = createMockStatus({
                favourited: true,
                favouritesCount: 100,
                reblogged: true,
                reblogsCount: 50,
                bookmarked: true,
            });

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.favourited).toBe(true);
            expect(result.current.favouritesCount).toBe(100);
            expect(result.current.reblogged).toBe(true);
            expect(result.current.reblogsCount).toBe(50);
            expect(result.current.bookmarked).toBe(true);
        });

        it('should use default values when props are undefined', () => {
            const status = createMockStatus({
                favourited: undefined,
                favouritesCount: undefined,
                reblogged: undefined,
                reblogsCount: undefined,
                bookmarked: undefined,
            });

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.favourited).toBe(false);
            expect(result.current.favouritesCount).toBe(0);
            expect(result.current.reblogged).toBe(false);
            expect(result.current.reblogsCount).toBe(0);
            expect(result.current.bookmarked).toBe(false);
        });
    });

    describe('Favourite toggle', () => {
        it('should optimistically update favourite state', async () => {
            const status = createMockStatus({
                favourited: false,
                favouritesCount: 10,
            });

            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.favouriteStatus).mockResolvedValue(
                createMockStatus({ favourited: true, favouritesCount: 11 })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.favourited).toBe(false);
            expect(result.current.favouritesCount).toBe(10);

            await act(async () => {
                await result.current.handleFavourite();
            });

            expect(result.current.favourited).toBe(true);
            expect(result.current.favouritesCount).toBe(11);
        });

        it('should call favouriteStatus API when not favourited', async () => {
            const status = createMockStatus({ favourited: false });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.favouriteStatus).mockResolvedValue(
                createMockStatus({ favourited: true })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleFavourite();
            });

            expect(mastoClient.favouriteStatus).toHaveBeenCalledWith(mockClient, 'status-1');
            expect(mastoClient.unfavouriteStatus).not.toHaveBeenCalled();
        });

        it('should call unfavouriteStatus API when already favourited', async () => {
            const status = createMockStatus({ favourited: true });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.unfavouriteStatus).mockResolvedValue(
                createMockStatus({ favourited: false })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleFavourite();
            });

            expect(mastoClient.unfavouriteStatus).toHaveBeenCalledWith(mockClient, 'status-1');
            expect(mastoClient.favouriteStatus).not.toHaveBeenCalled();
        });

        it('should rollback on favourite error', async () => {
            const status = createMockStatus({
                favourited: false,
                favouritesCount: 10,
            });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.favouriteStatus).mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleFavourite();
            });

            // Should rollback to original state
            expect(result.current.favourited).toBe(false);
            expect(result.current.favouritesCount).toBe(10);
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to toggle favourite:',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('Reblog toggle', () => {
        it('should optimistically update reblog state', async () => {
            const status = createMockStatus({
                reblogged: false,
                reblogsCount: 5,
            });

            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.reblogStatus).mockResolvedValue(
                createMockStatus({ reblogged: true, reblogsCount: 6 })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.reblogged).toBe(false);
            expect(result.current.reblogsCount).toBe(5);

            await act(async () => {
                await result.current.handleReblog();
            });

            expect(result.current.reblogged).toBe(true);
            expect(result.current.reblogsCount).toBe(6);
        });

        it('should call reblogStatus API when not reblogged', async () => {
            const status = createMockStatus({ reblogged: false });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.reblogStatus).mockResolvedValue(
                createMockStatus({ reblogged: true })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleReblog();
            });

            expect(mastoClient.reblogStatus).toHaveBeenCalledWith(mockClient, 'status-1');
            expect(mastoClient.unreblogStatus).not.toHaveBeenCalled();
        });

        it('should call unreblogStatus API when already reblogged', async () => {
            const status = createMockStatus({ reblogged: true });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.unreblogStatus).mockResolvedValue(
                createMockStatus({ reblogged: false })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleReblog();
            });

            expect(mastoClient.unreblogStatus).toHaveBeenCalledWith(mockClient, 'status-1');
            expect(mastoClient.reblogStatus).not.toHaveBeenCalled();
        });

        it('should rollback on reblog error', async () => {
            const status = createMockStatus({
                reblogged: false,
                reblogsCount: 5,
            });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.reblogStatus).mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleReblog();
            });

            // Should rollback to original state
            expect(result.current.reblogged).toBe(false);
            expect(result.current.reblogsCount).toBe(5);
            expect(consoleSpy).toHaveBeenCalledWith('Failed to toggle reblog:', expect.any(Error));

            consoleSpy.mockRestore();
        });

        it('should handle reblog wrapper response', async () => {
            const status = createMockStatus({ reblogged: false });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);

            // Reblog API returns a wrapper status with reblog property
            const actualStatus = createMockStatus({
                id: 'status-1',
                reblogged: true,
                reblogsCount: 6,
            });
            const wrapperStatus = {
                ...createMockStatus({ id: 'reblog-status-id' }),
                reblog: actualStatus,
            } as mastodon.v1.Status;

            vi.mocked(mastoClient.reblogStatus).mockResolvedValue(wrapperStatus);

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleReblog();
            });

            // Should extract actual status from reblog wrapper
            expect(result.current.reblogged).toBe(true);
            expect(result.current.reblogsCount).toBe(6);
        });
    });

    describe('Bookmark toggle', () => {
        it('should optimistically update bookmark state', async () => {
            const status = createMockStatus({
                bookmarked: false,
            });

            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.bookmarkStatus).mockResolvedValue(
                createMockStatus({ bookmarked: true })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.bookmarked).toBe(false);

            await act(async () => {
                await result.current.handleBookmark();
            });

            expect(result.current.bookmarked).toBe(true);
        });

        it('should call bookmarkStatus API when not bookmarked', async () => {
            const status = createMockStatus({ bookmarked: false });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.bookmarkStatus).mockResolvedValue(
                createMockStatus({ bookmarked: true })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleBookmark();
            });

            expect(mastoClient.bookmarkStatus).toHaveBeenCalledWith(mockClient, 'status-1');
            expect(mastoClient.unbookmarkStatus).not.toHaveBeenCalled();
        });

        it('should call unbookmarkStatus API when already bookmarked', async () => {
            const status = createMockStatus({ bookmarked: true });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.unbookmarkStatus).mockResolvedValue(
                createMockStatus({ bookmarked: false })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleBookmark();
            });

            expect(mastoClient.unbookmarkStatus).toHaveBeenCalledWith(mockClient, 'status-1');
            expect(mastoClient.bookmarkStatus).not.toHaveBeenCalled();
        });

        it('should rollback on bookmark error', async () => {
            const status = createMockStatus({
                bookmarked: false,
            });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.bookmarkStatus).mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleBookmark();
            });

            // Should rollback to original state
            expect(result.current.bookmarked).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to toggle bookmark:',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('should call onStatusUpdate after successful bookmark', async () => {
            const status = createMockStatus();
            const mockClient = {} as mastoClient.MastoClient;
            const updatedStatus = createMockStatus({ bookmarked: true });
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.bookmarkStatus).mockResolvedValue(updatedStatus);

            const onStatusUpdate = vi.fn();

            const { result } = renderHook(() =>
                useStatusActions({
                    status,
                    accountSession: mockAccountSession,
                    onStatusUpdate,
                })
            );

            await act(async () => {
                await result.current.handleBookmark();
            });

            expect(onStatusUpdate).toHaveBeenCalledWith(updatedStatus);
        });

        it('should not call onStatusUpdate on bookmark error', async () => {
            const status = createMockStatus();
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.bookmarkStatus).mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const onStatusUpdate = vi.fn();

            const { result } = renderHook(() =>
                useStatusActions({
                    status,
                    accountSession: mockAccountSession,
                    onStatusUpdate,
                })
            );

            await act(async () => {
                await result.current.handleBookmark();
            });

            expect(onStatusUpdate).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should set isLoading.bookmark during bookmark operation', async () => {
            const status = createMockStatus();
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);

            // Create a controllable promise to verify loading state during operation
            let resolveBookmark: (value: mastodon.v1.Status) => void;
            const bookmarkPromise = new Promise<mastodon.v1.Status>((resolve) => {
                resolveBookmark = resolve;
            });
            vi.mocked(mastoClient.bookmarkStatus).mockReturnValue(bookmarkPromise);

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.isLoading.bookmark).toBe(false);

            // Start bookmark operation (don't await yet)
            let operationPromise: Promise<void>;
            await act(async () => {
                operationPromise = result.current.handleBookmark();
            });

            // Verify loading state is true during operation
            expect(result.current.isLoading.bookmark).toBe(true);

            // Resolve the API call
            resolveBookmark!(createMockStatus({ bookmarked: true }));

            // Wait for operation to complete
            await act(async () => {
                await operationPromise!;
            });

            // Verify loading state is false after completion
            expect(result.current.isLoading.bookmark).toBe(false);
        });
    });

    describe('canReblog', () => {
        it('should return true for public visibility', () => {
            const status = createMockStatus({ visibility: 'public' });

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.canReblog).toBe(true);
        });

        it('should return true for unlisted visibility', () => {
            const status = createMockStatus({ visibility: 'unlisted' });

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.canReblog).toBe(true);
        });

        it('should return false for private visibility', () => {
            const status = createMockStatus({ visibility: 'private' });

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.canReblog).toBe(false);
        });

        it('should return false for direct visibility', () => {
            const status = createMockStatus({ visibility: 'direct' });

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.canReblog).toBe(false);
        });

        it('should not call API when canReblog is false', async () => {
            const status = createMockStatus({ visibility: 'private' });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleReblog();
            });

            expect(mastoClient.reblogStatus).not.toHaveBeenCalled();
            expect(mastoClient.unreblogStatus).not.toHaveBeenCalled();
        });
    });

    describe('statusWithLocalState', () => {
        it('should merge local state with status', async () => {
            const status = createMockStatus({
                favourited: false,
                favouritesCount: 10,
                reblogged: false,
                reblogsCount: 5,
                bookmarked: false,
            });

            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.favouriteStatus).mockResolvedValue(
                createMockStatus({ favourited: true, favouritesCount: 11 })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleFavourite();
            });

            const merged = result.current.statusWithLocalState;
            expect(merged).not.toBeNull();
            expect(merged!.favourited).toBe(true);
            expect(merged!.favouritesCount).toBe(11);
            expect(merged!.bookmarked).toBe(false);
            expect(merged!.id).toBe('status-1');
        });

        it('should merge bookmarked state with status', async () => {
            const status = createMockStatus({
                bookmarked: false,
            });

            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.bookmarkStatus).mockResolvedValue(
                createMockStatus({ bookmarked: true })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            await act(async () => {
                await result.current.handleBookmark();
            });

            const merged = result.current.statusWithLocalState;
            expect(merged).not.toBeNull();
            expect(merged!.bookmarked).toBe(true);
        });
    });

    describe('No operation without accountSession', () => {
        it('should not perform favourite without accountSession', async () => {
            const status = createMockStatus();

            const { result } = renderHook(() => useStatusActions({ status }));

            await act(async () => {
                await result.current.handleFavourite();
            });

            expect(mastoClient.getClient).not.toHaveBeenCalled();
            expect(mastoClient.favouriteStatus).not.toHaveBeenCalled();
        });

        it('should not perform reblog without accountSession', async () => {
            const status = createMockStatus();

            const { result } = renderHook(() => useStatusActions({ status }));

            await act(async () => {
                await result.current.handleReblog();
            });

            expect(mastoClient.getClient).not.toHaveBeenCalled();
            expect(mastoClient.reblogStatus).not.toHaveBeenCalled();
        });

        it('should not perform bookmark without accountSession', async () => {
            const status = createMockStatus();

            const { result } = renderHook(() => useStatusActions({ status }));

            await act(async () => {
                await result.current.handleBookmark();
            });

            expect(mastoClient.getClient).not.toHaveBeenCalled();
            expect(mastoClient.bookmarkStatus).not.toHaveBeenCalled();
        });
    });

    describe('onStatusUpdate callback', () => {
        it('should call onStatusUpdate after successful favourite', async () => {
            const status = createMockStatus();
            const mockClient = {} as mastoClient.MastoClient;
            const updatedStatus = createMockStatus({ favourited: true });
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.favouriteStatus).mockResolvedValue(updatedStatus);

            const onStatusUpdate = vi.fn();

            const { result } = renderHook(() =>
                useStatusActions({
                    status,
                    accountSession: mockAccountSession,
                    onStatusUpdate,
                })
            );

            await act(async () => {
                await result.current.handleFavourite();
            });

            expect(onStatusUpdate).toHaveBeenCalledWith(updatedStatus);
        });

        it('should call onStatusUpdate after successful reblog', async () => {
            const status = createMockStatus();
            const mockClient = {} as mastoClient.MastoClient;
            const updatedStatus = createMockStatus({ reblogged: true });
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.reblogStatus).mockResolvedValue(updatedStatus);

            const onStatusUpdate = vi.fn();

            const { result } = renderHook(() =>
                useStatusActions({
                    status,
                    accountSession: mockAccountSession,
                    onStatusUpdate,
                })
            );

            await act(async () => {
                await result.current.handleReblog();
            });

            expect(onStatusUpdate).toHaveBeenCalled();
        });

        it('should not call onStatusUpdate on error', async () => {
            const status = createMockStatus();
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.favouriteStatus).mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const onStatusUpdate = vi.fn();

            const { result } = renderHook(() =>
                useStatusActions({
                    status,
                    accountSession: mockAccountSession,
                    onStatusUpdate,
                })
            );

            await act(async () => {
                await result.current.handleFavourite();
            });

            expect(onStatusUpdate).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('isLoading state', () => {
        it('should set isLoading.favourite during favourite operation', async () => {
            const status = createMockStatus();
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.favouriteStatus).mockResolvedValue(
                createMockStatus({ favourited: true })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.isLoading.favourite).toBe(false);

            await act(async () => {
                await result.current.handleFavourite();
            });

            expect(result.current.isLoading.favourite).toBe(false);
        });

        it('should set isLoading.reblog during reblog operation', async () => {
            const status = createMockStatus();
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.reblogStatus).mockResolvedValue(
                createMockStatus({ reblogged: true })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            expect(result.current.isLoading.reblog).toBe(false);

            await act(async () => {
                await result.current.handleReblog();
            });

            expect(result.current.isLoading.reblog).toBe(false);
        });

        it('should allow sequential operations', async () => {
            const status = createMockStatus({ favourited: false });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.favouriteStatus).mockResolvedValue(
                createMockStatus({ favourited: true })
            );
            vi.mocked(mastoClient.unfavouriteStatus).mockResolvedValue(
                createMockStatus({ favourited: false })
            );

            const { result } = renderHook(() =>
                useStatusActions({ status, accountSession: mockAccountSession })
            );

            // First operation: favourite
            await act(async () => {
                await result.current.handleFavourite();
            });

            expect(mastoClient.favouriteStatus).toHaveBeenCalledTimes(1);

            // Second operation: unfavourite (since localFavourited is now true)
            await act(async () => {
                await result.current.handleFavourite();
            });

            expect(mastoClient.unfavouriteStatus).toHaveBeenCalledTimes(1);
        });
    });

    describe('isLoading reset on status change', () => {
        it('should always clear isLoading.favourite even when status changes during request', async () => {
            const status1 = createMockStatus({ id: 'status-1', favourited: false });
            const status2 = createMockStatus({ id: 'status-2', favourited: false });

            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);

            // Create a delayed promise that we can control
            let resolveFavourite: (value: mastodon.v1.Status) => void;
            const favouritePromise = new Promise<mastodon.v1.Status>((resolve) => {
                resolveFavourite = resolve;
            });
            vi.mocked(mastoClient.favouriteStatus).mockReturnValue(favouritePromise);

            const { result, rerender } = renderHook(
                ({ status }) => useStatusActions({ status, accountSession: mockAccountSession }),
                { initialProps: { status: status1 } }
            );

            // Start favourite operation inside act
            let operationPromise: Promise<void>;
            await act(async () => {
                operationPromise = result.current.handleFavourite();
            });

            // While loading, change status (simulates thread navigation) inside act
            await act(async () => {
                rerender({ status: status2 });
            });

            // Complete the API call for the old status
            resolveFavourite!(createMockStatus({ id: 'status-1', favourited: true }));

            // Wait for the operation to complete
            await act(async () => {
                await operationPromise!;
            });

            // isLoading.favourite should be cleared even though status changed
            expect(result.current.isLoading.favourite).toBe(false);
        });

        it('should always clear isLoading.reblog even when status changes during request', async () => {
            const status1 = createMockStatus({ id: 'status-1', reblogged: false });
            const status2 = createMockStatus({ id: 'status-2', reblogged: false });

            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);

            // Create a delayed promise that we can control
            let resolveReblog: (value: mastodon.v1.Status) => void;
            const reblogPromise = new Promise<mastodon.v1.Status>((resolve) => {
                resolveReblog = resolve;
            });
            vi.mocked(mastoClient.reblogStatus).mockReturnValue(reblogPromise);

            const { result, rerender } = renderHook(
                ({ status }) => useStatusActions({ status, accountSession: mockAccountSession }),
                { initialProps: { status: status1 } }
            );

            // Start reblog operation inside act
            let operationPromise: Promise<void>;
            await act(async () => {
                operationPromise = result.current.handleReblog();
            });

            // While loading, change status (simulates thread navigation) inside act
            await act(async () => {
                rerender({ status: status2 });
            });

            // Complete the API call for the old status
            resolveReblog!(createMockStatus({ id: 'status-1', reblogged: true }));

            // Wait for the operation to complete
            await act(async () => {
                await operationPromise!;
            });

            // isLoading.reblog should be cleared even though status changed
            expect(result.current.isLoading.reblog).toBe(false);
        });

        it('should always clear isLoading.bookmark even when status changes during request', async () => {
            const status1 = createMockStatus({ id: 'status-1', bookmarked: false });
            const status2 = createMockStatus({ id: 'status-2', bookmarked: false });

            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);

            // Create a delayed promise that we can control
            let resolveBookmark: (value: mastodon.v1.Status) => void;
            const bookmarkPromise = new Promise<mastodon.v1.Status>((resolve) => {
                resolveBookmark = resolve;
            });
            vi.mocked(mastoClient.bookmarkStatus).mockReturnValue(bookmarkPromise);

            const { result, rerender } = renderHook(
                ({ status }) => useStatusActions({ status, accountSession: mockAccountSession }),
                { initialProps: { status: status1 } }
            );

            // Start bookmark operation inside act
            let operationPromise: Promise<void>;
            await act(async () => {
                operationPromise = result.current.handleBookmark();
            });

            // While loading, change status (simulates thread navigation) inside act
            await act(async () => {
                rerender({ status: status2 });
            });

            // Complete the API call for the old status
            resolveBookmark!(createMockStatus({ id: 'status-1', bookmarked: true }));

            // Wait for the operation to complete
            await act(async () => {
                await operationPromise!;
            });

            // isLoading.bookmark should be cleared even though status changed
            expect(result.current.isLoading.bookmark).toBe(false);
        });
    });

    describe('Pending props handling', () => {
        it('should sync state when props change', async () => {
            const status1 = createMockStatus({
                id: 'status-1',
                favourited: false,
                favouritesCount: 10,
            });

            const { result, rerender } = renderHook(
                ({ status }) => useStatusActions({ status, accountSession: mockAccountSession }),
                { initialProps: { status: status1 } }
            );

            expect(result.current.favourited).toBe(false);
            expect(result.current.favouritesCount).toBe(10);

            // Props change with same id
            const status2 = createMockStatus({
                id: 'status-1',
                favourited: true,
                favouritesCount: 20,
            });

            rerender({ status: status2 });

            // Should immediately sync
            expect(result.current.favourited).toBe(true);
            expect(result.current.favouritesCount).toBe(20);
        });

        it('should sync state when status id changes', async () => {
            const status1 = createMockStatus({
                id: 'status-1',
                favourited: false,
                favouritesCount: 10,
            });

            const { result, rerender } = renderHook(
                ({ status }) => useStatusActions({ status, accountSession: mockAccountSession }),
                { initialProps: { status: status1 } }
            );

            expect(result.current.favourited).toBe(false);

            // Status id changes (new status)
            const status2 = createMockStatus({
                id: 'status-2',
                favourited: true,
                favouritesCount: 30,
            });

            rerender({ status: status2 });

            // Should sync to new status
            expect(result.current.favourited).toBe(true);
            expect(result.current.favouritesCount).toBe(30);
        });
    });
});
