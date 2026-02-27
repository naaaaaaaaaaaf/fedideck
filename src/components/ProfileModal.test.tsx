import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileModal } from './ProfileModal';
import type { mastodon } from 'masto';
import type { AccountSession } from '../api/mastoClient';
import * as mastoClient from '../api/mastoClient';

// Mock IntersectionObserver for infinite scroll
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();
let intersectionCallback: IntersectionObserverCallback | null = null;

class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
    }
    observe = mockObserve;
    unobserve = mockUnobserve;
    disconnect = mockDisconnect;
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: readonly number[] = [];
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
}

// Helper to trigger intersection from tests
function triggerIntersection(isIntersecting: boolean) {
    if (intersectionCallback) {
        act(() => {
            intersectionCallback!(
                [{ isIntersecting } as IntersectionObserverEntry],
                {} as IntersectionObserver
            );
        });
    }
}

// Mock StatusCard component to simplify tests
vi.mock('./StatusCard', () => ({
    StatusCard: function MockStatusCard({ status }: { status: { id: string; content: string } }) {
        return (
            <div data-testid={`status-card-${status.id}`}>
                <div dangerouslySetInnerHTML={{ __html: status.content }} />
            </div>
        );
    },
}));

vi.mock('../api/mastoClient', async () => {
    const actual = await vi.importActual('../api/mastoClient');
    return {
        ...actual,
        getClient: vi.fn(() => ({
            v1: {
                accounts: {
                    fetch: vi.fn(),
                },
            },
        })),
        fetchAccount: vi.fn(),
        fetchAccountStatuses: vi.fn(),
    };
});

// Mock useRelationshipActions hook
vi.mock('../hooks/useRelationshipActions', () => ({
    useRelationshipActions: vi.fn(() => ({
        following: false,
        followedBy: false,
        requested: false,
        isLoading: false,
        isFetching: false,
        handleFollowToggle: vi.fn(),
        isOwnProfile: false,
    })),
}));

import { useRelationshipActions } from '../hooks/useRelationshipActions';

const mockUseRelationshipActions = vi.mocked(useRelationshipActions);
const mockFetchAccount = vi.mocked(mastoClient.fetchAccount);
const mockFetchAccountStatuses = vi.mocked(mastoClient.fetchAccountStatuses);

describe('ProfileModal', () => {
    // Suppress console.error during tests to keep CI logs clean
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    const mockAccount: mastodon.v1.Account = {
        id: '123',
        username: 'testuser',
        acct: 'testuser@mastodon.social',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.png',
        avatarStatic: 'https://example.com/avatar-static.png',
        header: 'https://example.com/header.png',
        headerStatic: 'https://example.com/header.png',
        note: '<p>Test bio</p>',
        followersCount: 100,
        followingCount: 50,
        statusesCount: 200,
        url: 'https://mastodon.social/@testuser',
        createdAt: '2024-01-01T00:00:00.000Z',
        bot: false,
        discoverable: true,
        locked: false,
        group: false,
        lastStatusAt: '',
        emojis: [],
        fields: [],
        roles: [],
        suspended: false,
        limited: false,
    };

    const mockSession: AccountSession = {
        id: '123@mastodon.social',
        instanceUrl: 'https://mastodon.social',
        accessToken: 'token',
        account: mockAccount,
    };

    const onClose = vi.fn();

    // Store original IntersectionObserver for cleanup
    let originalIntersectionObserver: typeof IntersectionObserver | undefined;

    beforeEach(() => {
        // Reset mock functions for each test
        mockObserve.mockClear();
        mockUnobserve.mockClear();
        mockDisconnect.mockClear();
        intersectionCallback = null;
        // Save original and replace with mock
        originalIntersectionObserver = window.IntersectionObserver;
        window.IntersectionObserver =
            MockIntersectionObserver as unknown as typeof IntersectionObserver;
        // Suppress console.error during tests to keep CI logs clean
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        // Reset mocks for each test
        onClose.mockClear();
        mockFetchAccount.mockResolvedValue(mockAccount);
        mockFetchAccountStatuses.mockResolvedValue([]);
        // Reset useRelationshipActions mock to default values
        mockUseRelationshipActions.mockReturnValue({
            following: false,
            followedBy: false,
            requested: false,
            isLoading: false,
            isFetching: false,
            handleFollowToggle: vi.fn(),
            isOwnProfile: false,
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        // Restore original IntersectionObserver
        if (originalIntersectionObserver !== undefined) {
            window.IntersectionObserver = originalIntersectionObserver;
        } else {
            delete (window as Record<string, unknown>).IntersectionObserver;
        }
    });

    it('does not render when isOpen is false', () => {
        const { container } = render(
            <ProfileModal
                isOpen={false}
                onClose={onClose}
                account={mockAccount}
                accountSession={mockSession}
            />
        );

        expect(container.firstChild).toBe(null);
    });

    it('renders basic account information', async () => {
        render(
            <ProfileModal
                isOpen={true}
                onClose={onClose}
                account={mockAccount}
                accountSession={mockSession}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Test User')).toBeInTheDocument();
            expect(screen.getByText('@testuser@mastodon.social')).toBeInTheDocument();
            expect(screen.getByText('Test bio')).toBeInTheDocument();
            expect(screen.getByText('100')).toBeInTheDocument();
            expect(screen.getByText('50')).toBeInTheDocument();
            expect(screen.getByText('200')).toBeInTheDocument();
        });
    });

    it('closes when close button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <ProfileModal
                isOpen={true}
                onClose={onClose}
                account={mockAccount}
                accountSession={mockSession}
            />
        );

        const closeButton = await screen.findByRole('button', { name: '閉じる' });
        await user.click(closeButton);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes when backdrop is clicked', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <ProfileModal
                isOpen={true}
                onClose={onClose}
                account={mockAccount}
                accountSession={mockSession}
            />
        );

        // Backdrop is a sibling of the modal, not a descendant of the header
        const backdrop = container.querySelector('[aria-hidden="true"]');
        expect(backdrop).not.toBeNull();
        if (backdrop) {
            await user.click(backdrop);
            expect(onClose).toHaveBeenCalledTimes(1);
        }
    });

    it('displays error message when fetch fails', async () => {
        mockFetchAccount.mockRejectedValueOnce(new Error('Failed to fetch'));

        render(
            <ProfileModal
                isOpen={true}
                onClose={onClose}
                account={mockAccount}
                accountSession={mockSession}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/追加情報の取得に失敗しました/)).toBeInTheDocument();
        });

        // Verify that console.error was called for the fetch failure
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('handles missing optional account fields', async () => {
        const minimalAccount: mastodon.v1.Account = {
            ...mockAccount,
            displayName: '',
            note: '',
        };

        // Don't pass accountSession so fetch doesn't run and overwrite minimalAccount
        render(<ProfileModal isOpen={true} onClose={onClose} account={minimalAccount} />);

        await waitFor(() => {
            expect(screen.getByText('@testuser@mastodon.social')).toBeInTheDocument();
            // Should fall back to username when displayName is empty
            expect(screen.getByText('testuser')).toBeInTheDocument();
        });
    });

    describe('Follow functionality', () => {
        it('renders follow button for other users profiles', async () => {
            const otherAccount: mastodon.v1.Account = {
                ...mockAccount,
                id: 'other-user-id',
                username: 'otheruser',
                displayName: 'Other User',
            };

            mockUseRelationshipActions.mockReturnValue({
                following: false,
                followedBy: false,
                requested: false,
                isLoading: false,
                isFetching: false,
                handleFollowToggle: vi.fn(),
                isOwnProfile: false,
            });

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={otherAccount}
                    accountSession={mockSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'フォロー' })).toBeInTheDocument();
            });
        });

        it('does not render follow button for own profile', async () => {
            mockUseRelationshipActions.mockReturnValue({
                following: false,
                followedBy: false,
                requested: false,
                isLoading: false,
                isFetching: false,
                handleFollowToggle: vi.fn(),
                isOwnProfile: true,
            });

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={mockAccount}
                    accountSession={mockSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Test User')).toBeInTheDocument();
            });

            // Follow button should not be present
            expect(screen.queryByRole('button', { name: 'フォロー' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'フォロー中' })).not.toBeInTheDocument();
        });

        it('displays "フォローされています" badge when followed by user', async () => {
            const otherAccount: mastodon.v1.Account = {
                ...mockAccount,
                id: 'other-user-id',
            };

            mockUseRelationshipActions.mockReturnValue({
                following: false,
                followedBy: true,
                requested: false,
                isLoading: false,
                isFetching: false,
                handleFollowToggle: vi.fn(),
                isOwnProfile: false,
            });

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={otherAccount}
                    accountSession={mockSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('フォローされています')).toBeInTheDocument();
            });
        });

        it('displays "フォロー中" button when already following', async () => {
            const otherAccount: mastodon.v1.Account = {
                ...mockAccount,
                id: 'other-user-id',
            };

            mockUseRelationshipActions.mockReturnValue({
                following: true,
                followedBy: false,
                requested: false,
                isLoading: false,
                isFetching: false,
                handleFollowToggle: vi.fn(),
                isOwnProfile: false,
            });

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={otherAccount}
                    accountSession={mockSession}
                />
            );

            await waitFor(() => {
                const button = screen.getByRole('button', { name: 'フォロー解除' });
                expect(button).toBeInTheDocument();
                // Check that the button contains "中" text
                expect(button).toHaveTextContent('中');
            });
        });

        it('displays cancel request button for locked accounts', async () => {
            const lockedAccount: mastodon.v1.Account = {
                ...mockAccount,
                id: 'locked-user-id',
                locked: true,
            };

            mockUseRelationshipActions.mockReturnValue({
                following: false,
                followedBy: false,
                requested: true,
                isLoading: false,
                isFetching: false,
                handleFollowToggle: vi.fn(),
                isOwnProfile: false,
            });

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={lockedAccount}
                    accountSession={mockSession}
                />
            );

            await waitFor(() => {
                const button = screen.getByRole('button', {
                    name: 'フォローリクエストをキャンセル',
                });
                expect(button).toBeInTheDocument();
                // Button should be enabled to allow canceling the request
                expect(button).not.toBeDisabled();
            });
        });

        it('calls handleFollowToggle when follow button is clicked', async () => {
            const handleFollowToggle = vi.fn();
            const otherAccount: mastodon.v1.Account = {
                ...mockAccount,
                id: 'other-user-id',
            };

            mockUseRelationshipActions.mockReturnValue({
                following: false,
                followedBy: false,
                requested: false,
                isLoading: false,
                isFetching: false,
                handleFollowToggle,
                isOwnProfile: false,
            });

            const user = userEvent.setup();
            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={otherAccount}
                    accountSession={mockSession}
                />
            );

            const followButton = await screen.findByRole('button', { name: 'フォロー' });
            await user.click(followButton);

            expect(handleFollowToggle).toHaveBeenCalledTimes(1);
        });

        it('disables follow button during loading', async () => {
            const otherAccount: mastodon.v1.Account = {
                ...mockAccount,
                id: 'other-user-id',
            };

            mockUseRelationshipActions.mockReturnValue({
                following: false,
                followedBy: false,
                requested: false,
                isLoading: true,
                isFetching: false,
                handleFollowToggle: vi.fn(),
                isOwnProfile: false,
            });

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={otherAccount}
                    accountSession={mockSession}
                />
            );

            await waitFor(() => {
                // Find the follow button by aria-label (aria-label is "処理中" during loading)
                const button = screen.getByRole('button', { name: '処理中' });
                expect(button).toBeDisabled();
                // Check that it contains "処理中..." text
                expect(button).toHaveTextContent('処理中...');
            });
        });

        it('disables follow button when no session is provided', async () => {
            const otherAccount: mastodon.v1.Account = {
                ...mockAccount,
                id: 'other-user-id',
            };

            mockUseRelationshipActions.mockReturnValue({
                following: false,
                followedBy: false,
                requested: false,
                isLoading: false,
                isFetching: false,
                handleFollowToggle: vi.fn(),
                isOwnProfile: false,
            });

            render(<ProfileModal isOpen={true} onClose={onClose} account={otherAccount} />);

            await waitFor(() => {
                const button = screen.getByRole('button', { name: 'フォロー' });
                expect(button).toBeDisabled();
                expect(button).toHaveAttribute('title', 'アカウント接続が必要です');
            });
        });
    });

    describe('Post list', () => {
        const mockStatus = {
            id: 'status-1',
            content: '<p>Test status content</p>',
            createdAt: '2026-01-01T00:00:00.000Z',
            account: mockAccount,
            visibility: 'public',
            uri: 'https://mastodon.social/@testuser/1',
            url: 'https://mastodon.social/@testuser/1',
            reblog: null,
            inReplyToId: null,
            inReplyToAccountId: null,
            reblogsCount: 0,
            favouritesCount: 0,
            repliesCount: 0,
            reblogged: false,
            favourited: false,
            bookmarked: false,
            muted: false,
            sensitive: false,
            spoilerText: '',
            language: 'en',
            mentions: [],
            tags: [],
            emojis: [],
            mediaAttachments: [],
            application: null,
            card: null,
            poll: null,
            filtered: [],
        } as unknown as mastodon.v1.Status;

        it('displays loading state while fetching statuses', async () => {
            // Use a promise that never resolves to ensure loading state is visible
            mockFetchAccountStatuses.mockImplementation(() => new Promise(() => {}));

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={mockAccount}
                    accountSession={mockSession}
                />
            );

            // Should show loading indicator for statuses
            await waitFor(() => {
                expect(screen.getByText('投稿を読み込み中...')).toBeInTheDocument();
            });
        });

        it('displays statuses after loading', async () => {
            mockFetchAccountStatuses.mockResolvedValueOnce([mockStatus]);

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={mockAccount}
                    accountSession={mockSession}
                />
            );

            // Wait for statuses to load
            await waitFor(() => {
                expect(screen.getByText('Test status content')).toBeInTheDocument();
            });
        });

        it('displays empty state when no statuses', async () => {
            mockFetchAccountStatuses.mockResolvedValueOnce([]);

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={mockAccount}
                    accountSession={mockSession}
                />
            );

            // Wait for empty state
            await waitFor(() => {
                expect(screen.getByText('投稿がありません')).toBeInTheDocument();
            });
        });

        it('does not fetch statuses without accountSession', async () => {
            render(<ProfileModal isOpen={true} onClose={onClose} account={mockAccount} />);

            // Wait for empty state to be displayed (which means no fetch happened)
            await waitFor(() => {
                expect(screen.getByText('投稿がありません')).toBeInTheDocument();
            });

            // Verify fetch was never called
            expect(mockFetchAccountStatuses).not.toHaveBeenCalled();
        });

        it('calls fetchAccountStatuses with correct parameters', async () => {
            mockFetchAccountStatuses.mockResolvedValueOnce([mockStatus]);

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={mockAccount}
                    accountSession={mockSession}
                />
            );

            await waitFor(() => {
                expect(mockFetchAccountStatuses).toHaveBeenCalledWith(
                    expect.anything(),
                    '123',
                    expect.objectContaining({ limit: 20 })
                );
            });
        });

        it('displays error message when fetchAccountStatuses fails', async () => {
            mockFetchAccountStatuses.mockRejectedValueOnce(new Error('Network error'));

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={mockAccount}
                    accountSession={mockSession}
                />
            );

            // Should show error message
            await waitFor(() => {
                expect(screen.getByText('投稿の読み込みに失敗しました')).toBeInTheDocument();
            });
        });

        it('retries fetch when reload button is clicked after error', async () => {
            const user = userEvent.setup();

            // First call fails
            mockFetchAccountStatuses.mockRejectedValueOnce(new Error('Network error'));

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={mockAccount}
                    accountSession={mockSession}
                />
            );

            // Wait for error state
            await waitFor(() => {
                expect(screen.getByText('投稿の読み込みに失敗しました')).toBeInTheDocument();
            });

            // Setup second call to succeed
            mockFetchAccountStatuses.mockResolvedValueOnce([mockStatus]);

            // Click reload button
            const reloadButton = screen.getByRole('button', { name: '再読み込み' });
            await user.click(reloadButton);

            // Should show the status after successful reload
            await waitFor(() => {
                expect(screen.getByText('Test status content')).toBeInTheDocument();
            });

            // Verify fetch was called twice (initial + retry)
            expect(mockFetchAccountStatuses).toHaveBeenCalledTimes(2);
        });
    });

    describe('Infinite scroll', () => {
        const mockStatus1 = {
            id: 'status-1',
            content: '<p>First status</p>',
            createdAt: '2026-01-01T00:00:00.000Z',
            account: mockAccount,
            visibility: 'public',
            uri: 'https://mastodon.social/@testuser/1',
            url: 'https://mastodon.social/@testuser/1',
            reblog: null,
            inReplyToId: null,
            inReplyToAccountId: null,
            reblogsCount: 0,
            favouritesCount: 0,
            repliesCount: 0,
            reblogged: false,
            favourited: false,
            bookmarked: false,
            muted: false,
            sensitive: false,
            spoilerText: '',
            language: 'en',
            mentions: [],
            tags: [],
            emojis: [],
            mediaAttachments: [],
            application: null,
            card: null,
            poll: null,
            filtered: [],
        } as unknown as mastodon.v1.Status;

        it('sets up IntersectionObserver for infinite scroll', async () => {
            mockFetchAccountStatuses.mockResolvedValueOnce([mockStatus1]);

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={mockAccount}
                    accountSession={mockSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('First status')).toBeInTheDocument();
            });

            expect(mockObserve).toHaveBeenCalled();
        });

        it('disconnects observer on unmount', async () => {
            mockFetchAccountStatuses.mockResolvedValueOnce([mockStatus1]);

            const { unmount } = render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={mockAccount}
                    accountSession={mockSession}
                />
            );

            await waitFor(() => {
                expect(mockObserve).toHaveBeenCalled();
            });

            unmount();

            expect(mockDisconnect).toHaveBeenCalled();
        });

        it('loads more statuses with maxId when scrolling to bottom', async () => {
            // First page of results - need full page to enable hasMoreStatuses
            const fullPage = Array.from({ length: 20 }, (_, i) => ({
                ...mockStatus1,
                id: `status-${i + 1}`,
                content: `<p>Status ${i + 1}</p>`,
            })) as unknown as mastodon.v1.Status[];
            mockFetchAccountStatuses.mockResolvedValueOnce(fullPage);

            render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={mockAccount}
                    accountSession={mockSession}
                />
            );

            // Wait for initial load and IntersectionObserver to be set up
            await waitFor(() => {
                expect(screen.getByText('Status 1')).toBeInTheDocument();
                expect(mockObserve).toHaveBeenCalled();
            });

            // Second page of results
            const mockStatus2 = {
                ...mockStatus1,
                id: 'status-21',
                content: '<p>Second page status</p>',
            } as unknown as mastodon.v1.Status;
            mockFetchAccountStatuses.mockResolvedValueOnce([mockStatus2]);

            // Trigger intersection to load more
            triggerIntersection(true);

            // Wait for second fetch with maxId
            await waitFor(() => {
                expect(mockFetchAccountStatuses).toHaveBeenCalledTimes(2);
                expect(mockFetchAccountStatuses).toHaveBeenNthCalledWith(
                    2,
                    expect.anything(),
                    '123',
                    expect.objectContaining({ maxId: 'status-20' })
                );
            });

            // Verify second status is appended
            await waitFor(() => {
                expect(screen.getByText('Second page status')).toBeInTheDocument();
            });
        });

        it('stops auto-loading on pagination error and recovers with manual retry', async () => {
            // First page of results - need full page to enable hasMoreStatuses
            const fullPage = Array.from({ length: 20 }, (_, i) => ({
                ...mockStatus1,
                id: `status-${i + 1}`,
                content: `<p>Status ${i + 1}</p>`,
            })) as unknown as mastodon.v1.Status[];
            mockFetchAccountStatuses.mockResolvedValueOnce(fullPage);

            const { container } = render(
                <ProfileModal
                    isOpen={true}
                    onClose={onClose}
                    account={mockAccount}
                    accountSession={mockSession}
                />
            );

            // Wait for initial load and IntersectionObserver to be set up
            await waitFor(() => {
                expect(screen.getByText('Status 1')).toBeInTheDocument();
                expect(mockObserve).toHaveBeenCalled();
            });

            // Second fetch fails
            mockFetchAccountStatuses.mockRejectedValueOnce(new Error('Network error'));

            // Trigger intersection to attempt loading more
            triggerIntersection(true);

            // Wait for error to be displayed
            await waitFor(() => {
                expect(screen.getByText('投稿の読み込みに失敗しました')).toBeInTheDocument();
            });

            // Should not show "end of list" message (error state instead)
            expect(screen.queryByText('これ以上投稿はありません')).not.toBeInTheDocument();

            // Trigger intersection again - should NOT auto-retry (error guard)
            triggerIntersection(true);

            // Wait a bit to ensure no additional fetch
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Should still be at 2 calls (initial + failed attempt)
            expect(mockFetchAccountStatuses).toHaveBeenCalledTimes(2);

            // Find retry button in the pagination error section
            const retryButtons = container.querySelectorAll('button');
            let retryButton: HTMLButtonElement | null = null;
            for (const button of retryButtons) {
                if (button.textContent?.includes('再読み込み')) {
                    retryButton = button as HTMLButtonElement;
                    break;
                }
            }
            expect(retryButton).not.toBeNull();

            // Setup third fetch to succeed
            const mockStatus2 = {
                ...mockStatus1,
                id: 'status-21',
                content: '<p>Second page status</p>',
            } as unknown as mastodon.v1.Status;
            mockFetchAccountStatuses.mockResolvedValueOnce([mockStatus2]);

            // Click retry button
            const user = userEvent.setup();
            await user.click(retryButton!);

            // Should show second status after successful retry
            await waitFor(() => {
                expect(screen.getByText('Second page status')).toBeInTheDocument();
            });
        });
    });
});
