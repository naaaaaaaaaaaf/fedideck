import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusCard, formatDate } from './StatusCard';
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
});
