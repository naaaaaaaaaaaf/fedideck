import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRelationshipActions } from './useRelationshipActions';
import type { mastodon } from 'masto';
import * as mastoClient from '../api/mastoClient';

// Mock the mastoClient module
vi.mock('../api/mastoClient', () => ({
    getClient: vi.fn(),
    fetchRelationship: vi.fn(),
    followAccount: vi.fn(),
    unfollowAccount: vi.fn(),
}));

const mockAccountSession = {
    id: 'test-session-id',
    instanceUrl: 'https://example.com',
    accessToken: 'test-token',
    account: {
        id: 'my-account-id',
        username: 'testuser',
        acct: 'testuser@example.com',
        displayName: 'Test User',
        url: 'https://example.com/@testuser',
        avatar: 'https://example.com/avatar.png',
    } as mastodon.v1.Account,
};

const createMockRelationship = (
    overrides: Partial<mastodon.v1.Relationship> = {}
): mastodon.v1.Relationship =>
    ({
        id: 'target-account-id',
        following: false,
        followedBy: false,
        requested: false,
        ...overrides,
    }) as mastodon.v1.Relationship;

describe('useRelationshipActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial state', () => {
        it('should have default values when no target account is provided', () => {
            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: null,
                    accountSession: mockAccountSession,
                })
            );

            expect(result.current.following).toBe(false);
            expect(result.current.followedBy).toBe(false);
            expect(result.current.requested).toBe(false);
            expect(result.current.isLoading).toBe(false);
            expect(result.current.isFetching).toBe(false);
            expect(result.current.isOwnProfile).toBe(false);
        });

        it('should have default values when no session is provided', () => {
            const { result } = renderHook(() =>
                useRelationshipActions({ targetAccountId: 'other-user-id' })
            );

            expect(result.current.following).toBe(false);
            expect(result.current.followedBy).toBe(false);
            expect(result.current.isLoading).toBe(false);
            expect(result.current.isOwnProfile).toBe(false);
        });

        it('should detect own profile correctly', () => {
            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: 'my-account-id',
                    accountSession: mockAccountSession,
                })
            );

            expect(result.current.isOwnProfile).toBe(true);
        });
    });

    describe('Fetching relationship', () => {
        it('should fetch relationship on mount', async () => {
            const mockRelationship = createMockRelationship({
                following: true,
                followedBy: false,
            });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.fetchRelationship).mockResolvedValue(mockRelationship);

            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: 'target-account-id',
                    accountSession: mockAccountSession,
                })
            );

            // Initially fetching
            expect(result.current.isFetching).toBe(true);

            await waitFor(() => {
                expect(result.current.isFetching).toBe(false);
            });

            expect(result.current.following).toBe(true);
            expect(result.current.followedBy).toBe(false);
            expect(mastoClient.fetchRelationship).toHaveBeenCalledWith(
                mockClient,
                'target-account-id'
            );
        });

        it('should not fetch relationship for own profile', async () => {
            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: 'my-account-id',
                    accountSession: mockAccountSession,
                })
            );

            // Should not fetch and should not be in fetching state
            expect(result.current.isFetching).toBe(false);
            expect(mastoClient.fetchRelationship).not.toHaveBeenCalled();
        });

        it('should handle fetch error gracefully', async () => {
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.fetchRelationship).mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: 'target-account-id',
                    accountSession: mockAccountSession,
                })
            );

            await waitFor(() => {
                expect(result.current.isFetching).toBe(false);
            });

            // Should have default values after error
            expect(result.current.following).toBe(false);
            expect(result.current.followedBy).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to fetch relationship:',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('should reset state when target account changes', async () => {
            const mockRelationship = createMockRelationship({ following: true });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.fetchRelationship).mockResolvedValue(mockRelationship);

            const { result, rerender } = renderHook(
                ({ targetAccountId }) =>
                    useRelationshipActions({ targetAccountId, accountSession: mockAccountSession }),
                { initialProps: { targetAccountId: 'account-1' } }
            );

            await waitFor(() => {
                expect(result.current.following).toBe(true);
            });

            // Change to a different account
            vi.mocked(mastoClient.fetchRelationship).mockResolvedValue(
                createMockRelationship({ following: false })
            );

            rerender({ targetAccountId: 'account-2' });

            // State should reset during fetch
            expect(result.current.following).toBe(false);

            await waitFor(() => {
                expect(result.current.isFetching).toBe(false);
            });
        });
    });

    describe('Follow toggle', () => {
        it('should optimistically update follow state', async () => {
            const mockRelationship = createMockRelationship({ following: false });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.fetchRelationship).mockResolvedValue(mockRelationship);
            vi.mocked(mastoClient.followAccount).mockResolvedValue(
                createMockRelationship({ following: true, followedBy: false })
            );

            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: 'target-account-id',
                    accountSession: mockAccountSession,
                })
            );

            await waitFor(() => {
                expect(result.current.isFetching).toBe(false);
            });

            expect(result.current.following).toBe(false);

            await act(async () => {
                await result.current.handleFollowToggle();
            });

            expect(result.current.following).toBe(true);
            expect(mastoClient.followAccount).toHaveBeenCalledWith(mockClient, 'target-account-id');
        });

        it('should call unfollowAccount when already following', async () => {
            const mockRelationship = createMockRelationship({ following: true });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.fetchRelationship).mockResolvedValue(mockRelationship);
            vi.mocked(mastoClient.unfollowAccount).mockResolvedValue(
                createMockRelationship({ following: false })
            );

            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: 'target-account-id',
                    accountSession: mockAccountSession,
                })
            );

            await waitFor(() => {
                expect(result.current.following).toBe(true);
            });

            await act(async () => {
                await result.current.handleFollowToggle();
            });

            expect(mastoClient.unfollowAccount).toHaveBeenCalledWith(
                mockClient,
                'target-account-id'
            );
            expect(mastoClient.followAccount).not.toHaveBeenCalled();
        });

        it('should rollback on follow error', async () => {
            const mockRelationship = createMockRelationship({ following: false });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.fetchRelationship).mockResolvedValue(mockRelationship);
            vi.mocked(mastoClient.followAccount).mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: 'target-account-id',
                    accountSession: mockAccountSession,
                })
            );

            await waitFor(() => {
                expect(result.current.isFetching).toBe(false);
            });

            await act(async () => {
                await result.current.handleFollowToggle();
            });

            // Should rollback to original state
            expect(result.current.following).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Failed to toggle follow:', expect.any(Error));

            consoleSpy.mockRestore();
        });

        it('should not perform action without accountSession', async () => {
            const { result } = renderHook(() =>
                useRelationshipActions({ targetAccountId: 'target-account-id' })
            );

            await act(async () => {
                await result.current.handleFollowToggle();
            });

            expect(mastoClient.getClient).not.toHaveBeenCalled();
            expect(mastoClient.followAccount).not.toHaveBeenCalled();
        });

        it('should not perform action on own profile', async () => {
            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: 'my-account-id',
                    accountSession: mockAccountSession,
                })
            );

            await act(async () => {
                await result.current.handleFollowToggle();
            });

            expect(mastoClient.followAccount).not.toHaveBeenCalled();
        });

        it('should handle locked account follow request (requested state)', async () => {
            const mockRelationship = createMockRelationship({ following: false, requested: false });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.fetchRelationship).mockResolvedValue(mockRelationship);
            // For locked accounts, follow returns requested: true instead of following: true
            vi.mocked(mastoClient.followAccount).mockResolvedValue(
                createMockRelationship({ following: false, requested: true })
            );

            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: 'target-account-id',
                    accountSession: mockAccountSession,
                })
            );

            await waitFor(() => {
                expect(result.current.isFetching).toBe(false);
            });

            expect(result.current.requested).toBe(false);

            await act(async () => {
                await result.current.handleFollowToggle();
            });

            expect(result.current.requested).toBe(true);
            expect(result.current.following).toBe(false);
        });

        it('should cancel follow request for locked accounts', async () => {
            const mockRelationship = createMockRelationship({ following: false, requested: true });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.fetchRelationship).mockResolvedValue(mockRelationship);
            vi.mocked(mastoClient.unfollowAccount).mockResolvedValue(
                createMockRelationship({ following: false, requested: false })
            );

            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: 'target-account-id',
                    accountSession: mockAccountSession,
                })
            );

            await waitFor(() => {
                expect(result.current.requested).toBe(true);
            });

            await act(async () => {
                await result.current.handleFollowToggle();
            });

            // Should call unfollow to cancel the request
            expect(mastoClient.unfollowAccount).toHaveBeenCalledWith(
                mockClient,
                'target-account-id'
            );
            expect(result.current.requested).toBe(false);
        });
    });

    describe('isLoading state', () => {
        it('should set isLoading during follow operation', async () => {
            const mockRelationship = createMockRelationship({ following: false });
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);
            vi.mocked(mastoClient.fetchRelationship).mockResolvedValue(mockRelationship);

            // Create a controllable promise
            let resolveFollow: (value: mastodon.v1.Relationship) => void;
            const followPromise = new Promise<mastodon.v1.Relationship>((resolve) => {
                resolveFollow = resolve;
            });
            vi.mocked(mastoClient.followAccount).mockReturnValue(followPromise);

            const { result } = renderHook(() =>
                useRelationshipActions({
                    targetAccountId: 'target-account-id',
                    accountSession: mockAccountSession,
                })
            );

            await waitFor(() => {
                expect(result.current.isFetching).toBe(false);
            });

            expect(result.current.isLoading).toBe(false);

            // Start follow operation (don't await yet)
            let operationPromise: Promise<void>;
            await act(async () => {
                operationPromise = result.current.handleFollowToggle();
            });

            // Verify loading state is true during operation
            expect(result.current.isLoading).toBe(true);

            // Resolve the API call
            resolveFollow!(createMockRelationship({ following: true }));

            // Wait for operation to complete
            await act(async () => {
                await operationPromise!;
            });

            expect(result.current.isLoading).toBe(false);
        });
    });

    describe('Race condition handling', () => {
        it('should ignore stale response when target changes during request', async () => {
            const mockClient = {} as mastoClient.MastoClient;
            vi.mocked(mastoClient.getClient).mockReturnValue(mockClient);

            // Create a delayed promise for follow
            let resolveFollow: (value: mastodon.v1.Relationship) => void;
            const followPromise = new Promise<mastodon.v1.Relationship>((resolve) => {
                resolveFollow = resolve;
            });
            vi.mocked(mastoClient.followAccount).mockReturnValue(followPromise);
            vi.mocked(mastoClient.fetchRelationship).mockResolvedValue(createMockRelationship());

            const { result, rerender } = renderHook(
                ({ targetAccountId }) =>
                    useRelationshipActions({ targetAccountId, accountSession: mockAccountSession }),
                { initialProps: { targetAccountId: 'account-1' } }
            );

            await waitFor(() => {
                expect(result.current.isFetching).toBe(false);
            });

            // Start follow operation
            let operationPromise: Promise<void>;
            await act(async () => {
                operationPromise = result.current.handleFollowToggle();
            });

            // Change target while operation is in flight
            rerender({ targetAccountId: 'account-2' });

            // Resolve the old follow request
            resolveFollow!(createMockRelationship({ following: true }));

            // Wait for operation to complete
            await act(async () => {
                await operationPromise!;
            });

            // State should remain at default for new account (not true from old account)
            expect(result.current.following).toBe(false);
        });
    });
});
