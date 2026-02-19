import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePollState } from './usePollState';
import * as mastoClient from '../api/mastoClient';
import type { mastodon } from 'masto';
import type { AccountSession } from '../api/mastoClient';

// Mock the mastoClient module
vi.mock('../api/mastoClient', () => ({
    getClient: vi.fn(),
    fetchPoll: vi.fn(),
    votePoll: vi.fn(),
}));

const mockAccountSession = {
    id: '123',
    instanceUrl: 'https://example.com',
    accessToken: 'token',
    account: {
        id: '456',
        username: 'testuser',
        acct: 'testuser@example.com',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.png',
        avatarStatic: 'https://example.com/avatar-static.png',
        note: '',
        followersCount: 0,
        followingCount: 0,
        statusesCount: 0,
        url: 'https://example.com/@testuser',
        header: 'https://example.com/header.png',
        headerStatic: 'https://example.com/header-static.png',
        locked: false,
        bot: false,
        group: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        emojis: [],
        fields: [],
    },
} as unknown as AccountSession;

const createMockPoll = (overrides: Partial<mastodon.v1.Poll> = {}): mastodon.v1.Poll => ({
    id: 'poll-1',
    expired: false,
    multiple: false,
    votesCount: 10,
    options: [
        { title: 'Option 1', votesCount: 6, emojis: [] },
        { title: 'Option 2', votesCount: 4, emojis: [] },
    ],
    voted: false,
    ownVotes: null,
    ...overrides,
});

describe('usePollState', () => {
    let mockOnPollUpdate: (statusId: string, poll: mastodon.v1.Poll) => void;

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnPollUpdate = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('poll synchronization', () => {
        it('should sync localPoll with props poll', () => {
            const poll = createMockPoll();
            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            expect(result.current.localPoll).toEqual(poll);
        });

        it('should handle null poll', () => {
            const { result } = renderHook(() =>
                usePollState({
                    poll: null,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            expect(result.current.localPoll).toBeNull();
        });

        it('should clear selected options when poll changes', () => {
            const poll1 = createMockPoll({ id: 'poll-1' });
            const poll2 = createMockPoll({ id: 'poll-2' });

            const { result, rerender } = renderHook(
                ({ poll }) =>
                    usePollState({
                        poll,
                        statusId: 'status-1',
                        accountSession: mockAccountSession,
                        onPollUpdate: mockOnPollUpdate,
                    }),
                { initialProps: { poll: poll1 } }
            );

            // Select an option
            act(() => {
                result.current.handleOptionToggle(0);
            });
            expect(result.current.selectedOptions.has(0)).toBe(true);

            // Change poll
            rerender({ poll: poll2 });

            expect(result.current.selectedOptions.size).toBe(0);
        });

        it('should clear selected options when user votes', () => {
            const poll = createMockPoll({ voted: false });

            const { result, rerender } = renderHook(
                ({ poll }) =>
                    usePollState({
                        poll,
                        statusId: 'status-1',
                        accountSession: mockAccountSession,
                        onPollUpdate: mockOnPollUpdate,
                    }),
                { initialProps: { poll } }
            );

            // Select an option
            act(() => {
                result.current.handleOptionToggle(0);
            });
            expect(result.current.selectedOptions.has(0)).toBe(true);

            // Simulate voting (poll changes to voted)
            const votedPoll = createMockPoll({ voted: true, ownVotes: [0] });
            rerender({ poll: votedPoll });

            expect(result.current.selectedOptions.size).toBe(0);
        });
    });

    describe('hasVoted and canVote', () => {
        it('should return hasVoted=false when not voted', () => {
            const poll = createMockPoll({ voted: false, ownVotes: null });
            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            expect(result.current.hasVoted).toBe(false);
        });

        it('should return hasVoted=true when voted is true', () => {
            const poll = createMockPoll({ voted: true });
            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            expect(result.current.hasVoted).toBe(true);
        });

        it('should return hasVoted=true when ownVotes has values', () => {
            const poll = createMockPoll({ voted: false, ownVotes: [0] });
            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            expect(result.current.hasVoted).toBe(true);
        });

        it('should return canVote=true when can vote', () => {
            const poll = createMockPoll({ expired: false, voted: false });
            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            expect(result.current.canVote).toBe(true);
        });

        it('should return canVote=false when poll is expired', () => {
            const poll = createMockPoll({ expired: true });
            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            expect(result.current.canVote).toBe(false);
        });

        it('should return canVote=false when already voted', () => {
            const poll = createMockPoll({ voted: true });
            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            expect(result.current.canVote).toBe(false);
        });

        it('should return canVote=false when no account session', () => {
            const poll = createMockPoll({ expired: false, voted: false });
            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: null,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            expect(result.current.canVote).toBe(false);
        });
    });

    describe('handleOptionToggle', () => {
        it('should toggle single option for non-multiple poll', () => {
            const poll = createMockPoll({ multiple: false });
            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            act(() => {
                result.current.handleOptionToggle(0);
            });
            expect(result.current.selectedOptions).toEqual(new Set([0]));

            act(() => {
                result.current.handleOptionToggle(1);
            });
            expect(result.current.selectedOptions).toEqual(new Set([1]));
        });

        it('should toggle multiple options for multiple poll', () => {
            const poll = createMockPoll({
                multiple: true,
                options: [
                    { title: 'Option 1', votesCount: 1, emojis: [] },
                    { title: 'Option 2', votesCount: 1, emojis: [] },
                    { title: 'Option 3', votesCount: 1, emojis: [] },
                ],
            });
            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            act(() => {
                result.current.handleOptionToggle(0);
            });
            expect(result.current.selectedOptions).toEqual(new Set([0]));

            act(() => {
                result.current.handleOptionToggle(2);
            });
            expect(result.current.selectedOptions).toEqual(new Set([0, 2]));

            // Toggle off
            act(() => {
                result.current.handleOptionToggle(0);
            });
            expect(result.current.selectedOptions).toEqual(new Set([2]));
        });
    });

    describe('handleVote', () => {
        it('should vote and call onPollUpdate', async () => {
            const poll = createMockPoll();
            const updatedPoll = createMockPoll({ voted: true, ownVotes: [0] });
            vi.mocked(mastoClient.votePoll).mockResolvedValueOnce(updatedPoll);
            vi.mocked(mastoClient.getClient).mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );

            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            act(() => {
                result.current.handleOptionToggle(0);
            });

            await act(async () => {
                await result.current.handleVote();
            });

            expect(mastoClient.votePoll).toHaveBeenCalledWith(expect.any(Object), 'poll-1', [0]);
            expect(mockOnPollUpdate).toHaveBeenCalledWith('status-1', updatedPoll);
            expect(result.current.localPoll).toEqual(updatedPoll);
        });

        it('should not vote when no options selected', async () => {
            const poll = createMockPoll();
            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            await act(async () => {
                await result.current.handleVote();
            });

            expect(mastoClient.votePoll).not.toHaveBeenCalled();
            expect(mockOnPollUpdate).not.toHaveBeenCalled();
        });

        it('should not vote when already loading', async () => {
            const poll = createMockPoll();
            vi.mocked(mastoClient.votePoll).mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 100))
            );

            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            act(() => {
                result.current.handleOptionToggle(0);
            });

            // Start first vote
            act(() => {
                result.current.handleVote();
            });

            expect(result.current.pollLoading).toBe(true);

            // Try to vote again while loading
            await act(async () => {
                await result.current.handleVote();
            });

            // Should only be called once
            expect(mastoClient.votePoll).toHaveBeenCalledTimes(1);
        });

        it('should handle vote error', async () => {
            const poll = createMockPoll();
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(mastoClient.votePoll).mockRejectedValueOnce(new Error('Vote failed'));

            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            act(() => {
                result.current.handleOptionToggle(0);
            });

            await act(async () => {
                await result.current.handleVote();
            });

            expect(consoleSpy).toHaveBeenCalledWith('Failed to vote on poll:', expect.any(Error));
            expect(result.current.pollLoading).toBe(false);

            consoleSpy.mockRestore();
        });
    });

    describe('handleRefresh', () => {
        it('should refresh poll and call onPollUpdate', async () => {
            const poll = createMockPoll({ votesCount: 10 });
            const refreshedPoll = createMockPoll({ votesCount: 15 });
            vi.mocked(mastoClient.fetchPoll).mockResolvedValueOnce(refreshedPoll);
            vi.mocked(mastoClient.getClient).mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );

            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            await act(async () => {
                await result.current.handleRefresh();
            });

            expect(mastoClient.fetchPoll).toHaveBeenCalledWith(expect.any(Object), 'poll-1');
            expect(mockOnPollUpdate).toHaveBeenCalledWith('status-1', refreshedPoll);
            expect(result.current.localPoll).toEqual(refreshedPoll);
        });

        it('should not refresh when already refreshing', async () => {
            const poll = createMockPoll();
            vi.mocked(mastoClient.fetchPoll).mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve(poll), 100))
            );

            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            // Start first refresh
            act(() => {
                result.current.handleRefresh();
            });

            expect(result.current.pollRefreshing).toBe(true);

            // Try to refresh again
            await act(async () => {
                await result.current.handleRefresh();
            });

            // Should only be called once
            expect(mastoClient.fetchPoll).toHaveBeenCalledTimes(1);
        });

        it('should handle refresh error', async () => {
            const poll = createMockPoll();
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(mastoClient.fetchPoll).mockRejectedValueOnce(new Error('Refresh failed'));

            const { result } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                })
            );

            await act(async () => {
                await result.current.handleRefresh();
            });

            expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh poll:', expect.any(Error));
            expect(result.current.pollRefreshing).toBe(false);

            consoleSpy.mockRestore();
        });
    });

    describe('autoRefreshOnExpiry', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should auto-refresh when poll expires', async () => {
            const now = Date.now();
            vi.setSystemTime(now);

            const poll = createMockPoll({
                expiresAt: new Date(now + 5000).toISOString(), // 5 seconds from now
            });
            const refreshedPoll = createMockPoll({ expired: true });
            vi.mocked(mastoClient.fetchPoll).mockResolvedValueOnce(refreshedPoll);
            vi.mocked(mastoClient.getClient).mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );

            renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                    autoRefreshOnExpiry: true,
                })
            );

            // Should not have refreshed yet
            expect(mastoClient.fetchPoll).not.toHaveBeenCalled();

            // Advance past expiry time
            await act(async () => {
                vi.advanceTimersByTime(5000);
                // Allow the timeout callback to execute
                await Promise.resolve();
            });

            expect(mastoClient.fetchPoll).toHaveBeenCalled();
        });

        it('should not auto-refresh when autoRefreshOnExpiry is false', () => {
            const now = Date.now();
            vi.setSystemTime(now);

            const poll = createMockPoll({
                expiresAt: new Date(now + 5000).toISOString(),
            });

            renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                    autoRefreshOnExpiry: false,
                })
            );

            act(() => {
                vi.advanceTimersByTime(5000);
            });

            expect(mastoClient.fetchPoll).not.toHaveBeenCalled();
        });

        it('should not auto-refresh when poll is already expired', () => {
            const poll = createMockPoll({ expired: true });

            renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                    autoRefreshOnExpiry: true,
                })
            );

            expect(mastoClient.fetchPoll).not.toHaveBeenCalled();
        });

        it('should clear timeout on unmount', () => {
            const now = Date.now();
            vi.setSystemTime(now);

            const poll = createMockPoll({
                expiresAt: new Date(now + 5000).toISOString(),
            });

            const { unmount } = renderHook(() =>
                usePollState({
                    poll,
                    statusId: 'status-1',
                    accountSession: mockAccountSession,
                    onPollUpdate: mockOnPollUpdate,
                    autoRefreshOnExpiry: true,
                })
            );

            unmount();

            // Advance past expiry time
            act(() => {
                vi.advanceTimersByTime(5000);
            });

            // Should not have called fetchPoll after unmount
            expect(mastoClient.fetchPoll).not.toHaveBeenCalled();
        });
    });
});
