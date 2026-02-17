import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Column } from './Column';
import type { mastodon } from 'masto';

const createMockSession = (overrides = {}) => ({
    id: '1@mastodon.social',
    instanceUrl: 'https://mastodon.social',
    accessToken: 'token',
    account: {
        id: '1',
        username: 'testuser',
        acct: 'testuser',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.png',
    } as mastodon.v1.Account,
    createdAt: Date.now(),
    ...overrides,
});

const createMockStatus = (id: string): mastodon.v1.Status =>
    ({
        id,
        createdAt: new Date().toISOString(),
        content: `<p>Status ${id}</p>`,
        account: {
            id: '1',
            username: 'testuser',
            displayName: 'Test User',
            avatar: 'https://example.com/avatar.png',
            acct: 'testuser',
        },
        mediaAttachments: [],
        mentions: [],
        tags: [],
        emojis: [],
        reblog: null,
        spoilerText: '',
        visibility: 'public',
        favouritesCount: 0,
        reblogsCount: 0,
        repliesCount: 0,
        favourited: false,
        reblogged: false,
    }) as unknown as mastodon.v1.Status;

const createMockNotification = (id: string): mastodon.v1.Notification =>
    ({
        id,
        type: 'favourite',
        createdAt: new Date().toISOString(),
        account: {
            id: '1',
            username: 'testuser',
            displayName: 'Test User',
            avatar: 'https://example.com/avatar.png',
            acct: 'testuser',
        },
    }) as mastodon.v1.Notification;

// Store mocks
let mockAccount: ReturnType<typeof createMockSession> | undefined;
let mockStreamDataMap: Record<
    string,
    {
        statuses: mastodon.v1.Status[];
        notifications: mastodon.v1.Notification[];
        isLoading: boolean;
        hasMore: boolean;
        error: string | null;
    }
> = {};

const mockInitStream = vi.fn();
const mockSetLoading = vi.fn();
const mockSetStatuses = vi.fn();
const mockSetNotifications = vi.fn();
const mockAppendStatuses = vi.fn();
const mockAppendNotifications = vi.fn();
const mockSetError = vi.fn();
const mockUpdateStatusGlobal = vi.fn();

vi.mock('../store/accounts', () => ({
    useAccountsStore: (selector: (state: unknown) => unknown) => {
        const state = {
            accounts: mockAccount ? [mockAccount] : [],
        };
        return selector(state);
    },
}));

vi.mock('../store/streams', () => ({
    useStreamsStore: (selector?: (state: unknown) => unknown) => {
        const state = {
            data: mockStreamDataMap,
            initStream: mockInitStream,
            setLoading: mockSetLoading,
            setStatuses: mockSetStatuses,
            setNotifications: mockSetNotifications,
            appendStatuses: mockAppendStatuses,
            appendNotifications: mockAppendNotifications,
            setError: mockSetError,
            updateStatusGlobal: mockUpdateStatusGlobal,
        };
        if (selector) return selector(state);
        return state;
    },
    getStreamKey: (
        accountId: string,
        streamType: string,
        params?: { listId?: string; hashtag?: string }
    ) => {
        if (params?.listId) return `${accountId}:list:${params.listId}`;
        if (params?.hashtag) return `${accountId}:hashtag:${params.hashtag}`;
        return `${accountId}:${streamType}`;
    },
}));

const mockFetchHomeTimeline = vi.fn();
const mockFetchPublicTimeline = vi.fn();
const mockFetchNotificationsAPI = vi.fn();
const mockFetchListTimeline = vi.fn();
const mockFetchHashtagTimeline = vi.fn();
const mockGetClient = vi.fn();

vi.mock('../api/mastoClient', () => ({
    getClient: (...args: unknown[]) => mockGetClient(...args),
    fetchHomeTimeline: (...args: unknown[]) => mockFetchHomeTimeline(...args),
    fetchPublicTimeline: (...args: unknown[]) => mockFetchPublicTimeline(...args),
    fetchNotifications: (...args: unknown[]) => mockFetchNotificationsAPI(...args),
    fetchListTimeline: (...args: unknown[]) => mockFetchListTimeline(...args),
    fetchHashtagTimeline: (...args: unknown[]) => mockFetchHashtagTimeline(...args),
}));

const mockSubscribeToStream = vi.fn();
const mockUnsubscribeFromStream = vi.fn();

vi.mock('../streaming/streamManager', () => ({
    subscribeToStream: (...args: unknown[]) => mockSubscribeToStream(...args),
    unsubscribeFromStream: (...args: unknown[]) => mockUnsubscribeFromStream(...args),
}));

vi.mock('../components/StatusCard', () => ({
    StatusCard: ({ status }: { status: mastodon.v1.Status }) => (
        <div data-testid={`status-${status.id}`}>Status: {status.id}</div>
    ),
}));

const mockNotificationCardOnStatusClick = vi.fn();
vi.mock('../components/NotificationCard', () => ({
    NotificationCard: ({
        notification,
        onStatusClick,
    }: {
        notification: mastodon.v1.Notification;
        onStatusClick?: (status: mastodon.v1.Status) => void;
    }) => {
        // Store the onStatusClick callback for testing
        if (onStatusClick) {
            mockNotificationCardOnStatusClick.mockImplementation(onStatusClick);
        }
        return (
            <div
                data-testid={`notification-${notification.id}`}
                data-has-status-click={onStatusClick ? 'true' : 'false'}
            >
                Notification: {notification.id}
            </div>
        );
    },
}));

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
    observe = mockObserve;
    disconnect = mockDisconnect;
    unobserve = vi.fn();
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: readonly number[] = [];
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
}

describe('Column', () => {
    beforeEach(() => {
        mockAccount = createMockSession();
        mockStreamDataMap = {};
        vi.clearAllMocks();
        mockNotificationCardOnStatusClick.mockReset();
        mockFetchHomeTimeline.mockResolvedValue([]);
        mockFetchPublicTimeline.mockResolvedValue([]);
        mockFetchNotificationsAPI.mockResolvedValue([]);
        mockFetchListTimeline.mockResolvedValue([]);
        mockFetchHashtagTimeline.mockResolvedValue([]);
        mockGetClient.mockReturnValue({});

        vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('rendering', () => {
        it('should render column header with stream icon and label', () => {
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(screen.getByText('ホーム')).toBeInTheDocument();
        });

        it('should render refresh button', () => {
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(screen.getByTitle('更新')).toBeInTheDocument();
        });

        it('should render remove button when onRemove is provided', () => {
            render(
                <Column
                    id="col-1"
                    accountId="1@mastodon.social"
                    stream={{ type: 'home' }}
                    onRemove={vi.fn()}
                />
            );
            expect(screen.getByTitle('カラムを削除')).toBeInTheDocument();
        });

        it('should not render remove button when onRemove is not provided', () => {
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(screen.queryByTitle('カラムを削除')).not.toBeInTheDocument();
        });

        it('should display correct label for each stream type', () => {
            const { rerender } = render(
                <Column
                    id="col-1"
                    accountId="1@mastodon.social"
                    stream={{ type: 'notifications' }}
                />
            );
            expect(screen.getByText('通知')).toBeInTheDocument();

            rerender(
                <Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'public' }} />
            );
            expect(screen.getByText('連合タイムライン')).toBeInTheDocument();
        });

        it('should show account handle in header', () => {
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(screen.getByTitle('@testuser@mastodon.social')).toBeInTheDocument();
        });

        it('should not show account handle when account is missing', () => {
            mockAccount = undefined;
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(screen.queryByTitle(/^@/)).not.toBeInTheDocument();
        });

        it('should not duplicate domain when acct already contains domain', () => {
            mockAccount = createMockSession({
                account: {
                    ...createMockSession().account,
                    acct: 'testuser@mastodon.social',
                },
            });
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(screen.getByTitle('@testuser@mastodon.social')).toBeInTheDocument();
        });
    });

    describe('states', () => {
        it('should show loading spinner when loading with no content', () => {
            mockStreamDataMap['1@mastodon.social:home'] = {
                statuses: [],
                notifications: [],
                isLoading: true,
                hasMore: true,
                error: null,
            };
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(screen.getByText('読み込み中...')).toBeInTheDocument();
        });

        it('should show error message and retry button', () => {
            mockStreamDataMap['1@mastodon.social:home'] = {
                statuses: [],
                notifications: [],
                isLoading: false,
                hasMore: true,
                error: 'Network error',
            };
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(screen.getByText('Network error')).toBeInTheDocument();
            expect(screen.getByText('再試行')).toBeInTheDocument();
        });

        it('should show empty state when no statuses', () => {
            mockStreamDataMap['1@mastodon.social:home'] = {
                statuses: [],
                notifications: [],
                isLoading: false,
                hasMore: true,
                error: null,
            };
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(screen.getByText('まだ投稿がありません')).toBeInTheDocument();
        });
    });

    describe('data fetching', () => {
        it('should call initStream on mount', () => {
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(mockInitStream).toHaveBeenCalledWith('1@mastodon.social:home');
        });

        it('should call fetchHomeTimeline for home stream', async () => {
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            await waitFor(() => {
                expect(mockFetchHomeTimeline).toHaveBeenCalled();
            });
        });

        it('should call fetchPublicTimeline for public stream', async () => {
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'public' }} />);
            await waitFor(() => {
                expect(mockFetchPublicTimeline).toHaveBeenCalledWith(expect.anything(), {
                    local: false,
                });
            });
        });

        it('should call fetchPublicTimeline with local:true for public:local stream', async () => {
            render(
                <Column
                    id="col-1"
                    accountId="1@mastodon.social"
                    stream={{ type: 'public:local' }}
                />
            );
            await waitFor(() => {
                expect(mockFetchPublicTimeline).toHaveBeenCalledWith(expect.anything(), {
                    local: true,
                });
            });
        });

        it('should call fetchNotifications for notifications stream', async () => {
            render(
                <Column
                    id="col-1"
                    accountId="1@mastodon.social"
                    stream={{ type: 'notifications' }}
                />
            );
            await waitFor(() => {
                expect(mockFetchNotificationsAPI).toHaveBeenCalled();
            });
        });

        it('should call fetchListTimeline for list stream', async () => {
            render(
                <Column
                    id="col-1"
                    accountId="1@mastodon.social"
                    stream={{ type: 'list', listId: '42' }}
                />
            );
            await waitFor(() => {
                expect(mockFetchListTimeline).toHaveBeenCalledWith(expect.anything(), '42');
            });
        });

        it('should call fetchHashtagTimeline for hashtag stream', async () => {
            render(
                <Column
                    id="col-1"
                    accountId="1@mastodon.social"
                    stream={{ type: 'hashtag', hashtag: 'typescript' }}
                />
            );
            await waitFor(() => {
                expect(mockFetchHashtagTimeline).toHaveBeenCalledWith(
                    expect.anything(),
                    'typescript'
                );
            });
        });
    });

    describe('streaming', () => {
        it('should subscribe to stream on mount', () => {
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(mockSubscribeToStream).toHaveBeenCalledWith(
                '1@mastodon.social',
                'https://mastodon.social',
                'token',
                { type: 'home' }
            );
        });

        it('should unsubscribe from stream on unmount', () => {
            const { unmount } = render(
                <Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />
            );
            unmount();
            expect(mockUnsubscribeFromStream).toHaveBeenCalledWith('1@mastodon.social', {
                type: 'home',
            });
        });
    });

    describe('content rendering', () => {
        it('should render StatusCards for status stream', () => {
            mockStreamDataMap['1@mastodon.social:home'] = {
                statuses: [createMockStatus('s1'), createMockStatus('s2')],
                notifications: [],
                isLoading: false,
                hasMore: true,
                error: null,
            };
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(screen.getByTestId('status-s1')).toBeInTheDocument();
            expect(screen.getByTestId('status-s2')).toBeInTheDocument();
        });

        it('should render NotificationCards for notification stream', () => {
            mockStreamDataMap['1@mastodon.social:notifications'] = {
                statuses: [],
                notifications: [createMockNotification('n1'), createMockNotification('n2')],
                isLoading: false,
                hasMore: true,
                error: null,
            };
            render(
                <Column
                    id="col-1"
                    accountId="1@mastodon.social"
                    stream={{ type: 'notifications' }}
                />
            );
            expect(screen.getByTestId('notification-n1')).toBeInTheDocument();
            expect(screen.getByTestId('notification-n2')).toBeInTheDocument();
        });
    });

    describe('interactions', () => {
        it('should call onRemove when remove button is clicked', async () => {
            const user = userEvent.setup();
            const onRemove = vi.fn();
            render(
                <Column
                    id="col-1"
                    accountId="1@mastodon.social"
                    stream={{ type: 'home' }}
                    onRemove={onRemove}
                />
            );

            await user.click(screen.getByTitle('カラムを削除'));
            expect(onRemove).toHaveBeenCalledTimes(1);
        });

        it('should reload data when refresh button is clicked', async () => {
            const user = userEvent.setup();
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);

            mockFetchHomeTimeline.mockClear();
            await user.click(screen.getByTitle('更新'));

            await waitFor(() => {
                expect(mockFetchHomeTimeline).toHaveBeenCalled();
            });
        });
    });

    describe('IntersectionObserver', () => {
        it('should set up IntersectionObserver for infinite scroll', () => {
            mockStreamDataMap['1@mastodon.social:home'] = {
                statuses: [createMockStatus('s1')],
                notifications: [],
                isLoading: false,
                hasMore: true,
                error: null,
            };
            render(<Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />);
            expect(mockObserve).toHaveBeenCalled();
        });

        it('should disconnect observer on unmount', () => {
            const { unmount } = render(
                <Column id="col-1" accountId="1@mastodon.social" stream={{ type: 'home' }} />
            );
            unmount();
            expect(mockDisconnect).toHaveBeenCalled();
        });
    });

    describe('callback propagation', () => {
        it('should pass onStatusClick to NotificationCard when provided', () => {
            const onStatusClick = vi.fn();
            mockStreamDataMap['1@mastodon.social:notifications'] = {
                statuses: [],
                notifications: [createMockNotification('n1')],
                isLoading: false,
                hasMore: true,
                error: null,
            };
            render(
                <Column
                    id="col-1"
                    accountId="1@mastodon.social"
                    stream={{ type: 'notifications' }}
                    onStatusClick={onStatusClick}
                />
            );

            const notification = screen.getByTestId('notification-n1');
            expect(notification).toHaveAttribute('data-has-status-click', 'true');
        });

        it('should not pass onStatusClick to NotificationCard when not provided', () => {
            mockStreamDataMap['1@mastodon.social:notifications'] = {
                statuses: [],
                notifications: [createMockNotification('n1')],
                isLoading: false,
                hasMore: true,
                error: null,
            };
            render(
                <Column
                    id="col-1"
                    accountId="1@mastodon.social"
                    stream={{ type: 'notifications' }}
                />
            );

            const notification = screen.getByTestId('notification-n1');
            expect(notification).toHaveAttribute('data-has-status-click', 'false');
        });

        it('should call onStatusClick with accountSessionId when NotificationCard callback is triggered', () => {
            const onStatusClick = vi.fn();
            const mockStatus = createMockStatus('test-status');
            mockStreamDataMap['1@mastodon.social:notifications'] = {
                statuses: [],
                notifications: [createMockNotification('n1')],
                isLoading: false,
                hasMore: true,
                error: null,
            };
            render(
                <Column
                    id="col-1"
                    accountId="1@mastodon.social"
                    stream={{ type: 'notifications' }}
                    onStatusClick={onStatusClick}
                />
            );

            // Simulate NotificationCard calling onStatusClick
            mockNotificationCardOnStatusClick(mockStatus);

            expect(onStatusClick).toHaveBeenCalledWith(mockStatus, '1@mastodon.social');
        });
    });
});
