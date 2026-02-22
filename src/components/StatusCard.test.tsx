import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusCard } from './StatusCard';
import { formatDate } from '../utils/dateFormat';
import type { mastodon } from 'masto';
import type { AccountSession } from '../api/mastoClient';
import * as mastoClient from '../api/mastoClient';

// Mock votePoll for API testing
vi.mock('../api/mastoClient', async (importOriginal) => {
    const actual = await importOriginal<typeof mastoClient>();
    return {
        ...actual,
        votePoll: vi.fn(),
    };
});

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

            // Reblogger name is rendered via DisplayName component
            expect(screen.getByText(/がブースト/)).toBeInTheDocument();
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
            expect(onStatusClick).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '12345',
                })
            );
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
            expect(onStatusClick).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'original-123',
                })
            );
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
            expect(onStatusClick).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '12345',
                })
            );
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
            expect(onStatusClick).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '12345',
                })
            );
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
            expect(onStatusClick).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '12345',
                })
            );
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

    describe('image click', () => {
        it('should call onImageClick when an image is clicked', async () => {
            const user = userEvent.setup();
            const onImageClick = vi.fn();
            const status = createMockStatus({
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image1.png',
                        previewUrl: 'https://example.com/preview1.png',
                        remoteUrl: null,
                        meta: null,
                        description: 'First image',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} onImageClick={onImageClick} />);

            const img = screen.getByAltText('First image');
            await user.click(img);

            expect(onImageClick).toHaveBeenCalledTimes(1);
            expect(onImageClick).toHaveBeenCalledWith(
                [
                    {
                        url: 'https://example.com/image1.png',
                        previewUrl: 'https://example.com/preview1.png',
                        description: 'First image',
                    },
                ],
                0
            );
        });

        it('should call onImageClick with correct index for multiple images', async () => {
            const user = userEvent.setup();
            const onImageClick = vi.fn();
            const status = createMockStatus({
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image1.png',
                        previewUrl: 'https://example.com/preview1.png',
                        description: 'First image',
                    } as mastodon.v1.MediaAttachment,
                    {
                        id: '2',
                        type: 'image',
                        url: 'https://example.com/image2.png',
                        previewUrl: 'https://example.com/preview2.png',
                        description: 'Second image',
                    } as mastodon.v1.MediaAttachment,
                    {
                        id: '3',
                        type: 'image',
                        url: 'https://example.com/image3.png',
                        previewUrl: 'https://example.com/preview3.png',
                        description: 'Third image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} onImageClick={onImageClick} />);

            // Click the second image
            const secondImg = screen.getByAltText('Second image');
            await user.click(secondImg);

            expect(onImageClick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ url: 'https://example.com/image1.png' }),
                    expect.objectContaining({ url: 'https://example.com/image2.png' }),
                    expect.objectContaining({ url: 'https://example.com/image3.png' }),
                ]),
                1 // index of second image
            );
        });

        it('should render video with anchor tag to open in new tab', async () => {
            const onImageClick = vi.fn();
            const status = createMockStatus({
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'video',
                        url: 'https://example.com/video.mp4',
                        previewUrl: 'https://example.com/video-poster.png',
                        remoteUrl: null,
                        meta: null,
                        description: 'Test video',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            const { container } = render(
                <StatusCard status={status} onImageClick={onImageClick} />
            );

            // Video should be in an anchor tag, not in a div or button
            const videoLink = container.querySelector('a[href="https://example.com/video.mp4"]');
            expect(videoLink).toBeInTheDocument();
            expect(videoLink).toHaveAttribute('target', '_blank');
            expect(videoLink).toHaveAttribute('rel', 'noopener noreferrer');

            // Video element should not have controls (it's a preview)
            const video = container.querySelector('video');
            expect(video).toBeInTheDocument();
            expect(video).not.toHaveAttribute('controls');
        });

        it('should render gifv as anchor tag to open in new tab', async () => {
            const onImageClick = vi.fn();
            const status = createMockStatus({
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'gifv',
                        url: 'https://example.com/animation.mp4',
                        previewUrl: 'https://example.com/animation-poster.png',
                        remoteUrl: null,
                        meta: null,
                        description: 'Test animation',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            const { container } = render(
                <StatusCard status={status} onImageClick={onImageClick} />
            );

            // gifv should be in an anchor tag
            const gifvLink = container.querySelector('a[href="https://example.com/animation.mp4"]');
            expect(gifvLink).toBeInTheDocument();
            expect(gifvLink).toHaveAttribute('target', '_blank');
            expect(gifvLink).toHaveAttribute('rel', 'noopener noreferrer');
            expect(gifvLink).toHaveAttribute('aria-label', 'Test animation');

            // Video element should not autoplay in card variant
            const video = container.querySelector('video');
            expect(video).toBeInTheDocument();
            expect(video).not.toHaveAttribute('autoPlay');
            expect(video).toHaveAttribute('loop');
        });

        it('should NOT trigger card click when image is clicked', async () => {
            const user = userEvent.setup();
            const onImageClick = vi.fn();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image1.png',
                        previewUrl: 'https://example.com/preview1.png',
                        description: 'Test image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(
                <StatusCard
                    status={status}
                    onImageClick={onImageClick}
                    onStatusClick={onStatusClick}
                />
            );

            const img = screen.getByAltText('Test image');
            await user.click(img);

            // onImageClick should be called
            expect(onImageClick).toHaveBeenCalledTimes(1);
            // onStatusClick should NOT be called (event propagation stopped)
            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should handle mixed media types correctly (images only in viewer)', async () => {
            const user = userEvent.setup();
            const onImageClick = vi.fn();
            const status = createMockStatus({
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image1.png',
                        previewUrl: 'https://example.com/preview1.png',
                        description: 'First image',
                    } as mastodon.v1.MediaAttachment,
                    {
                        id: '2',
                        type: 'video',
                        url: 'https://example.com/video.mp4',
                        previewUrl: 'https://example.com/video-poster.png',
                        description: 'Video',
                    } as mastodon.v1.MediaAttachment,
                    {
                        id: '3',
                        type: 'image',
                        url: 'https://example.com/image2.png',
                        previewUrl: 'https://example.com/preview2.png',
                        description: 'Second image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} onImageClick={onImageClick} />);

            // Click the second image (which appears after a video in the list)
            const secondImg = screen.getByAltText('Second image');
            await user.click(secondImg);

            // The images array passed to onImageClick should only contain images
            expect(onImageClick).toHaveBeenCalledWith(
                [
                    {
                        url: 'https://example.com/image1.png',
                        previewUrl: 'https://example.com/preview1.png',
                        description: 'First image',
                    },
                    {
                        url: 'https://example.com/image2.png',
                        previewUrl: 'https://example.com/preview2.png',
                        description: 'Second image',
                    },
                ],
                1 // Second image is at index 1 in the images-only array
            );
        });
    });

    describe('custom emoji in display name', () => {
        it('should render custom emoji in display name as images', () => {
            const status = createMockStatus({
                account: {
                    ...createMockStatus().account,
                    displayName: 'User :blobcat:',
                    emojis: [
                        {
                            shortcode: 'blobcat',
                            url: 'https://example.com/emoji/blobcat.png',
                            staticUrl: 'https://example.com/emoji/blobcat.png',
                            visibleInPicker: true,
                        } as mastodon.v1.CustomEmoji,
                    ],
                },
            });

            render(<StatusCard status={status} />);

            const emojiImg = screen.getByAltText(':blobcat:');
            expect(emojiImg).toBeInTheDocument();
            expect(emojiImg).toHaveAttribute('src', 'https://example.com/emoji/blobcat.png');
            expect(emojiImg).toHaveClass('emoji');
        });

        it('should render plain text when emojis array is empty', () => {
            const status = createMockStatus({
                account: {
                    ...createMockStatus().account,
                    displayName: 'Plain User :notfound:',
                    emojis: [],
                },
            });

            render(<StatusCard status={status} />);

            expect(screen.getByText('Plain User :notfound:')).toBeInTheDocument();
            // No emoji images should be rendered for shortcodes without matching emoji
            const emojiImages = document.querySelectorAll('img.emoji');
            expect(emojiImages.length).toBe(0);
        });

        it('should render custom emoji in reblogger display name', () => {
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
                    displayName: 'Reblogger :star:',
                    username: 'reblogger',
                    emojis: [
                        {
                            shortcode: 'star',
                            url: 'https://example.com/emoji/star.png',
                            staticUrl: 'https://example.com/emoji/star.png',
                            visibleInPicker: true,
                        } as mastodon.v1.CustomEmoji,
                    ],
                },
            });

            render(<StatusCard status={reblogStatus} />);

            const emojiImg = screen.getByAltText(':star:');
            expect(emojiImg).toBeInTheDocument();
            expect(emojiImg).toHaveAttribute('src', 'https://example.com/emoji/star.png');
        });
    });

    describe('custom emoji in status content', () => {
        it('should render custom emoji in post content as images', () => {
            const status = createMockStatus({
                content: '<p>Hello :blobcat: world</p>',
                emojis: [
                    {
                        shortcode: 'blobcat',
                        url: 'https://example.com/emoji/blobcat.png',
                        staticUrl: 'https://example.com/emoji/blobcat.png',
                        visibleInPicker: true,
                    } as mastodon.v1.CustomEmoji,
                ],
            });

            render(<StatusCard status={status} />);

            const emojiImg = screen.getByAltText(':blobcat:');
            expect(emojiImg).toBeInTheDocument();
            expect(emojiImg).toHaveAttribute('src', 'https://example.com/emoji/blobcat.png');
            expect(emojiImg).toHaveClass('emoji');
        });

        it('should render multiple custom emojis in content', () => {
            const status = createMockStatus({
                content: '<p>:cat: and :dog:</p>',
                emojis: [
                    {
                        shortcode: 'cat',
                        url: 'https://example.com/emoji/cat.png',
                        staticUrl: 'https://example.com/emoji/cat.png',
                        visibleInPicker: true,
                    } as mastodon.v1.CustomEmoji,
                    {
                        shortcode: 'dog',
                        url: 'https://example.com/emoji/dog.png',
                        staticUrl: 'https://example.com/emoji/dog.png',
                        visibleInPicker: true,
                    } as mastodon.v1.CustomEmoji,
                ],
            });

            render(<StatusCard status={status} />);

            expect(screen.getByAltText(':cat:')).toBeInTheDocument();
            expect(screen.getByAltText(':dog:')).toBeInTheDocument();
        });

        it('should not convert shortcodes without matching emoji', () => {
            const status = createMockStatus({
                content: '<p>Hello :unknown: world</p>',
                emojis: [],
            });

            render(<StatusCard status={status} />);

            expect(screen.getByText(/Hello :unknown: world/)).toBeInTheDocument();
            expect(screen.queryByAltText(':unknown:')).not.toBeInTheDocument();
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
            expect(onReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '12345',
                    content: '<p>Test post</p>',
                })
            );
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
            expect(onReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'original-123',
                    content: '<p>Original content</p>',
                })
            );
        });
    });

    describe('content warning click behavior', () => {
        it('should NOT call onStatusClick when clicking on CW summary', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                spoilerText: 'Spoiler warning!',
                content: '<p>Hidden content</p>',
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            // Click on the summary (the spoiler warning text)
            const summary = screen.getByText(/Spoiler warning!/);
            await user.click(summary);

            // Should NOT navigate - just toggles the CW
            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should call onStatusClick when clicking on expanded CW content', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                spoilerText: 'Spoiler warning!',
                content: '<p>Hidden content</p>',
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            // First, expand the CW by clicking the summary
            const summary = screen.getByText(/Spoiler warning!/);
            await user.click(summary);

            // Then click on the expanded content
            const content = screen.getByText('Hidden content');
            await user.click(content);

            // Should navigate to detail view
            expect(onStatusClick).toHaveBeenCalledTimes(1);
            expect(onStatusClick).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '12345',
                })
            );
        });

        it('should NOT call onStatusClick when clicking links in CW content', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                spoilerText: 'Spoiler with link',
                content: '<p>Text with <a href="https://example.com">link</a></p>',
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            // Expand the CW
            const summary = screen.getByText(/Spoiler with link/);
            await user.click(summary);

            // Click on the link inside the CW content
            const link = screen.getByRole('link', { name: 'link' });
            await user.click(link);

            // Should NOT navigate - link should handle the click
            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should call onStatusClick when pressing Enter on card with CW', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                spoilerText: 'Spoiler warning!',
                content: '<p>Hidden content</p>',
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            const article = screen.getByRole('article');
            article.focus();
            await user.keyboard('{Enter}');

            expect(onStatusClick).toHaveBeenCalledTimes(1);
        });

        it('should NOT call onStatusClick when pressing Enter on CW summary', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                spoilerText: 'Spoiler warning!',
                content: '<p>Hidden content</p>',
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            const summary = screen.getByText(/Spoiler warning!/);
            summary.focus();
            await user.keyboard('{Enter}');

            // Should NOT navigate - CW toggle only
            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should NOT call onStatusClick when pressing Space on CW summary', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                spoilerText: 'Spoiler warning!',
                content: '<p>Hidden content</p>',
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            const summary = screen.getByText(/Spoiler warning!/);
            summary.focus();
            await user.keyboard(' ');

            // Should NOT navigate - CW toggle only
            expect(onStatusClick).not.toHaveBeenCalled();
        });
    });

    describe('account click', () => {
        it('should call onAccountClick when avatar is clicked', async () => {
            const user = userEvent.setup();
            const onAccountClick = vi.fn();
            const status = createMockStatus();
            const accountSession = {
                id: 'test-session-id',
                instanceUrl: 'https://mastodon.social',
                accessToken: 'token',
                account: status.account,
            };

            render(
                <StatusCard
                    status={status}
                    onAccountClick={onAccountClick}
                    accountSession={accountSession}
                />
            );

            const avatar = screen.getByAltText('Test User');
            await user.click(avatar);

            expect(onAccountClick).toHaveBeenCalledTimes(1);
            expect(onAccountClick).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '1',
                    username: 'testuser',
                }),
                'test-session-id'
            );
        });

        it('should call onAccountClick when display name is clicked', async () => {
            const user = userEvent.setup();
            const onAccountClick = vi.fn();
            const status = createMockStatus();
            const accountSession = {
                id: 'test-session-id',
                instanceUrl: 'https://mastodon.social',
                accessToken: 'token',
                account: status.account,
            };

            render(
                <StatusCard
                    status={status}
                    onAccountClick={onAccountClick}
                    accountSession={accountSession}
                />
            );

            const displayName = screen.getByText('Test User');
            await user.click(displayName);

            expect(onAccountClick).toHaveBeenCalledTimes(1);
            expect(onAccountClick).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '1',
                    displayName: 'Test User',
                }),
                'test-session-id'
            );
        });

        it('should call onAccountClick with correct accountSessionId when accountSession is provided', async () => {
            const user = userEvent.setup();
            const onAccountClick = vi.fn();
            const status = createMockStatus();
            const accountSession = {
                id: 'test-session-id',
                instanceUrl: 'https://mastodon.social',
                accessToken: 'token',
                account: status.account,
            };

            render(
                <StatusCard
                    status={status}
                    onAccountClick={onAccountClick}
                    accountSession={accountSession}
                />
            );

            const avatar = screen.getByAltText('Test User');
            await user.click(avatar);

            expect(onAccountClick).toHaveBeenCalledWith(
                expect.objectContaining({ id: '1' }),
                'test-session-id'
            );
        });

        it('should NOT trigger card click when avatar is clicked', async () => {
            const user = userEvent.setup();
            const onAccountClick = vi.fn();
            const onStatusClick = vi.fn();
            const status = createMockStatus();
            const accountSession = {
                id: 'test-session-id',
                instanceUrl: 'https://mastodon.social',
                accessToken: 'token',
                account: status.account,
            };

            render(
                <StatusCard
                    status={status}
                    onAccountClick={onAccountClick}
                    onStatusClick={onStatusClick}
                    accountSession={accountSession}
                />
            );

            const avatar = screen.getByAltText('Test User');
            await user.click(avatar);

            expect(onAccountClick).toHaveBeenCalledTimes(1);
            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should work with reblogged status - clicking original author', async () => {
            const user = userEvent.setup();
            const onAccountClick = vi.fn();
            const originalStatus = createMockStatus({
                id: 'original-123',
                account: {
                    ...createMockStatus().account,
                    id: 'original-author',
                    username: 'original',
                    displayName: 'Original Author',
                },
            });

            const reblogStatus = createMockStatus({
                id: 'reblog-456',
                reblog: originalStatus,
                account: {
                    ...createMockStatus().account,
                    id: 'reblogger',
                    username: 'reblogger',
                    displayName: 'Reblogger',
                },
            });

            const accountSession = {
                id: 'test-session-id',
                instanceUrl: 'https://mastodon.social',
                accessToken: 'token',
                account: originalStatus.account,
            };

            render(
                <StatusCard
                    status={reblogStatus}
                    onAccountClick={onAccountClick}
                    accountSession={accountSession}
                />
            );

            // Click on the original author's avatar (the one shown in the main content)
            const originalAvatar = screen.getByAltText('Original Author');
            await user.click(originalAvatar);

            expect(onAccountClick).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'original-author',
                    username: 'original',
                }),
                'test-session-id'
            );
        });

        it('should apply truncation classes to account header links', () => {
            const longAcct =
                'very-long-account-name-that-should-be-truncated@example-very-long-domain.social';
            const status = createMockStatus({
                account: {
                    ...createMockStatus().account,
                    acct: longAcct,
                },
            });

            const accountSession = {
                id: 'test-session-id',
                instanceUrl: 'https://mastodon.social',
                accessToken: 'token',
                account: status.account,
            };

            const { rerender } = render(
                <StatusCard
                    status={status}
                    onAccountClick={vi.fn()}
                    accountSession={accountSession}
                />
            );

            const accountButton = screen.getByText(`@${longAcct}`).closest('button');
            expect(accountButton).toHaveClass('min-w-0', 'max-w-full');

            rerender(<StatusCard status={status} />);

            const accountLink = screen.getByText(`@${longAcct}`).closest('a');
            expect(accountLink).toHaveClass('min-w-0', 'max-w-full');
        });
    });

    describe('NSFW blur', () => {
        it('should apply blur class to sensitive images', () => {
            const status = createMockStatus({
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image.png',
                        previewUrl: 'https://example.com/preview.png',
                        description: 'Sensitive image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} />);

            const img = screen.getByAltText('Sensitive image');
            expect(img).toHaveClass('nsfw-blur');
        });

        it('should not apply blur to non-sensitive images', () => {
            const status = createMockStatus({
                sensitive: false,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image.png',
                        previewUrl: 'https://example.com/preview.png',
                        description: 'Regular image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} />);

            const img = screen.getByAltText('Regular image');
            expect(img).not.toHaveClass('nsfw-blur');
        });

        it('should display overlay on sensitive images', () => {
            const status = createMockStatus({
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image.png',
                        previewUrl: 'https://example.com/preview.png',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} />);

            expect(screen.getByText('閲覧注意')).toBeInTheDocument();
        });

        it('should reveal image on click when sensitive', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image.png',
                        previewUrl: 'https://example.com/preview.png',
                        description: 'Sensitive image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} />);

            const img = screen.getByAltText('Sensitive image');
            expect(img).toHaveClass('nsfw-blur');

            const button = img.closest('button');
            await user.click(button!);

            expect(img).not.toHaveClass('nsfw-blur');
        });

        it('should open ImageViewer on second click after reveal', async () => {
            const user = userEvent.setup();
            const onImageClick = vi.fn();
            const status = createMockStatus({
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image.png',
                        previewUrl: 'https://example.com/preview.png',
                        description: 'Sensitive image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} onImageClick={onImageClick} />);

            // When blurred, button shows "閲覧注意の画像を表示 (1/1)"
            const button = screen.getByRole('button', {
                name: /閲覧注意の画像を表示/,
            });

            // First click reveals the image
            await user.click(button);
            expect(onImageClick).not.toHaveBeenCalled();

            // Second click opens ImageViewer
            await user.click(button);
            expect(onImageClick).toHaveBeenCalledTimes(1);
        });

        it('should handle reblogged sensitive posts', () => {
            const originalStatus = createMockStatus({
                id: 'original-123',
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image.png',
                        previewUrl: 'https://example.com/preview.png',
                        description: 'Sensitive reblogged image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            const reblogStatus = createMockStatus({
                id: 'reblog-456',
                reblog: originalStatus,
            });

            render(<StatusCard status={reblogStatus} />);

            const img = screen.getByAltText('Sensitive reblogged image');
            expect(img).toHaveClass('nsfw-blur');
        });

        it('should have proper ARIA labels for sensitive images', () => {
            const status = createMockStatus({
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/image.png',
                        previewUrl: 'https://example.com/preview.png',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} />);

            const button = screen.getByRole('button', { name: /閲覧注意の画像を表示/ });
            expect(button).toBeInTheDocument();
        });

        it('should call onNsfwReveal with displayStatus.id for reblogged posts', async () => {
            const user = userEvent.setup();
            const onNsfwReveal = vi.fn();

            const originalStatus = createMockStatus({
                id: 'original-123',
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/sensitive.png',
                        previewUrl: 'https://example.com/sensitive-preview.png',
                        description: 'Sensitive reblogged image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            const reblogStatus = createMockStatus({
                id: 'reblog-456',
                reblog: originalStatus,
            });

            render(<StatusCard status={reblogStatus} onNsfwReveal={onNsfwReveal} />);

            const button = screen.getByRole('button', { name: /閲覧注意の画像を表示/ });
            await user.click(button);

            // displayStatus.id（original-123）が通知されるべき
            expect(onNsfwReveal).toHaveBeenCalledTimes(1);
            expect(onNsfwReveal).toHaveBeenCalledWith('original-123');
        });

        it('should blur sensitive video and show overlay', async () => {
            const status = createMockStatus({
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'video',
                        url: 'https://example.com/video.mp4',
                        previewUrl: 'https://example.com/video-poster.png',
                        remoteUrl: null,
                        meta: null,
                        description: 'Sensitive video',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            const { container } = render(<StatusCard status={status} />);

            // Video should be in a button with blur
            const videoButton = container.querySelector(
                'button[aria-label="閲覧注意の動画を表示"]'
            );
            expect(videoButton).toBeInTheDocument();

            // Video should have blur class
            const video = container.querySelector('video');
            expect(video).toHaveClass('nsfw-blur');
            expect(video).toHaveAttribute('aria-hidden', 'true');

            // Overlay div should be present
            const overlay = container.querySelector('div.nsfw-blur-overlay');
            expect(overlay).toBeInTheDocument();
            expect(overlay).toHaveTextContent('閲覧注意');
        });

        it('should blur sensitive gifv and show overlay', async () => {
            const status = createMockStatus({
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'gifv',
                        url: 'https://example.com/animation.mp4',
                        previewUrl: 'https://example.com/animation-poster.png',
                        remoteUrl: null,
                        meta: null,
                        description: 'Sensitive gif',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            const { container } = render(<StatusCard status={status} />);

            // gifv button should have blur-indicating aria-label
            const gifvButton = screen.getByRole('button', {
                name: '閲覧注意のGIFを表示',
            });
            expect(gifvButton).toBeInTheDocument();

            // Video should have blur class and not autoplay
            const video = container.querySelector('video');
            expect(video).toHaveClass('nsfw-blur');
            expect(video).not.toHaveAttribute('autoPlay');

            // Overlay div should be present
            const overlay = container.querySelector('div.nsfw-blur-overlay');
            expect(overlay).toBeInTheDocument();
            expect(overlay).toHaveTextContent('閲覧注意');
        });
    });

    describe('video viewer integration', () => {
        it('should call onVideoClick with correct video data when video is clicked', async () => {
            const user = userEvent.setup();
            const onVideoClick = vi.fn();
            const status = createMockStatus({
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'video',
                        url: 'https://example.com/video.mp4',
                        previewUrl: 'https://example.com/video-poster.png',
                        remoteUrl: null,
                        meta: null,
                        description: 'Test video',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} onVideoClick={onVideoClick} />);

            const videoButton = screen.getByRole('button', { name: 'Test video' });
            await user.click(videoButton);

            expect(onVideoClick).toHaveBeenCalledTimes(1);
            const [videos, index] = onVideoClick.mock.calls[0];
            expect(videos).toHaveLength(1);
            expect(videos[0]).toMatchObject({
                url: 'https://example.com/video.mp4',
                previewUrl: 'https://example.com/video-poster.png',
                description: 'Test video',
                type: 'video',
            });
            expect(index).toBe(0);
        });

        it('should call onVideoClick with correct index for multiple videos', async () => {
            const user = userEvent.setup();
            const onVideoClick = vi.fn();
            const status = createMockStatus({
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'video',
                        url: 'https://example.com/video1.mp4',
                        previewUrl: 'https://example.com/video-poster1.png',
                        remoteUrl: null,
                        meta: null,
                        description: 'First video',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                    {
                        id: '2',
                        type: 'video',
                        url: 'https://example.com/video2.mp4',
                        previewUrl: 'https://example.com/video-poster2.png',
                        remoteUrl: null,
                        meta: null,
                        description: 'Second video',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} onVideoClick={onVideoClick} />);

            const secondVideoButton = screen.getByRole('button', { name: 'Second video' });
            await user.click(secondVideoButton);

            const [videos, index] = onVideoClick.mock.calls[0];
            expect(videos).toHaveLength(2);
            expect(index).toBe(1);
        });

        it('should include only video and gifv types in videoViewerVideos', () => {
            const onVideoClick = vi.fn();
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
                    {
                        id: '2',
                        type: 'video',
                        url: 'https://example.com/video.mp4',
                        previewUrl: 'https://example.com/video-poster.png',
                        remoteUrl: null,
                        meta: null,
                        description: 'Test video',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                    {
                        id: '3',
                        type: 'gifv',
                        url: 'https://example.com/animation.mp4',
                        previewUrl: 'https://example.com/animation-poster.png',
                        remoteUrl: null,
                        meta: null,
                        description: 'Test animation',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} onVideoClick={onVideoClick} />);

            const videoButton = screen.getByRole('button', { name: 'Test video' });
            videoButton.click(); // Click to get the videos array

            const [videos] = onVideoClick.mock.calls[0];
            expect(videos).toHaveLength(2); // Only video and gifv, not image
            expect(videos[0].type).toBe('video');
            expect(videos[1].type).toBe('gifv');
        });
    });

    describe('audio interaction', () => {
        it('should not trigger onStatusClick when interacting with audio controls', () => {
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                content: 'Test status with audio',
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'audio',
                        url: 'https://example.com/audio.mp3',
                        previewUrl: '',
                        remoteUrl: null,
                        meta: null,
                        description: 'Test audio',
                        blurhash: null,
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusCard status={status} onStatusClick={onStatusClick} />);

            const audioElement = document.querySelector('audio');
            expect(audioElement).toBeInTheDocument();

            // Click on audio controls should not trigger status click
            if (audioElement) {
                audioElement.click();
            }
            expect(onStatusClick).not.toHaveBeenCalled();
        });
    });

    describe('StatusMenu integration', () => {
        const mockAccountSession = {
            id: 'session-1',
            instanceUrl: 'https://mastodon.social',
            accessToken: 'test-token',
            account: {
                id: '1',
                username: 'testuser',
                acct: 'testuser',
                displayName: 'Test User',
            },
        } as unknown as AccountSession;

        it('should render StatusMenu with menu button', () => {
            const status = createMockStatus();
            render(<StatusCard status={status} />);

            expect(screen.getByRole('button', { name: 'メニュー' })).toBeInTheDocument();
        });

        it('should not show delete option when no accountSession', async () => {
            const user = userEvent.setup();
            const onStatusDelete = vi.fn();
            const status = createMockStatus();

            render(<StatusCard status={status} onStatusDelete={onStatusDelete} />);

            const menuButton = screen.getByRole('button', { name: 'メニュー' });
            await user.click(menuButton);

            // Delete option should not be shown (user is not logged in)
            expect(screen.queryByText('削除')).not.toBeInTheDocument();
        });

        it('should not show delete option for other users posts', async () => {
            const user = userEvent.setup();
            const onStatusDelete = vi.fn();
            // Status from a different user
            const status = createMockStatus({
                account: {
                    id: 'other-user',
                    username: 'otheruser',
                    acct: 'otheruser',
                    displayName: 'Other User',
                } as unknown as mastodon.v1.Account,
            });

            render(
                <StatusCard
                    status={status}
                    accountSession={mockAccountSession}
                    onStatusDelete={onStatusDelete}
                />
            );

            const menuButton = screen.getByRole('button', { name: 'メニュー' });
            await user.click(menuButton);

            // Delete option should not be shown (not own post)
            expect(screen.queryByText('削除')).not.toBeInTheDocument();
        });

        it('should show delete option for own posts', async () => {
            const user = userEvent.setup();
            const onStatusDelete = vi.fn();
            // Status from the same user as accountSession
            const status = createMockStatus({
                account: {
                    id: '1', // matches mockAccountSession.account.id
                    username: 'testuser',
                    acct: 'testuser',
                    displayName: 'Test User',
                } as unknown as mastodon.v1.Account,
            });

            render(
                <StatusCard
                    status={status}
                    accountSession={mockAccountSession}
                    onStatusDelete={onStatusDelete}
                />
            );

            const menuButton = screen.getByRole('button', { name: 'メニュー' });
            await user.click(menuButton);

            // Delete option should be shown (own post)
            expect(screen.getByText('削除')).toBeInTheDocument();
        });

        it('should call onStatusDelete when delete is clicked', async () => {
            const user = userEvent.setup();
            const onStatusDelete = vi.fn();
            const status = createMockStatus({
                account: {
                    id: '1',
                    username: 'testuser',
                    acct: 'testuser',
                    displayName: 'Test User',
                } as unknown as mastodon.v1.Account,
            });

            render(
                <StatusCard
                    status={status}
                    accountSession={mockAccountSession}
                    onStatusDelete={onStatusDelete}
                />
            );

            const menuButton = screen.getByRole('button', { name: 'メニュー' });
            await user.click(menuButton);

            const deleteButton = screen.getByText('削除');
            await user.click(deleteButton);

            expect(onStatusDelete).toHaveBeenCalledWith(expect.objectContaining({ id: '12345' }));
        });
    });

    describe('visibility icon', () => {
        it.each([
            ['public', '公開'],
            ['unlisted', '未収載'],
            ['private', 'フォロワーのみ'],
            ['direct', 'ダイレクト'],
        ] as const)('visibility=%s のラベルを表示', (visibility, label) => {
            render(<StatusCard status={createMockStatus({ visibility })} />);
            expect(screen.getByLabelText(new RegExp(`公開範囲: ${label}`))).toBeInTheDocument();
        });

        it('リブログ時は元投稿の公開範囲を使う', () => {
            const original = createMockStatus({ visibility: 'direct' });
            const reblog = createMockStatus({ visibility: 'public', reblog: original });
            render(<StatusCard status={reblog} />);
            expect(screen.getByLabelText(/公開範囲: ダイレクト/)).toBeInTheDocument();
        });

        it('visibility不正値でもフォールバック表示する', () => {
            render(<StatusCard status={createMockStatus({ visibility: 'unknown' as never })} />);
            expect(screen.getByLabelText(/公開範囲: 不明/)).toBeInTheDocument();
        });

        it('リンククリックでは onStatusClick が発火しない', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            render(<StatusCard status={createMockStatus()} onStatusClick={onStatusClick} />);
            const link = screen.getByRole('link', { name: /公開範囲/ });
            await user.click(link);
            expect(onStatusClick).not.toHaveBeenCalled();
        });
    });

    describe('poll voting', () => {
        const mockAccountSession = {
            id: 'session-1',
            instanceUrl: 'https://mastodon.social',
            accessToken: 'test-token',
            account: {
                id: '1',
                username: 'testuser',
                acct: 'testuser',
                displayName: 'Test User',
            },
        } as unknown as AccountSession;

        it('should NOT call onStatusClick when clicking poll option', async () => {
            const user = userEvent.setup();
            const onStatusClick = vi.fn();
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: false,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            render(
                <StatusCard
                    status={status}
                    onStatusClick={onStatusClick}
                    accountSession={mockAccountSession}
                />
            );

            // Click on a poll option label
            const pollOption = screen.getByText('Option A');
            await user.click(pollOption);

            // Should NOT trigger status click (detail modal)
            expect(onStatusClick).not.toHaveBeenCalled();
        });

        it('should show voting UI for single-choice poll when not voted', () => {
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: false,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            // Should render radio buttons for single choice
            const radioInputs = document.querySelectorAll('input[type="radio"]');
            expect(radioInputs).toHaveLength(2);

            // Should render vote button
            expect(screen.getByRole('button', { name: '投票' })).toBeInTheDocument();
        });

        it('should show voting UI for multiple-choice poll when not voted', () => {
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: true,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                        { title: 'Option C', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            // Should render checkboxes for multiple choice
            const checkboxInputs = document.querySelectorAll('input[type="checkbox"]');
            expect(checkboxInputs).toHaveLength(3);
        });

        it('should disable vote button when no options selected', () => {
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: false,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            const voteButton = screen.getByRole('button', { name: '投票' });
            expect(voteButton).toBeDisabled();
        });

        it('should enable vote button when option is selected', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: false,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            // Select an option
            const optionLabel = screen.getByText('Option A');
            await user.click(optionLabel);

            // Vote button should now be enabled
            const voteButton = screen.getByRole('button', { name: '投票' });
            expect(voteButton).not.toBeDisabled();
        });

        it('should show results when poll is already voted', () => {
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: false,
                    votesCount: 10,
                    votersCount: 10,
                    voted: true,
                    ownVotes: [0],
                    options: [
                        { title: 'Option A', votesCount: 7, emojis: [] },
                        { title: 'Option B', votesCount: 3, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            // Should show results with percentages
            expect(screen.getByText('70%')).toBeInTheDocument();
            expect(screen.getByText('30%')).toBeInTheDocument();

            // Should NOT show vote button
            expect(screen.queryByRole('button', { name: '投票' })).not.toBeInTheDocument();

            // Should show checkmark for own vote
            expect(screen.getByText('✓')).toBeInTheDocument();
        });

        it('should show results when poll is expired', () => {
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: '2020-01-01T00:00:00.000Z',
                    expired: true,
                    multiple: false,
                    votesCount: 10,
                    votersCount: 10,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 5, emojis: [] },
                        { title: 'Option B', votesCount: 5, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            // Should show results instead of voting UI (both options are 50%)
            expect(screen.getAllByText('50%')).toHaveLength(2);
            expect(screen.queryByRole('button', { name: '投票' })).not.toBeInTheDocument();
        });

        it('should not show voting UI when no accountSession', () => {
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
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

            // No accountSession provided
            render(<StatusCard status={status} />);

            // Should show results (can't vote without session)
            expect(screen.getByText('70%')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: '投票' })).not.toBeInTheDocument();
        });

        it('should allow multiple selection for multiple-choice poll', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: true,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                        { title: 'Option C', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            // Select multiple options
            await user.click(screen.getByText('Option A'));
            await user.click(screen.getByText('Option C'));

            // Both should be checked
            const checkboxes = document.querySelectorAll(
                'input[type="checkbox"]'
            ) as NodeListOf<HTMLInputElement>;
            expect(checkboxes[0].checked).toBe(true);
            expect(checkboxes[1].checked).toBe(false);
            expect(checkboxes[2].checked).toBe(true);
        });

        it('should replace selection for single-choice poll', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: false,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            // Select first option
            await user.click(screen.getByText('Option A'));

            const radios1 = document.querySelectorAll(
                'input[type="radio"]'
            ) as NodeListOf<HTMLInputElement>;
            expect(radios1[0].checked).toBe(true);
            expect(radios1[1].checked).toBe(false);

            // Select second option (should replace first)
            await user.click(screen.getByText('Option B'));

            const radios2 = document.querySelectorAll(
                'input[type="radio"]'
            ) as NodeListOf<HTMLInputElement>;
            expect(radios2[0].checked).toBe(false);
            expect(radios2[1].checked).toBe(true);
        });

        it('should call onPollUpdate when voting successfully', async () => {
            const user = userEvent.setup();
            const onPollUpdate = vi.fn();
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: false,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            const updatedPoll = {
                id: 'poll-1',
                expired: false,
                multiple: false,
                votesCount: 1,
                votersCount: 1,
                voted: true,
                ownVotes: [0],
                options: [
                    { title: 'Option A', votesCount: 1, emojis: [] },
                    { title: 'Option B', votesCount: 0, emojis: [] },
                ],
                emojis: [],
            } as unknown as mastodon.v1.Poll;

            vi.mocked(mastoClient.votePoll).mockResolvedValue(updatedPoll);

            render(
                <StatusCard
                    status={status}
                    accountSession={mockAccountSession}
                    onPollUpdate={onPollUpdate}
                />
            );

            // Select and vote
            await user.click(screen.getByText('Option A'));
            await user.click(screen.getByRole('button', { name: '投票' }));

            // Wait for async vote
            await screen.findByText('投票');

            expect(onPollUpdate).toHaveBeenCalledWith('12345', updatedPoll);
        });

        it('should call onPollUpdate when provided', async () => {
            const user = userEvent.setup();
            const onPollUpdate = vi.fn();

            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: false,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            const updatedPoll = {
                id: 'poll-1',
                expired: false,
                multiple: false,
                votesCount: 1,
                votersCount: 1,
                voted: true,
                ownVotes: [0],
                options: [
                    { title: 'Option A', votesCount: 1, emojis: [] },
                    { title: 'Option B', votesCount: 0, emojis: [] },
                ],
                emojis: [],
            } as unknown as mastodon.v1.Poll;

            vi.mocked(mastoClient.votePoll).mockResolvedValue(updatedPoll);

            render(
                <StatusCard
                    status={status}
                    accountSession={mockAccountSession}
                    onPollUpdate={onPollUpdate}
                />
            );

            // Select and vote
            await user.click(screen.getByText('Option A'));
            await user.click(screen.getByRole('button', { name: '投票' }));

            // Wait for async vote
            await screen.findByText('投票');

            expect(onPollUpdate).toHaveBeenCalled();
            const [statusId, poll] = onPollUpdate.mock.calls[0];
            expect(statusId).toBe('12345');
            expect(poll.voted).toBe(true);
            expect(poll.ownVotes).toEqual([0]);
        });

        it('should show loading state during vote', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: false,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            // Create a promise that we can resolve manually
            let resolveVote: (value: mastodon.v1.Poll) => void;
            const votePromise = new Promise<mastodon.v1.Poll>((resolve) => {
                resolveVote = resolve;
            });

            vi.mocked(mastoClient.votePoll).mockImplementation(() => votePromise);

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            // Select and vote
            await user.click(screen.getByText('Option A'));
            await user.click(screen.getByRole('button', { name: '投票' }));

            // Should show loading state
            expect(screen.getByText('投票中...')).toBeInTheDocument();

            // Resolve the vote
            resolveVote!({
                id: 'poll-1',
                voted: true,
                ownVotes: [0],
                options: [
                    { title: 'Option A', votesCount: 1 },
                    { title: 'Option B', votesCount: 0 },
                ],
            } as mastodon.v1.Poll);

            // Wait for loading to finish
            await screen.findByText('投票');
        });

        it('should disable inputs during loading', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: true,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            // Create a promise that we can resolve manually
            let resolveVote: (value: mastodon.v1.Poll) => void;
            const votePromise = new Promise<mastodon.v1.Poll>((resolve) => {
                resolveVote = resolve;
            });

            vi.mocked(mastoClient.votePoll).mockImplementation(() => votePromise);

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            // Select and vote
            await user.click(screen.getByText('Option A'));
            await user.click(screen.getByRole('button', { name: '投票' }));

            // Inputs should be disabled during loading
            const checkboxes = document.querySelectorAll(
                'input[type="checkbox"]'
            ) as NodeListOf<HTMLInputElement>;
            expect(checkboxes[0].disabled).toBe(true);

            // Resolve the vote
            resolveVote!({
                id: 'poll-1',
                voted: true,
                ownVotes: [0],
                options: [
                    { title: 'Option A', votesCount: 1 },
                    { title: 'Option B', votesCount: 0 },
                ],
            } as mastodon.v1.Poll);

            await screen.findByText('投票');
        });

        it('should handle vote error gracefully', async () => {
            const user = userEvent.setup();
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: null,
                    expired: false,
                    multiple: false,
                    votesCount: 0,
                    votersCount: 0,
                    voted: false,
                    ownVotes: [],
                    options: [
                        { title: 'Option A', votesCount: 0, emojis: [] },
                        { title: 'Option B', votesCount: 0, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            vi.mocked(mastoClient.votePoll).mockRejectedValue(new Error('Network error'));

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            // Select and vote
            await user.click(screen.getByText('Option A'));
            await user.click(screen.getByRole('button', { name: '投票' }));

            // Wait a bit for async error handling
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Should log error
            expect(consoleSpy).toHaveBeenCalledWith('Failed to vote on poll:', expect.any(Error));

            consoleSpy.mockRestore();
        });

        it('should disable refresh button when no accountSession', () => {
            const now = Date.now();
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: new Date(now + 60000).toISOString(),
                    expired: false,
                    multiple: false,
                    votesCount: 10,
                    votersCount: 10,
                    voted: true,
                    ownVotes: [0],
                    options: [
                        { title: 'Option A', votesCount: 5, emojis: [] },
                        { title: 'Option B', votesCount: 5, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            // Render without accountSession
            render(<StatusCard status={status} accountSession={undefined} />);

            // Refresh button should be disabled
            const refreshButton = screen.getByRole('button', { name: '投票結果を更新' });
            expect(refreshButton).toBeDisabled();
        });

        it('should enable refresh button when accountSession exists', () => {
            const now = Date.now();
            const status = createMockStatus({
                poll: {
                    id: 'poll-1',
                    expiresAt: new Date(now + 60000).toISOString(),
                    expired: false,
                    multiple: false,
                    votesCount: 10,
                    votersCount: 10,
                    voted: true,
                    ownVotes: [0],
                    options: [
                        { title: 'Option A', votesCount: 5, emojis: [] },
                        { title: 'Option B', votesCount: 5, emojis: [] },
                    ],
                    emojis: [],
                } as unknown as mastodon.v1.Poll,
            });

            render(<StatusCard status={status} accountSession={mockAccountSession} />);

            // Refresh button should be enabled
            const refreshButton = screen.getByRole('button', { name: '投票結果を更新' });
            expect(refreshButton).not.toBeDisabled();
        });
    });

    describe('favourite and reblog interactions', () => {
        const mockAccountSession = {
            id: 'session-1',
            instanceUrl: 'https://mastodon.social',
            accessToken: 'test-token',
            account: {
                id: '1',
                username: 'testuser',
                acct: 'testuser',
                displayName: 'Test User',
            },
        } as unknown as AccountSession;

        beforeEach(() => {
            vi.clearAllMocks();
        });

        describe('favourite button', () => {
            it('should optimistically update UI before API call completes', async () => {
                const user = userEvent.setup();
                const status = createMockStatus({
                    favourited: false,
                    favouritesCount: 5,
                });

                let resolvePromise: (value: mastodon.v1.Status) => void;
                const favouritePromise = new Promise<mastodon.v1.Status>((resolve) => {
                    resolvePromise = resolve;
                });

                vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                    {} as ReturnType<typeof mastoClient.getClient>
                );
                vi.spyOn(mastoClient, 'favouriteStatus').mockReturnValue(favouritePromise);

                render(<StatusCard status={status} accountSession={mockAccountSession} />);

                // Initial count should be 5
                expect(screen.getByText('5')).toBeInTheDocument();

                const favouriteButton = screen.getByRole('button', { name: /お気に入り/ });
                await user.click(favouriteButton);

                // Count should optimistically update to 6 before API completes
                await waitFor(() => {
                    expect(screen.getByText('6')).toBeInTheDocument();
                });

                // Resolve the API call
                await act(async () => {
                    resolvePromise!(createMockStatus({ favourited: true, favouritesCount: 6 }));
                });
            });

            it('should prevent duplicate clicks while loading', async () => {
                const user = userEvent.setup();
                const status = createMockStatus({
                    favourited: false,
                    favouritesCount: 5,
                });

                let resolvePromise: (value: mastodon.v1.Status) => void;
                const favouritePromise = new Promise<mastodon.v1.Status>((resolve) => {
                    resolvePromise = resolve;
                });

                vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                    {} as ReturnType<typeof mastoClient.getClient>
                );
                const favouriteSpy = vi
                    .spyOn(mastoClient, 'favouriteStatus')
                    .mockReturnValue(favouritePromise);

                render(<StatusCard status={status} accountSession={mockAccountSession} />);

                const favouriteButton = screen.getByRole('button', { name: /お気に入り/ });
                await user.click(favouriteButton);

                // Try clicking again while loading
                await user.click(favouriteButton);

                // API should only be called once
                expect(favouriteSpy).toHaveBeenCalledTimes(1);

                // Resolve the API call
                await act(async () => {
                    resolvePromise!(createMockStatus({ favourited: true, favouritesCount: 6 }));
                });
            });

            it('should revert optimistic update on API failure', async () => {
                const user = userEvent.setup();
                const status = createMockStatus({
                    favourited: false,
                    favouritesCount: 5,
                });
                const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

                vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                    {} as ReturnType<typeof mastoClient.getClient>
                );
                vi.spyOn(mastoClient, 'favouriteStatus').mockRejectedValue(new Error('API Error'));

                render(<StatusCard status={status} accountSession={mockAccountSession} />);

                const favouriteButton = screen.getByRole('button', { name: /お気に入り/ });
                await user.click(favouriteButton);

                // Wait for error and revert
                await waitFor(() => {
                    expect(consoleErrorSpy).toHaveBeenCalledWith(
                        'Failed to toggle favourite:',
                        expect.any(Error)
                    );
                });

                // Count should be back to 5
                expect(screen.getByText('5')).toBeInTheDocument();

                consoleErrorSpy.mockRestore();
            });
        });

        describe('reblog button', () => {
            it('should optimistically update UI before API call completes', async () => {
                const user = userEvent.setup();
                const status = createMockStatus({
                    reblogged: false,
                    reblogsCount: 3,
                });

                let resolvePromise: (value: mastodon.v1.Status) => void;
                const reblogPromise = new Promise<mastodon.v1.Status>((resolve) => {
                    resolvePromise = resolve;
                });

                vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                    {} as ReturnType<typeof mastoClient.getClient>
                );
                vi.spyOn(mastoClient, 'reblogStatus').mockReturnValue(reblogPromise);

                render(<StatusCard status={status} accountSession={mockAccountSession} />);

                // Initial count should be 3
                expect(screen.getByText('3')).toBeInTheDocument();

                const reblogButton = screen.getByRole('button', { name: /ブースト/ });
                await user.click(reblogButton);

                // Count should optimistically update to 4 before API completes
                await waitFor(() => {
                    expect(screen.getByText('4')).toBeInTheDocument();
                });

                // Resolve the API call
                await act(async () => {
                    resolvePromise!(createMockStatus({ reblogged: true, reblogsCount: 4 }));
                });
            });

            it('should prevent duplicate clicks while loading', async () => {
                const user = userEvent.setup();
                const status = createMockStatus({
                    reblogged: false,
                    reblogsCount: 3,
                });

                let resolvePromise: (value: mastodon.v1.Status) => void;
                const reblogPromise = new Promise<mastodon.v1.Status>((resolve) => {
                    resolvePromise = resolve;
                });

                vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                    {} as ReturnType<typeof mastoClient.getClient>
                );
                const reblogSpy = vi
                    .spyOn(mastoClient, 'reblogStatus')
                    .mockReturnValue(reblogPromise);

                render(<StatusCard status={status} accountSession={mockAccountSession} />);

                const reblogButton = screen.getByRole('button', { name: /ブースト/ });
                await user.click(reblogButton);

                // Try clicking again while loading
                await user.click(reblogButton);

                // API should only be called once
                expect(reblogSpy).toHaveBeenCalledTimes(1);

                // Resolve the API call
                await act(async () => {
                    resolvePromise!(createMockStatus({ reblogged: true, reblogsCount: 4 }));
                });
            });

            it('should revert optimistic update on API failure', async () => {
                const user = userEvent.setup();
                const status = createMockStatus({
                    reblogged: false,
                    reblogsCount: 3,
                });
                const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

                vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                    {} as ReturnType<typeof mastoClient.getClient>
                );
                vi.spyOn(mastoClient, 'reblogStatus').mockRejectedValue(new Error('API Error'));

                render(<StatusCard status={status} accountSession={mockAccountSession} />);

                const reblogButton = screen.getByRole('button', { name: /ブースト/ });
                await user.click(reblogButton);

                // Wait for error and revert
                await waitFor(() => {
                    expect(consoleErrorSpy).toHaveBeenCalledWith(
                        'Failed to toggle reblog:',
                        expect.any(Error)
                    );
                });

                // Count should be back to 3
                expect(screen.getByText('3')).toBeInTheDocument();

                consoleErrorSpy.mockRestore();
            });

            it('should not allow reblogging private posts', async () => {
                const user = userEvent.setup();
                const status = createMockStatus({
                    visibility: 'private',
                    reblogged: false,
                    reblogsCount: 0,
                });

                const reblogSpy = vi.spyOn(mastoClient, 'reblogStatus');

                render(<StatusCard status={status} accountSession={mockAccountSession} />);

                const reblogButton = screen.getByRole('button', { name: /ブースト/ });
                expect(reblogButton).toBeDisabled();

                // Click should not trigger API call
                await user.click(reblogButton);
                expect(reblogSpy).not.toHaveBeenCalled();
            });
        });
    });
});
