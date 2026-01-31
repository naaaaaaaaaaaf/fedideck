import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationCard } from './NotificationCard';
import type { mastodon } from 'masto';

const createMockAccount = (overrides: Partial<mastodon.v1.Account> = {}): mastodon.v1.Account => ({
    id: '1',
    username: 'testuser',
    acct: 'testuser',
    displayName: 'Test User',
    locked: false,
    bot: false,
    group: false,
    createdAt: new Date().toISOString(),
    note: '<p>Hello world</p>',
    url: 'https://mastodon.social/@testuser',
    avatar: 'https://example.com/avatar.png',
    avatarStatic: 'https://example.com/avatar.png',
    header: 'https://example.com/header.png',
    headerStatic: 'https://example.com/header.png',
    followersCount: 100,
    followingCount: 50,
    statusesCount: 200,
    lastStatusAt: null,
    emojis: [],
    fields: [],
    roles: [],
    ...overrides,
} as mastodon.v1.Account);

const createMockStatus = (overrides: Partial<mastodon.v1.Status> = {}): mastodon.v1.Status => ({
    id: '1',
    createdAt: new Date().toISOString(),
    inReplyToId: null,
    inReplyToAccountId: null,
    sensitive: false,
    spoilerText: '',
    visibility: 'public',
    language: 'ja',
    uri: 'https://mastodon.social/statuses/1',
    url: 'https://mastodon.social/@testuser/1',
    repliesCount: 0,
    reblogsCount: 0,
    favouritesCount: 0,
    editedAt: null,
    favourited: false,
    reblogged: false,
    muted: false,
    bookmarked: false,
    pinned: false,
    content: '<p>Test content</p>',
    filtered: [],
    reblog: null,
    application: null,
    account: createMockAccount(),
    mediaAttachments: [],
    mentions: [],
    tags: [],
    emojis: [],
    card: null,
    poll: null,
    ...overrides,
} as unknown as mastodon.v1.Status);

const createMockNotification = (
    type: string,
    overrides: Partial<mastodon.v1.Notification> = {}
): mastodon.v1.Notification => ({
    id: '1',
    type,
    createdAt: new Date().toISOString(),
    account: createMockAccount(),
    ...overrides,
} as mastodon.v1.Notification);

describe('NotificationCard', () => {
    describe('notification types', () => {
        it('should display mention notification', () => {
            const notification = createMockNotification('mention', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/メンション/)).toBeInTheDocument();
        });

        it('should display reblog notification', () => {
            const notification = createMockNotification('reblog', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/ブースト/)).toBeInTheDocument();
        });

        it('should display favourite notification', () => {
            const notification = createMockNotification('favourite', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/お気に入り/)).toBeInTheDocument();
        });

        it('should display follow notification', () => {
            const notification = createMockNotification('follow');
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/フォロー/)).toBeInTheDocument();
        });

        it('should display follow_request notification', () => {
            const notification = createMockNotification('follow_request');
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/フォローリクエスト/)).toBeInTheDocument();
        });

        it('should display poll notification', () => {
            const notification = createMockNotification('poll', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/投票終了/)).toBeInTheDocument();
        });

        it('should display status notification', () => {
            const notification = createMockNotification('status', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/新規投稿/)).toBeInTheDocument();
        });

        it('should display update notification', () => {
            const notification = createMockNotification('update', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/編集/)).toBeInTheDocument();
        });

        it('should display admin.sign_up notification', () => {
            const notification = createMockNotification('admin.sign_up');
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/新規登録/)).toBeInTheDocument();
        });

        it('should display admin.report notification', () => {
            const notification = createMockNotification('admin.report');
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/通報/)).toBeInTheDocument();
        });

        it('should display unknown type with its raw type string', () => {
            const notification = createMockNotification('custom_type');
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/custom_type/)).toBeInTheDocument();
        });
    });

    describe('account display', () => {
        it('should display account avatar', () => {
            const notification = createMockNotification('mention', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} />);
            const avatars = screen.getAllByAltText('Test User');
            expect(avatars[0]).toHaveAttribute('src', 'https://example.com/avatar.png');
        });

        it('should display displayName', () => {
            const notification = createMockNotification('mention', {
                account: createMockAccount({ displayName: 'Custom Name' }),
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText('Custom Name')).toBeInTheDocument();
        });

        it('should fallback to username when displayName is empty', () => {
            const notification = createMockNotification('mention', {
                account: createMockAccount({ displayName: '', username: 'fallbackuser' }),
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getAllByText('fallbackuser').length).toBeGreaterThan(0);
        });
    });

    describe('status content', () => {
        it('should display status content for status-related notifications', () => {
            const notification = createMockNotification('favourite', {
                status: createMockStatus({ content: '<p>Liked post</p>' }),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText('Liked post')).toBeInTheDocument();
        });

        it('should display spoilerText in details/summary', () => {
            const notification = createMockNotification('mention', {
                status: createMockStatus({
                    spoilerText: 'CW: spoiler',
                    content: '<p>Hidden content</p>',
                }),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText(/CW: spoiler/)).toBeInTheDocument();
            const details = document.querySelector('details');
            expect(details).toBeInTheDocument();
        });

        it('should display media attachment thumbnails', () => {
            const notification = createMockNotification('mention', {
                status: createMockStatus({
                    mediaAttachments: [
                        {
                            id: 'media1',
                            type: 'image',
                            url: 'https://example.com/image.png',
                            previewUrl: 'https://example.com/preview.png',
                            description: 'A test image',
                        } as mastodon.v1.MediaAttachment,
                    ],
                }),
            });
            render(<NotificationCard notification={notification} />);
            const img = screen.getByAltText('A test image');
            expect(img).toHaveAttribute('src', 'https://example.com/preview.png');
        });

        it('should use fallback alt text for media without description', () => {
            const notification = createMockNotification('mention', {
                status: createMockStatus({
                    mediaAttachments: [
                        {
                            id: 'media1',
                            type: 'image',
                            url: 'https://example.com/image.png',
                            previewUrl: undefined,
                            description: '',
                        } as unknown as mastodon.v1.MediaAttachment,
                    ],
                }),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByAltText('添付メディア')).toBeInTheDocument();
        });

        it('should not display status area when status is absent', () => {
            const notification = createMockNotification('follow');
            render(<NotificationCard notification={notification} />);
            expect(screen.queryByText('Test content')).not.toBeInTheDocument();
        });
    });

    describe('follow notification', () => {
        it('should show account details for follow notifications', () => {
            const notification = createMockNotification('follow', {
                account: createMockAccount({
                    displayName: 'Follower Name',
                    acct: 'follower@remote.social',
                    note: '<p>My bio</p>',
                }),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText('@follower@remote.social')).toBeInTheDocument();
            expect(screen.getByText('My bio')).toBeInTheDocument();
        });

        it('should show approve/reject buttons for follow_request', () => {
            const notification = createMockNotification('follow_request', {
                account: createMockAccount({ displayName: 'Requester' }),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText('承認')).toBeInTheDocument();
            expect(screen.getByText('拒否')).toBeInTheDocument();
        });

        it('should have aria-labels on follow_request buttons', () => {
            const notification = createMockNotification('follow_request', {
                account: createMockAccount({ displayName: 'Requester' }),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByLabelText('Requesterのフォローリクエストを承認')).toBeInTheDocument();
            expect(screen.getByLabelText('Requesterのフォローリクエストを拒否')).toBeInTheDocument();
        });
    });

    describe('date formatting', () => {
        it('should show "今" for just now', () => {
            const notification = createMockNotification('follow', {
                createdAt: new Date().toISOString(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText('今')).toBeInTheDocument();
        });

        it('should show minutes for recent notifications', () => {
            const notification = createMockNotification('follow', {
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText('5分')).toBeInTheDocument();
        });

        it('should show hours for notifications within a day', () => {
            const notification = createMockNotification('follow', {
                createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText('3時間')).toBeInTheDocument();
        });

        it('should show days for notifications within a week', () => {
            const notification = createMockNotification('follow', {
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            });
            render(<NotificationCard notification={notification} />);
            expect(screen.getByText('2日')).toBeInTheDocument();
        });
    });

    describe('status click callback', () => {
        it('should call onStatusClick when status area is clicked for mention notification', async () => {
            const onStatusClick = vi.fn();
            const mockStatus = createMockStatus({ content: '<p>Test mention</p>' });
            const notification = createMockNotification('mention', {
                status: mockStatus,
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const statusArea = screen.getByRole('button', { name: '投稿の詳細を表示' });
            await userEvent.click(statusArea);

            expect(onStatusClick).toHaveBeenCalledTimes(1);
            expect(onStatusClick).toHaveBeenCalledWith(mockStatus);
        });

        it('should call onStatusClick when status area is clicked for reblog notification', async () => {
            const onStatusClick = vi.fn();
            const mockStatus = createMockStatus();
            const notification = createMockNotification('reblog', {
                status: mockStatus,
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const statusArea = screen.getByRole('button', { name: '投稿の詳細を表示' });
            await userEvent.click(statusArea);

            expect(onStatusClick).toHaveBeenCalledWith(mockStatus);
        });

        it('should call onStatusClick when status area is clicked for favourite notification', async () => {
            const onStatusClick = vi.fn();
            const mockStatus = createMockStatus();
            const notification = createMockNotification('favourite', {
                status: mockStatus,
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const statusArea = screen.getByRole('button', { name: '投稿の詳細を表示' });
            await userEvent.click(statusArea);

            expect(onStatusClick).toHaveBeenCalledWith(mockStatus);
        });

        it('should call onStatusClick when status area is clicked for poll notification', async () => {
            const onStatusClick = vi.fn();
            const mockStatus = createMockStatus();
            const notification = createMockNotification('poll', {
                status: mockStatus,
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const statusArea = screen.getByRole('button', { name: '投稿の詳細を表示' });
            await userEvent.click(statusArea);

            expect(onStatusClick).toHaveBeenCalledWith(mockStatus);
        });

        it('should call onStatusClick when status area is clicked for status notification', async () => {
            const onStatusClick = vi.fn();
            const mockStatus = createMockStatus();
            const notification = createMockNotification('status', {
                status: mockStatus,
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const statusArea = screen.getByRole('button', { name: '投稿の詳細を表示' });
            await userEvent.click(statusArea);

            expect(onStatusClick).toHaveBeenCalledWith(mockStatus);
        });

        it('should call onStatusClick when status area is clicked for update notification', async () => {
            const onStatusClick = vi.fn();
            const mockStatus = createMockStatus();
            const notification = createMockNotification('update', {
                status: mockStatus,
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const statusArea = screen.getByRole('button', { name: '投稿の詳細を表示' });
            await userEvent.click(statusArea);

            expect(onStatusClick).toHaveBeenCalledWith(mockStatus);
        });

        it('should not have clickable status area for follow notification (no status)', () => {
            const onStatusClick = vi.fn();
            const notification = createMockNotification('follow');
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            expect(screen.queryByRole('button', { name: '投稿の詳細を表示' })).not.toBeInTheDocument();
        });

        it('should not have clickable status area for follow_request notification (no status)', () => {
            const onStatusClick = vi.fn();
            const notification = createMockNotification('follow_request');
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            expect(screen.queryByRole('button', { name: '投稿の詳細を表示' })).not.toBeInTheDocument();
        });
    });

    describe('interactive elements exclusion', () => {
        it('should not call onStatusClick when clicking on a link', async () => {
            const onStatusClick = vi.fn();
            const notification = createMockNotification('mention', {
                status: createMockStatus({ content: '<p><a href="https://example.com">Link</a></p>' }),
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const link = screen.getByRole('link', { name: 'Link' });
            await userEvent.click(link);

            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should not call onStatusClick when clicking on CW summary', async () => {
            const onStatusClick = vi.fn();
            const notification = createMockNotification('mention', {
                status: createMockStatus({
                    spoilerText: 'CW: spoiler',
                    content: '<p>Hidden content</p>',
                }),
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const summary = screen.getByText(/CW: spoiler/);
            await userEvent.click(summary);

            expect(onStatusClick).not.toHaveBeenCalled();
        });
    });

    describe('keyboard navigation', () => {
        it('should call onStatusClick when Enter key is pressed on status area', () => {
            const onStatusClick = vi.fn();
            const mockStatus = createMockStatus();
            const notification = createMockNotification('mention', {
                status: mockStatus,
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const statusArea = screen.getByRole('button', { name: '投稿の詳細を表示' });
            fireEvent.keyDown(statusArea, { key: 'Enter' });

            expect(onStatusClick).toHaveBeenCalledWith(mockStatus);
        });

        it('should call onStatusClick when Space key is pressed on status area', () => {
            const onStatusClick = vi.fn();
            const mockStatus = createMockStatus();
            const notification = createMockNotification('mention', {
                status: mockStatus,
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const statusArea = screen.getByRole('button', { name: '投稿の詳細を表示' });
            fireEvent.keyDown(statusArea, { key: ' ' });

            expect(onStatusClick).toHaveBeenCalledWith(mockStatus);
        });

        it('should not call onStatusClick when other keys are pressed', () => {
            const onStatusClick = vi.fn();
            const notification = createMockNotification('mention', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const statusArea = screen.getByRole('button', { name: '投稿の詳細を表示' });
            fireEvent.keyDown(statusArea, { key: 'Tab' });

            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should not call onStatusClick when Enter is pressed on a link', () => {
            const onStatusClick = vi.fn();
            const notification = createMockNotification('mention', {
                status: createMockStatus({ content: '<p><a href="https://example.com">Link</a></p>' }),
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const link = screen.getByRole('link', { name: 'Link' });
            fireEvent.keyDown(link, { key: 'Enter' });

            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should not call onStatusClick when Space is pressed on a link', () => {
            const onStatusClick = vi.fn();
            const notification = createMockNotification('mention', {
                status: createMockStatus({ content: '<p><a href="https://example.com">Link</a></p>' }),
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const link = screen.getByRole('link', { name: 'Link' });
            fireEvent.keyDown(link, { key: ' ' });

            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should not call onStatusClick when Enter is pressed on CW summary', () => {
            const onStatusClick = vi.fn();
            const notification = createMockNotification('mention', {
                status: createMockStatus({
                    spoilerText: 'CW: spoiler',
                    content: '<p>Hidden content</p>',
                }),
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const summary = screen.getByText(/CW: spoiler/);
            fireEvent.keyDown(summary, { key: 'Enter' });

            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should not call onStatusClick when Space is pressed on CW summary', () => {
            const onStatusClick = vi.fn();
            const notification = createMockNotification('mention', {
                status: createMockStatus({
                    spoilerText: 'CW: spoiler',
                    content: '<p>Hidden content</p>',
                }),
            });
            render(<NotificationCard notification={notification} onStatusClick={onStatusClick} />);

            const summary = screen.getByText(/CW: spoiler/);
            fireEvent.keyDown(summary, { key: ' ' });

            expect(onStatusClick).not.toHaveBeenCalled();
        });
    });

    describe('accessibility', () => {
        it('should have role="button" when onStatusClick is provided and status exists', () => {
            const notification = createMockNotification('mention', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} onStatusClick={() => {}} />);

            expect(screen.getByRole('button', { name: '投稿の詳細を表示' })).toBeInTheDocument();
        });

        it('should have tabIndex=0 when onStatusClick is provided and status exists', () => {
            const notification = createMockNotification('mention', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} onStatusClick={() => {}} />);

            const statusArea = screen.getByRole('button', { name: '投稿の詳細を表示' });
            expect(statusArea).toHaveAttribute('tabIndex', '0');
        });

        it('should have aria-label when onStatusClick is provided and status exists', () => {
            const notification = createMockNotification('mention', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} onStatusClick={() => {}} />);

            expect(screen.getByLabelText('投稿の詳細を表示')).toBeInTheDocument();
        });

        it('should not have button role when onStatusClick is not provided', () => {
            const notification = createMockNotification('mention', {
                status: createMockStatus(),
            });
            render(<NotificationCard notification={notification} />);

            expect(screen.queryByRole('button', { name: '投稿の詳細を表示' })).not.toBeInTheDocument();
        });

        it('should not have tabIndex when onStatusClick is not provided', () => {
            const notification = createMockNotification('mention', {
                status: createMockStatus(),
            });
            const { container } = render(<NotificationCard notification={notification} />);

            const statusArea = container.querySelector('.ml-9.p-3');
            expect(statusArea).not.toHaveAttribute('tabIndex');
        });
    });
});
