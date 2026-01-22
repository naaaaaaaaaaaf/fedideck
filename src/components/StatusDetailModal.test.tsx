import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusDetailModal } from './StatusDetailModal';
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
        reblogsCount: 5,
        favouritesCount: 10,
        editedAt: null,
        favourited: false,
        reblogged: false,
        muted: false,
        bookmarked: false,
        pinned: false,
        content: '<p>Test content for detail modal</p>',
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

describe('StatusDetailModal', () => {
    describe('rendering', () => {
        it('should not render when isOpen is false', () => {
            const status = createMockStatus();
            render(
                <StatusDetailModal
                    isOpen={false}
                    onClose={() => {}}
                    status={status}
                />
            );

            expect(screen.queryByText('投稿の詳細')).not.toBeInTheDocument();
        });

        it('should not render when status is null', () => {
            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={null}
                />
            );

            expect(screen.queryByText('投稿の詳細')).not.toBeInTheDocument();
        });

        it('should render modal when isOpen is true and status is provided', () => {
            const status = createMockStatus();
            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                />
            );

            expect(screen.getByText('投稿の詳細')).toBeInTheDocument();
            expect(screen.getByText('Test content for detail modal')).toBeInTheDocument();
            expect(screen.getByText('Test User')).toBeInTheDocument();
            expect(screen.getByText('@testuser')).toBeInTheDocument();
        });

        it('should display boost and favourite counts', () => {
            const status = createMockStatus({
                reblogsCount: 5,
                favouritesCount: 10,
            });
            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                />
            );

            expect(screen.getByText('5')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it('should render content warning when spoilerText is present', () => {
            const status = createMockStatus({
                spoilerText: 'Warning: sensitive content',
                content: '<p>Hidden content</p>',
            });
            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                />
            );

            expect(screen.getByText(/Warning: sensitive content/)).toBeInTheDocument();
        });

        it('should render reblog indicator when status is a reblog', () => {
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

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={reblogStatus}
                />
            );

            expect(screen.getByText(/Reblogger がブースト/)).toBeInTheDocument();
            expect(screen.getByText('Original Author')).toBeInTheDocument();
        });
    });

    describe('interactions', () => {
        it('should call onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            const status = createMockStatus();

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={onClose}
                    status={status}
                />
            );

            const closeButton = screen.getAllByRole('button').find(
                btn => btn.querySelector('svg')
            );
            expect(closeButton).toBeDefined();
            await user.click(closeButton!);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when backdrop is clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            const status = createMockStatus();

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={onClose}
                    status={status}
                />
            );

            // Click on the backdrop (first div after fixed container)
            const backdrop = document.querySelector('.fixed > .absolute');
            expect(backdrop).toBeDefined();
            await user.click(backdrop!);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should call onReply and onClose when reply button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            const onReply = vi.fn();
            const status = createMockStatus();

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={onClose}
                    onReply={onReply}
                    status={status}
                />
            );

            const replyButton = screen.getByRole('button', { name: /返信/ });
            await user.click(replyButton);

            expect(onReply).toHaveBeenCalledTimes(1);
            expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ id: '12345' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('media attachments', () => {
        it('should render image attachments', () => {
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

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                />
            );

            const img = screen.getByAltText('Test image');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', 'https://example.com/image.png');
        });
    });

    describe('poll', () => {
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

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                />
            );

            expect(screen.getByText('Option A')).toBeInTheDocument();
            expect(screen.getByText('Option B')).toBeInTheDocument();
            expect(screen.getByText('70%')).toBeInTheDocument();
            expect(screen.getByText('30%')).toBeInTheDocument();
        });
    });
});
