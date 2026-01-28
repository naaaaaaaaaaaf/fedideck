import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusCard } from './StatusCard';
import { formatDate } from '../utils/dateFormat';
import type { mastodon } from 'masto';

// Minimal mock status for testing
const createMockStatus = (overrides: Partial<mastodon.v1.Status> = {}): mastodon.v1.Status => {
    const base = {
        id: '12345',
        createdAt: new Date().toISOString(),
        inReplyToId: null,
        inReplyToAccountId: null,
        sensitive: false,
        spoilerText: '',
        visibility: 'public',
        language: 'ja',
        uri: 'https://mastodon.social/statuses/12345',
        url: 'https://mastodon.social/@testuser/12345',
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
        account: {
            id: '1',
            username: 'testuser',
            acct: 'testuser',
            displayName: 'Test User',
            locked: false,
            bot: false,
            group: false,
            createdAt: new Date().toISOString(),
            note: '',
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
        },
        mediaAttachments: [],
        mentions: [],
        tags: [],
        emojis: [],
        card: null,
        poll: null,
        ...overrides,
    };
    return base as unknown as mastodon.v1.Status;
};

describe('StatusCard', () => {
    describe('rendering', () => {
        it('should render basic status content', () => {
            const status = createMockStatus({
                content: '<p>Hello World</p>',
            });

            render(<StatusCard status={status} />);

            expect(screen.getByText('Hello World')).toBeInTheDocument();
            expect(screen.getByText('Test User')).toBeInTheDocument();
            expect(screen.getByText('@testuser')).toBeInTheDocument();
        });

        it('should render nothing when account is missing', () => {
            const status = createMockStatus();
            // @ts-expect-error Testing null account scenario
            status.account = null;

            const { container } = render(<StatusCard status={status} />);

            expect(container.firstChild).toBeNull();
        });

        it('should handle undefined mediaAttachments (streaming data)', () => {
            const status = createMockStatus();
            // Simulate streaming data with undefined mediaAttachments
            // @ts-expect-error Testing undefined scenario from streaming
            status.mediaAttachments = undefined;

            // Should not throw
            expect(() => render(<StatusCard status={status} />)).not.toThrow();
        });

        it('should handle empty mediaAttachments array', () => {
            const status = createMockStatus({
                mediaAttachments: [],
            });

            render(<StatusCard status={status} />);

            // Should render without media section
            expect(screen.queryByRole('img', { name: /media/i })).not.toBeInTheDocument();
        });

        it('should render media attachments when present', () => {
            const status = createMockStatus({
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image.png',
                        previewUrl: 'https://example.com/preview.png',
                        remoteUrl: null,
                        meta: null,
                        description: 'Test image',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} />);

            const img = screen.getByAltText('Test image');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', 'https://example.com/preview.png');
        });

        it('should handle undefined poll', () => {
            const status = createMockStatus({
                poll: undefined,
            });

            expect(() => render(<StatusCard status={status} />)).not.toThrow();
        });

        it('should render poll when present', () => {
            const status = createMockStatus({
                poll: {
                    id: '1',
                    expiresAt: null,
                    expired: false,
                    multiple: false,
                    votesCount: 10,
                    votersCount: 10,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 7, emojis: [] },
                        { title: 'Option B', votesCount: 3, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            render(<StatusCard status={status} />);

            expect(screen.getByText('Option A')).toBeInTheDocument();
            expect(screen.getByText('Option B')).toBeInTheDocument();
            expect(screen.getByText('70%')).toBeInTheDocument();
            expect(screen.getByText('30%')).toBeInTheDocument();
        });

        it('should handle content warning (spoilerText)', () => {
            const status = createMockStatus({
                spoilerText: 'Spoiler warning!',
                content: '<p>Hidden content</p>',
            });

            render(<StatusCard status={status} />);

            expect(screen.getByText(/Spoiler warning!/)).toBeInTheDocument();
            // Content should be in details element (collapsed by default)
            const details = document.querySelector('details');
            expect(details).toBeInTheDocument();
        });

        it('should render reblog indicator', () => {
            const originalStatus = createMockStatus({
                account: {
                    ...createMockStatus().account,
                    displayName: 'Original Author',
                    username: 'original',
                },
            });

            const reblogStatus = createMockStatus({
                reblog: originalStatus,
                account: {
                    ...createMockStatus().account,
                    displayName: 'Reblogger',
                    username: 'reblogger',
                },
            });

            render(<StatusCard status={reblogStatus} />);

            expect(screen.getByText(/Reblogger がブースト/)).toBeInTheDocument();
            expect(screen.getByText('Original Author')).toBeInTheDocument();
        });
    });

    describe('formatDate', () => {
        it('should return "今" for recent dates', () => {
            const now = new Date().toISOString();
            expect(formatDate(now)).toBe('今');
        });

        it('should return minutes for dates within an hour', () => {
            const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            expect(formatDate(thirtyMinsAgo)).toBe('30分');
        });

        it('should return hours for dates within a day', () => {
            const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
            expect(formatDate(fiveHoursAgo)).toBe('5時間');
        });

        it('should return days for dates within a week', () => {
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
            expect(formatDate(threeDaysAgo)).toBe('3日');
        });
    });

    describe('card click', () => {
        it('should call onStatusClick when card content is clicked', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                content: '<p>Clickable content</p>',
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            // Click on the content area
            const content = screen.getByText('Clickable content');
            await user.click(content);

            expect(onStatusClick).toHaveBeenCalledTimes(1);
            expect(onStatusClick).toHaveBeenCalledWith(expect.objectContaining({
                id: '12345',
            }));
        });

        it('should NOT call onStatusClick when clicking a link', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                content: '<p>Text with <a href="https://example.com">link</a></p>',
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            const link = screen.getByRole('link', { name: 'link' });
            await user.click(link);

            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should NOT call onStatusClick when clicking a button', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const onReply = vi.fn();
            const status = createMockStatus();

            render(<StatusCard status={status} onStatusClick={onStatusClick} onReply={onReply} />);

            const replyButton = screen.getAllByRole('button')[0];
            await user.click(replyButton);

            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should call onStatusClick with original status when clicking reblog card', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const originalStatus = createMockStatus({
                id: 'original-123',
                content: '<p>Original content</p>',
                account: {
                    ...createMockStatus().account,
                    displayName: 'Original Author',
                },
            });

            const reblogStatus = createMockStatus({
                id: 'reblog-456',
                reblog: originalStatus,
            });

            render(<StatusCard status={reblogStatus} onStatusClick={onStatusClick} />);

            const content = screen.getByText('Original content');
            await user.click(content);

            // Should pass original status, not the reblog wrapper
            expect(onStatusClick).toHaveBeenCalledWith(expect.objectContaining({
                id: 'original-123',
            }));
        });

        it('should call onStatusClick when pressing Enter on focusable card', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                content: '<p>Keyboard navigable content</p>',
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            const article = screen.getByRole('article');
            article.focus();
            await user.keyboard('{Enter}');

            expect(onStatusClick).toHaveBeenCalledTimes(1);
            expect(onStatusClick).toHaveBeenCalledWith(expect.objectContaining({
                id: '12345',
            }));
        });

        it('should call onStatusClick when pressing Space on focusable card', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                content: '<p>Keyboard navigable content</p>',
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            const article = screen.getByRole('article');
            article.focus();
            await user.keyboard(' ');

            expect(onStatusClick).toHaveBeenCalledTimes(1);
            expect(onStatusClick).toHaveBeenCalledWith(expect.objectContaining({
                id: '12345',
            }));
        });

        it('should not have keyboard handler when onStatusClick is not provided', () => {
            const status = createMockStatus({
                content: '<p>Non-clickable content</p>',
            });

            render(<StatusCard status={status} />);

            const article = screen.getByRole('article');
            
            // When onStatusClick is not provided, the card should not be keyboard-interactive
            // Check that tabIndex is not set (making it non-focusable via keyboard)
            expect(article).not.toHaveAttribute('tabindex');
            
            // Alternatively, verify that attempting keyboard interaction does nothing
            // (no focus is actually set since tabIndex is undefined)
            article.focus();
            expect(document.activeElement).not.toBe(article);
        });
    });

    describe('reply indicator', () => {
        it('should show reply indicator when status is a reply', () => {
            const status = createMockStatus({
                inReplyToId: 'parent-123',
                inReplyToAccountId: '999',
                mentions: [
                    {
                        id: '999',
                        username: 'parentuser',
                        acct: 'parentuser@other.social',
                        url: 'https://other.social/@parentuser',
                    } as mastodon.v1.StatusMention,
                ],
            });

            render(<StatusCard status={status} onStatusClick={vi.fn()} />);

            expect(screen.getByText('@parentuser@other.social への返信')).toBeInTheDocument();
        });

        it('should show generic reply text when mention is not found', () => {
            const status = createMockStatus({
                inReplyToId: 'parent-123',
                inReplyToAccountId: '999',
                mentions: [], // No matching mention
            });

            render(<StatusCard status={status} onStatusClick={vi.fn()} />);

            expect(screen.getByText('返信')).toBeInTheDocument();
        });

        it('should not show reply indicator when not a reply', () => {
            const status = createMockStatus({
                inReplyToId: null,
            });

            render(<StatusCard status={status} onStatusClick={vi.fn()} />);

            expect(screen.queryByText(/への返信/)).not.toBeInTheDocument();
            expect(screen.queryByText(/^返信$/)).not.toBeInTheDocument();
        });

        it('should call onStatusClick when reply indicator is clicked', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                inReplyToId: 'parent-123',
                inReplyToAccountId: '999',
                mentions: [
                    {
                        id: '999',
                        username: 'parentuser',
                        acct: 'parentuser',
                        url: 'https://mastodon.social/@parentuser',
                    } as mastodon.v1.StatusMention,
                ],
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            const replyIndicator = screen.getByText('@parentuser への返信');
            await user.click(replyIndicator);

            expect(onStatusClick).toHaveBeenCalledTimes(1);
            expect(onStatusClick).toHaveBeenCalledWith(expect.objectContaining({
                id: '12345',
            }));
        });

        it('should call onStatusClick when pressing Enter on reply indicator', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                inReplyToId: 'parent-123',
                inReplyToAccountId: '999',
                mentions: [],
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            // Use click followed by keyboard to ensure element is focused
            const replyIndicator = screen.getByRole('button', { name: 'スレッドを表示' });
            await user.click(replyIndicator);

            // Reset mock and test keyboard navigation
            onStatusClick.mockClear();
            await user.keyboard('{Enter}');

            expect(onStatusClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('reply button', () => {
        it('should call onReply with displayStatus when reply button is clicked', async () => {
            const user = userEvent.setup();
            const onReply = vi.fn();
            const status = createMockStatus({
                content: '<p>Test post</p>',
            });

            render(<StatusCard status={status} onReply={onReply} />);

            // Find and click the reply button (first button in action bar)
            const replyButton = screen.getAllByRole('button')[0];
            await user.click(replyButton);

            expect(onReply).toHaveBeenCalledTimes(1);
            expect(onReply).toHaveBeenCalledWith(expect.objectContaining({
                id: '12345',
                content: '<p>Test post</p>',
            }));
        });

        it('should call onReply with original status when clicking reblog reply button', async () => {
            const user = userEvent.setup();
            const onReply = vi.fn();
            const originalStatus = createMockStatus({
                id: 'original-123',
                content: '<p>Original content</p>',
                account: {
                    ...createMockStatus().account,
                    displayName: 'Original Author',
                },
            });

            const reblogStatus = createMockStatus({
                id: 'reblog-456',
                reblog: originalStatus,
            });

            render(<StatusCard status={reblogStatus} onReply={onReply} />);

            const replyButton = screen.getAllByRole('button')[0];
            await user.click(replyButton);

            // Should reply to original status, not the reblog wrapper
            expect(onReply).toHaveBeenCalledWith(expect.objectContaining({
                id: 'original-123',
                content: '<p>Original content</p>',
            }));
        });
    });
});
