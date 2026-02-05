import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusDetailModal } from './StatusDetailModal';
import type { mastodon } from 'masto';
import type { AccountSession } from '../api/mastoClient';
import * as mastoClient from '../api/mastoClient';

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

const createMockAccountSession = (): AccountSession => ({
    id: 'session1',
    instanceUrl: 'https://mastodon.social',
    accessToken: 'test-token',
    account: createMockStatus().account,
});

// Mock getStatusContext by default to avoid errors in tests
vi.mock('../api/mastoClient', async (importOriginal) => {
    const actual = await importOriginal<typeof mastoClient>();
    return {
        ...actual,
        getStatusContext: vi.fn().mockResolvedValue({ ancestors: [], descendants: [] }),
    };
});

describe('StatusDetailModal', () => {
    beforeEach(() => {
        vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
            ancestors: [],
            descendants: [],
        });
    });

    describe('rendering', () => {
        it('should not render when isOpen is false', () => {
            const status = createMockStatus();
            render(<StatusDetailModal isOpen={false} onClose={() => {}} status={status} />);

            expect(screen.queryByText('投稿の詳細')).not.toBeInTheDocument();
        });

        it('should not render when status is null', () => {
            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={null} />);

            expect(screen.queryByText('投稿の詳細')).not.toBeInTheDocument();
        });

        it('should render modal when isOpen is true and status is provided', () => {
            const status = createMockStatus();
            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={status} />);

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
            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={status} />);

            expect(screen.getByText('5')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it('should render content warning when spoilerText is present', () => {
            const status = createMockStatus({
                spoilerText: 'Warning: sensitive content',
                content: '<p>Hidden content</p>',
            });
            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={status} />);

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

            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={reblogStatus} />);

            expect(screen.getByText(/がブースト/)).toBeInTheDocument();
            expect(screen.getByText('Original Author')).toBeInTheDocument();
        });
    });

    describe('interactions', () => {
        it('should call onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            const status = createMockStatus();

            render(<StatusDetailModal isOpen={true} onClose={onClose} status={status} />);

            const closeButton = screen
                .getAllByRole('button')
                .find((btn) => btn.querySelector('svg'));
            expect(closeButton).toBeDefined();
            await user.click(closeButton!);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when backdrop is clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            const status = createMockStatus();

            render(<StatusDetailModal isOpen={true} onClose={onClose} status={status} />);

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

            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={status} />);

            const img = screen.getByAltText('Test image');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', 'https://example.com/image.png');
        });

        it('should blur sensitive images by default', () => {
            const status = createMockStatus({
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/sensitive.png',
                        previewUrl: 'https://example.com/sensitive-preview.png',
                        description: 'Sensitive image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={status} />);

            const img = screen.getByAltText('Sensitive image');
            expect(img).toHaveClass('nsfw-blur');

            const overlay = screen.getByText('閲覧注意');
            expect(overlay).toBeInTheDocument();
        });

        it('should show correct aria-label for blurred sensitive image', () => {
            const status = createMockStatus({
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/sensitive.png',
                        previewUrl: 'https://example.com/sensitive-preview.png',
                        description: 'Sensitive image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={status} />);

            const button = screen.getByRole('button', {
                name: /閲覧注意の画像を表示 \(1\/1\)/,
            });
            expect(button).toBeInTheDocument();
        });

        it('should reveal sensitive image when clicked', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/sensitive.png',
                        previewUrl: 'https://example.com/sensitive-preview.png',
                        description: 'Sensitive image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={status} />);

            const img = screen.getByAltText('Sensitive image');
            expect(img).toHaveClass('nsfw-blur');

            const button = screen.getByRole('button', {
                name: /閲覧注意の画像を表示/,
            });
            await user.click(button);

            expect(img).not.toHaveClass('nsfw-blur');
        });

        it('should reset nsfwRevealed state when status changes', async () => {
            const user = userEvent.setup();
            const status1 = createMockStatus({
                id: 'status1',
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/sensitive1.png',
                        description: 'Sensitive image 1',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            const status2 = createMockStatus({
                id: 'status2',
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '2',
                        type: 'image',
                        url: 'https://example.com/sensitive2.png',
                        description: 'Sensitive image 2',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            const { rerender } = render(
                <StatusDetailModal isOpen={true} onClose={() => {}} status={status1} />
            );

            // Reveal first image
            const button1 = screen.getByRole('button', {
                name: /閲覧注意の画像を表示/,
            });
            await user.click(button1);

            const img1 = screen.getByAltText('Sensitive image 1');
            expect(img1).not.toHaveClass('nsfw-blur');

            // Change to different status
            rerender(<StatusDetailModal isOpen={true} onClose={() => {}} status={status2} />);

            const img2 = screen.getByAltText('Sensitive image 2');
            expect(img2).toHaveClass('nsfw-blur');
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

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={reblogStatus}
                    onNsfwReveal={onNsfwReveal}
                />
            );

            const button = screen.getByRole('button', { name: /閲覧注意の画像を表示/ });
            await user.click(button);

            // displayStatus.id（original-123）が通知されるべき
            expect(onNsfwReveal).toHaveBeenCalledTimes(1);
            expect(onNsfwReveal).toHaveBeenCalledWith('original-123');
        });

        it('should check nsfwRevealedStatusIds for current displayStatus.id', () => {
            const status1 = createMockStatus({
                id: 'status-1',
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'image',
                        url: 'https://example.com/sensitive1.png',
                        description: 'Sensitive image 1',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            const status2 = createMockStatus({
                id: 'status-2',
                sensitive: true,
                mediaAttachments: [
                    {
                        id: '2',
                        type: 'image',
                        url: 'https://example.com/sensitive2.png',
                        description: 'Sensitive image 2',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            // status1は表示済み、status2は未表示
            const nsfwRevealedStatusIds = new Set(['status-1']);

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status1}
                    nsfwRevealedStatusIds={nsfwRevealedStatusIds}
                />
            );

            // status1は表示済みなのでぼかしなし
            const img1 = screen.getByAltText('Sensitive image 1');
            expect(img1).not.toHaveClass('nsfw-blur');

            // status2に切り替えると、未表示なのでぼかしあり
            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status2}
                    nsfwRevealedStatusIds={nsfwRevealedStatusIds}
                />
            );

            const img2 = screen.getByAltText('Sensitive image 2');
            expect(img2).toHaveClass('nsfw-blur');
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
                        description: 'First image',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    onImageClick={onImageClick}
                />
            );

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
                ],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    onImageClick={onImageClick}
                />
            );

            // Click the second image
            const secondImg = screen.getByAltText('Second image');
            await user.click(secondImg);

            expect(onImageClick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ url: 'https://example.com/image1.png' }),
                    expect.objectContaining({ url: 'https://example.com/image2.png' }),
                ]),
                1 // index of second image
            );
        });

        it('should NOT call onImageClick for video attachments', async () => {
            const user = userEvent.setup();
            const onImageClick = vi.fn();
            const status = createMockStatus({
                mediaAttachments: [
                    {
                        id: '1',
                        type: 'video',
                        url: 'https://example.com/video.mp4',
                        previewUrl: 'https://example.com/video-poster.png',
                        description: 'Test video',
                    } as mastodon.v1.MediaAttachment,
                ],
            });

            const { container } = render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    onImageClick={onImageClick}
                />
            );

            // Video should be in an anchor tag, not a button
            const videoLink = container.querySelector('a[href="https://example.com/video.mp4"]');
            expect(videoLink).toBeInTheDocument();

            // Click on the video element
            const video = container.querySelector('video');
            expect(video).toBeInTheDocument();
            await user.click(video!);
            expect(onImageClick).not.toHaveBeenCalled();
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

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    onImageClick={onImageClick}
                />
            );

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

            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={status} />);

            expect(screen.getByText('Option A')).toBeInTheDocument();
            expect(screen.getByText('Option B')).toBeInTheDocument();
            expect(screen.getByText('70%')).toBeInTheDocument();
            expect(screen.getByText('30%')).toBeInTheDocument();
        });
    });

    describe('focus management', () => {
        it('should have proper ARIA attributes for accessibility', () => {
            const status = createMockStatus();
            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={status} />);

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-labelledby', 'status-detail-title');
        });

        it('should focus close button when modal opens', () => {
            const status = createMockStatus();
            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={status} />);

            const closeButton = screen.getByRole('button', { name: '閉じる' });
            expect(closeButton).toHaveFocus();
        });

        it('should call onClose when Escape key is pressed', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            const status = createMockStatus();

            render(<StatusDetailModal isOpen={true} onClose={onClose} status={status} />);

            await user.keyboard('{Escape}');

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should trap focus within modal when Tab is pressed', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();

            render(<StatusDetailModal isOpen={true} onClose={() => {}} status={status} />);

            const closeButton = screen.getByRole('button', { name: '閉じる' });
            expect(closeButton).toHaveFocus();

            // Tab through focusable elements
            await user.tab();
            // Should cycle through focusable elements within the modal
            expect(document.activeElement?.closest('[role="dialog"]')).toBeTruthy();
        });

        it('should restore focus to previously focused element when closed', async () => {
            const status = createMockStatus();
            const TestComponent = () => {
                const [isOpen, setIsOpen] = useState(false);
                return (
                    <>
                        <button data-testid="trigger" onClick={() => setIsOpen(true)}>
                            Open Modal
                        </button>
                        <StatusDetailModal
                            isOpen={isOpen}
                            onClose={() => setIsOpen(false)}
                            status={status}
                        />
                    </>
                );
            };

            render(<TestComponent />);

            // Focus the trigger button and open modal
            const trigger = screen.getByTestId('trigger');
            trigger.focus();
            expect(trigger).toHaveFocus();

            await userEvent.click(trigger);

            // Modal should be open and close button focused
            const closeButton = screen.getByRole('button', { name: '閉じる' });
            expect(closeButton).toHaveFocus();

            // Close the modal
            await userEvent.click(closeButton);

            // Focus should be restored to trigger button
            expect(trigger).toHaveFocus();
        });
    });

    describe('favourite button interactions', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should not show favourite button as active when status is not favourited', async () => {
            const status = createMockStatus({ favourited: false });
            const accountSession = createMockAccountSession();

            await act(async () => {
                render(
                    <StatusDetailModal
                        isOpen={true}
                        onClose={() => {}}
                        status={status}
                        accountSession={accountSession}
                    />
                );
            });

            // Find all buttons and locate favourite button by checking for star icon
            const buttons = screen.getAllByRole('button');
            const favouriteButton = buttons.find((btn) => btn.querySelector('svg'));

            // The button should not have the filled star or active color class
            expect(favouriteButton?.className).not.toMatch(/text-amber-400/);
        });

        it('should show favourite button as active when status is favourited', async () => {
            const status = createMockStatus({ favourited: true, favouritesCount: 10 });
            const accountSession = createMockAccountSession();

            await act(async () => {
                render(
                    <StatusDetailModal
                        isOpen={true}
                        onClose={() => {}}
                        status={status}
                        accountSession={accountSession}
                    />
                );
            });

            // Favourite count should be visible
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it('should call favouriteStatus API when unfavourited status is clicked', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ favourited: false, favouritesCount: 5 });
            const accountSession = createMockAccountSession();
            const onStatusUpdate = vi.fn();

            const updatedStatus = createMockStatus({ favourited: true, favouritesCount: 6 });

            vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );
            vi.spyOn(mastoClient, 'favouriteStatus').mockResolvedValue(updatedStatus);

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                    onStatusUpdate={onStatusUpdate}
                />
            );

            // Find favourite button by its text label
            const favouriteButton = screen.getByRole('button', { name: /お気に入り/ });
            expect(favouriteButton).toBeDefined();
            await user.click(favouriteButton);

            await waitFor(() => {
                expect(mastoClient.favouriteStatus).toHaveBeenCalledWith({}, '12345');
                expect(onStatusUpdate).toHaveBeenCalledWith(updatedStatus);
            });
        });

        it('should call unfavouriteStatus API when favourited status is clicked', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ favourited: true, favouritesCount: 10 });
            const accountSession = createMockAccountSession();
            const onStatusUpdate = vi.fn();

            const updatedStatus = createMockStatus({ favourited: false, favouritesCount: 9 });

            vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );
            vi.spyOn(mastoClient, 'unfavouriteStatus').mockResolvedValue(updatedStatus);

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                    onStatusUpdate={onStatusUpdate}
                />
            );

            const favouriteButton = screen.getByRole('button', { name: /お気に入り/ });
            await user.click(favouriteButton);

            await waitFor(() => {
                expect(mastoClient.unfavouriteStatus).toHaveBeenCalledWith({}, '12345');
                expect(onStatusUpdate).toHaveBeenCalledWith(updatedStatus);
            });
        });

        it('should optimistically update UI before API call completes', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ favourited: false, favouritesCount: 5 });
            const accountSession = createMockAccountSession();

            let resolvePromise: (value: mastodon.v1.Status) => void;
            const favouritePromise = new Promise<mastodon.v1.Status>((resolve) => {
                resolvePromise = resolve;
            });

            vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );
            vi.spyOn(mastoClient, 'favouriteStatus').mockReturnValue(favouritePromise);

            await act(async () => {
                render(
                    <StatusDetailModal
                        isOpen={true}
                        onClose={() => {}}
                        status={status}
                        accountSession={accountSession}
                    />
                );
            });

            // Initial count should be 5 (in stats section)
            expect(
                screen.getByText((_content, element) => {
                    return element?.textContent === '5 お気に入り';
                })
            ).toBeInTheDocument();

            const favouriteButton = screen.getByRole('button', { name: /お気に入り/ });
            await act(async () => {
                await user.click(favouriteButton);
            });

            // Count should optimistically update to 6 before API completes
            await waitFor(() => {
                expect(
                    screen.getByText((_content, element) => {
                        return element?.textContent === '6 お気に入り';
                    })
                ).toBeInTheDocument();
            });

            // Resolve the API call
            await act(async () => {
                resolvePromise!(createMockStatus({ favourited: true, favouritesCount: 6 }));
            });
        });

        it('should revert optimistic update on API failure', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ favourited: false, favouritesCount: 5 });
            const accountSession = createMockAccountSession();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );
            vi.spyOn(mastoClient, 'favouriteStatus').mockRejectedValue(new Error('API Error'));

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

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
            expect(
                screen.getByText((_content, element) => {
                    return element?.textContent === '5 お気に入り';
                })
            ).toBeInTheDocument();

            consoleErrorSpy.mockRestore();
        });

        it('should not trigger favourite action when accountSession is not provided', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ favourited: false });
            const favouriteSpy = vi.spyOn(mastoClient, 'favouriteStatus');

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    // No accountSession provided
                />
            );

            const favouriteButton = screen.getByRole('button', { name: /お気に入り/ });
            await user.click(favouriteButton);
            expect(favouriteSpy).not.toHaveBeenCalled();
        });

        it('should prevent multiple simultaneous favourite requests', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ favourited: false, favouritesCount: 5 });
            const accountSession = createMockAccountSession();

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

            await act(async () => {
                render(
                    <StatusDetailModal
                        isOpen={true}
                        onClose={() => {}}
                        status={status}
                        accountSession={accountSession}
                    />
                );
            });

            const favouriteButton = screen.getByRole('button', { name: /お気に入り/ });

            // Click multiple times rapidly
            await act(async () => {
                await user.click(favouriteButton);
                await user.click(favouriteButton);
                await user.click(favouriteButton);
            });

            // Should only call the API once
            expect(favouriteSpy).toHaveBeenCalledTimes(1);

            // Resolve the promise
            await act(async () => {
                resolvePromise!(createMockStatus({ favourited: true, favouritesCount: 6 }));
            });
        });
    });

    describe('reblog button interactions', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should call reblogStatus API when unreblogged status is clicked', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({
                reblogged: false,
                reblogsCount: 3,
                visibility: 'public',
            });
            const accountSession = createMockAccountSession();
            const onStatusUpdate = vi.fn();

            const updatedStatus = createMockStatus({ reblogged: true, reblogsCount: 4 });

            vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );
            vi.spyOn(mastoClient, 'reblogStatus').mockResolvedValue(updatedStatus);

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                    onStatusUpdate={onStatusUpdate}
                />
            );

            const reblogButton = screen.getByRole('button', { name: /ブースト/ });
            await user.click(reblogButton);

            await waitFor(() => {
                expect(mastoClient.reblogStatus).toHaveBeenCalledWith({}, '12345');
                expect(onStatusUpdate).toHaveBeenCalledWith(updatedStatus);
            });
        });

        it('should call unreblogStatus API when reblogged status is clicked', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({
                reblogged: true,
                reblogsCount: 8,
                visibility: 'public',
            });
            const accountSession = createMockAccountSession();
            const onStatusUpdate = vi.fn();

            const updatedStatus = createMockStatus({ reblogged: false, reblogsCount: 7 });

            vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );
            vi.spyOn(mastoClient, 'unreblogStatus').mockResolvedValue(updatedStatus);

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                    onStatusUpdate={onStatusUpdate}
                />
            );

            const reblogButton = screen.getByRole('button', { name: /ブースト/ });
            await user.click(reblogButton);

            await waitFor(() => {
                expect(mastoClient.unreblogStatus).toHaveBeenCalledWith({}, '12345');
                expect(onStatusUpdate).toHaveBeenCalledWith(updatedStatus);
            });
        });

        it('should not allow reblogging private statuses', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ visibility: 'private', reblogsCount: 0 });
            const accountSession = createMockAccountSession();
            const reblogSpy = vi.spyOn(mastoClient, 'reblogStatus');

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            const reblogButton = screen.getByRole('button', { name: /ブースト/ });
            await user.click(reblogButton);
            expect(reblogSpy).not.toHaveBeenCalled();
        });

        it('should not allow reblogging direct messages', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ visibility: 'direct', reblogsCount: 0 });
            const accountSession = createMockAccountSession();
            const reblogSpy = vi.spyOn(mastoClient, 'reblogStatus');

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            const reblogButton = screen.getByRole('button', { name: /ブースト/ });
            await user.click(reblogButton);
            expect(reblogSpy).not.toHaveBeenCalled();
        });

        it('should handle reblog API returning wrapper status', async () => {
            const user = userEvent.setup();
            const originalStatus = createMockStatus({ reblogged: false, reblogsCount: 3 });
            const accountSession = createMockAccountSession();
            const onStatusUpdate = vi.fn();

            // API returns a wrapper status with the actual status in reblog field
            const wrapperStatus = createMockStatus({
                id: 'wrapper-id',
                reblog: createMockStatus({ id: '12345', reblogged: true, reblogsCount: 4 }),
            });

            vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );
            vi.spyOn(mastoClient, 'reblogStatus').mockResolvedValue(wrapperStatus);

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={originalStatus}
                    accountSession={accountSession}
                    onStatusUpdate={onStatusUpdate}
                />
            );

            const reblogButton = screen.getByRole('button', { name: /ブースト/ });
            await user.click(reblogButton);

            await waitFor(() => {
                // Should extract the actual status from the wrapper
                expect(onStatusUpdate).toHaveBeenCalledWith(
                    expect.objectContaining({ id: '12345', reblogged: true, reblogsCount: 4 })
                );
            });
        });

        it('should optimistically update reblog UI before API completes', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ reblogged: false, reblogsCount: 5 });
            const accountSession = createMockAccountSession();

            let resolvePromise: (value: mastodon.v1.Status) => void;
            const reblogPromise = new Promise<mastodon.v1.Status>((resolve) => {
                resolvePromise = resolve;
            });

            vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );
            vi.spyOn(mastoClient, 'reblogStatus').mockReturnValue(reblogPromise);

            await act(async () => {
                render(
                    <StatusDetailModal
                        isOpen={true}
                        onClose={() => {}}
                        status={status}
                        accountSession={accountSession}
                    />
                );
            });

            const reblogButton = screen.getByRole('button', { name: /ブースト/ });
            await act(async () => {
                await user.click(reblogButton);
            });

            // Count should optimistically update to 6
            await waitFor(() => {
                expect(
                    screen.getByText((_content, element) => {
                        return element?.textContent === '6 ブースト';
                    })
                ).toBeInTheDocument();
            });

            await act(async () => {
                resolvePromise!(createMockStatus({ reblogged: true, reblogsCount: 6 }));
            });
        });

        it('should revert optimistic reblog update on API failure', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ reblogged: false, reblogsCount: 5 });
            const accountSession = createMockAccountSession();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );
            vi.spyOn(mastoClient, 'reblogStatus').mockRejectedValue(new Error('Network error'));

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            const reblogButton = screen.getByRole('button', { name: /ブースト/ });
            await user.click(reblogButton);

            // Should revert back to 5 after error
            await waitFor(() => {
                expect(
                    screen.getByText((_content, element) => {
                        return element?.textContent === '5 ブースト';
                    })
                ).toBeInTheDocument();
            });

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to toggle reblog:',
                expect.any(Error)
            );
            consoleErrorSpy.mockRestore();
        });

        it('should not trigger reblog action when accountSession is not provided', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ reblogged: false });
            const reblogSpy = vi.spyOn(mastoClient, 'reblogStatus');

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    // No accountSession
                />
            );

            const reblogButton = screen.getByRole('button', { name: /ブースト/ });
            await user.click(reblogButton);
            expect(reblogSpy).not.toHaveBeenCalled();
        });

        it('should prevent multiple simultaneous reblog requests', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ reblogged: false, reblogsCount: 5 });
            const accountSession = createMockAccountSession();

            let resolvePromise: (value: mastodon.v1.Status) => void;
            const reblogPromise = new Promise<mastodon.v1.Status>((resolve) => {
                resolvePromise = resolve;
            });

            vi.spyOn(mastoClient, 'getClient').mockReturnValue(
                {} as ReturnType<typeof mastoClient.getClient>
            );
            const reblogSpy = vi.spyOn(mastoClient, 'reblogStatus').mockReturnValue(reblogPromise);

            await act(async () => {
                render(
                    <StatusDetailModal
                        isOpen={true}
                        onClose={() => {}}
                        status={status}
                        accountSession={accountSession}
                    />
                );
            });

            const reblogButton = screen.getByRole('button', { name: /ブースト/ });

            // Click multiple times rapidly
            await act(async () => {
                await user.click(reblogButton);
                await user.click(reblogButton);
                await user.click(reblogButton);
            });

            // Should only call once
            expect(reblogSpy).toHaveBeenCalledTimes(1);

            await act(async () => {
                resolvePromise!(createMockStatus({ reblogged: true, reblogsCount: 6 }));
            });
        });
    });

    describe('thread navigation', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        const createAncestorStatus = () =>
            createMockStatus({
                id: 'ancestor-1',
                content: '<p>Ancestor post content</p>',
                account: {
                    ...createMockStatus().account,
                    id: 'ancestor-user',
                    displayName: 'Ancestor User',
                    acct: 'ancestoruser',
                },
            });

        const createDescendantStatus = () =>
            createMockStatus({
                id: 'descendant-1',
                content: '<p>Descendant post content</p>',
                inReplyToId: '12345',
                account: {
                    ...createMockStatus().account,
                    id: 'descendant-user',
                    displayName: 'Descendant User',
                    acct: 'descendantuser',
                },
            });

        it('should re-fetch context when an ancestor is clicked', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();
            const accountSession = createMockAccountSession();
            const ancestor = createAncestorStatus();

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestor],
                descendants: [],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            // Wait for initial context to load
            await waitFor(() => {
                expect(screen.getByText('Ancestor User')).toBeInTheDocument();
            });

            // Initial fetch was for status '12345'
            expect(mastoClient.getStatusContext).toHaveBeenCalledWith(expect.anything(), '12345');

            // Setup mock for the next fetch
            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [],
            });

            // Click the ancestor ThreadItem (click on the content text)
            const ancestorContent = screen.getByText('Ancestor post content');
            await user.click(ancestorContent);

            // Should re-fetch with the ancestor's ID
            await waitFor(() => {
                expect(mastoClient.getStatusContext).toHaveBeenCalledWith(
                    expect.anything(),
                    'ancestor-1'
                );
            });
        });

        it('should re-fetch context when a descendant is clicked', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();
            const accountSession = createMockAccountSession();
            const descendant = createDescendantStatus();

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [descendant],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Descendant User')).toBeInTheDocument();
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [],
            });

            const descendantContent = screen.getByText('Descendant post content');
            await user.click(descendantContent);

            await waitFor(() => {
                expect(mastoClient.getStatusContext).toHaveBeenCalledWith(
                    expect.anything(),
                    'descendant-1'
                );
            });
        });

        it('should update main status content after navigation', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ content: '<p>Original main content</p>' });
            const accountSession = createMockAccountSession();
            const ancestor = createAncestorStatus();

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestor],
                descendants: [],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Ancestor User')).toBeInTheDocument();
            });

            // Main content should show original
            expect(screen.getByText('Original main content')).toBeInTheDocument();

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [],
            });

            const ancestorContent = screen.getByText('Ancestor post content');
            await user.click(ancestorContent);

            // After navigation, main status should show ancestor's content
            await waitFor(() => {
                // The ancestor content should now be the main display
                expect(screen.getByText('Ancestor post content')).toBeInTheDocument();
                expect(screen.getByText('Ancestor User')).toBeInTheDocument();
            });
        });

        it('should not navigate when clicking a link inside ThreadItem', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();
            const accountSession = createMockAccountSession();
            const ancestor = createAncestorStatus();

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestor],
                descendants: [],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Ancestor User')).toBeInTheDocument();
            });

            const initialCallCount = vi.mocked(mastoClient.getStatusContext).mock.calls.length;

            // Click on a link (avatar/username link) inside the ThreadItem
            const avatarLink = screen.getByAltText('Ancestor User').closest('a')!;
            await user.click(avatarLink);

            // Should NOT re-fetch context - call count should remain the same
            expect(vi.mocked(mastoClient.getStatusContext).mock.calls.length).toBe(
                initialCallCount
            );
        });

        it('should navigate when Enter key is pressed on ThreadItem', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();
            const accountSession = createMockAccountSession();
            const ancestor = createAncestorStatus();

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestor],
                descendants: [],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Ancestor User')).toBeInTheDocument();
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [],
            });

            // Find the ThreadItem button and press Enter
            const threadItemButton = screen.getByRole('button', {
                name: /Ancestor Userの投稿を表示/,
            });
            threadItemButton.focus();
            await user.keyboard('{Enter}');

            await waitFor(() => {
                expect(mastoClient.getStatusContext).toHaveBeenCalledWith(
                    expect.anything(),
                    'ancestor-1'
                );
            });
        });

        it('should navigate when Space key is pressed on ThreadItem', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();
            const accountSession = createMockAccountSession();
            const ancestor = createAncestorStatus();

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestor],
                descendants: [],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Ancestor User')).toBeInTheDocument();
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [],
            });

            const threadItemButton = screen.getByRole('button', {
                name: /Ancestor Userの投稿を表示/,
            });
            threadItemButton.focus();
            await user.keyboard(' ');

            await waitFor(() => {
                expect(mastoClient.getStatusContext).toHaveBeenCalledWith(
                    expect.anything(),
                    'ancestor-1'
                );
            });
        });

        it('should not navigate when keyboard is used on interactive elements within ThreadItem', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();
            const accountSession = createMockAccountSession();

            const ancestor = createMockStatus({
                id: 'ancestor-1',
                content: '<p>Check this <a href="https://example.com">link</a></p>',
                account: {
                    ...createMockStatus().account,
                    displayName: 'Ancestor User',
                    acct: 'ancestoruser',
                },
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestor],
                descendants: [],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Ancestor User')).toBeInTheDocument();
            });

            const initialCallCount = vi.mocked(mastoClient.getStatusContext).mock.calls.length;

            // Find the link within the ThreadItem
            const link = screen.getByRole('link', { name: /link/ });
            link.focus();

            // Press Enter on the link - should not trigger navigation
            await user.keyboard('{Enter}');

            // getStatusContext should not be called again (navigation didn't happen)
            // Assert synchronously - no need to wait as the interaction is synchronous
            expect(vi.mocked(mastoClient.getStatusContext).mock.calls.length).toBe(
                initialCallCount
            );
        });

        it('should reset navigation state when modal is closed and reopened', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ content: '<p>Original main content</p>' });
            const accountSession = createMockAccountSession();
            const ancestor = createAncestorStatus();

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestor],
                descendants: [],
            });

            const TestWrapper = () => {
                const [isOpen, setIsOpen] = useState(true);
                return (
                    <>
                        <button data-testid="toggle" onClick={() => setIsOpen((prev) => !prev)}>
                            Toggle
                        </button>
                        <StatusDetailModal
                            isOpen={isOpen}
                            onClose={() => setIsOpen(false)}
                            status={status}
                            accountSession={accountSession}
                        />
                    </>
                );
            };

            render(<TestWrapper />);

            await waitFor(() => {
                expect(screen.getByText('Ancestor User')).toBeInTheDocument();
            });

            // Navigate to ancestor
            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [],
            });

            const ancestorContent = screen.getByText('Ancestor post content');
            await user.click(ancestorContent);

            await waitFor(() => {
                expect(mastoClient.getStatusContext).toHaveBeenCalledWith(
                    expect.anything(),
                    'ancestor-1'
                );
            });

            // Close and reopen
            const closeButton = screen.getByRole('button', { name: '閉じる' });
            await user.click(closeButton);

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestor],
                descendants: [],
            });

            const toggleButton = screen.getByTestId('toggle');
            await user.click(toggleButton);

            // Should show original content again
            await waitFor(() => {
                expect(screen.getByText('Original main content')).toBeInTheDocument();
            });
        });

        it('should hide reblog indicator after navigating within thread', async () => {
            const user = userEvent.setup();
            const originalStatus = createMockStatus({
                id: 'original-1',
                content: '<p>Original reblogged content</p>',
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

            const accountSession = createMockAccountSession();
            const descendant = createDescendantStatus();

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [descendant],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={reblogStatus}
                    accountSession={accountSession}
                />
            );

            // Reblog indicator should be visible initially
            await waitFor(() => {
                expect(screen.getByText(/がブースト/)).toBeInTheDocument();
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [],
            });

            // Navigate to descendant
            const descendantContent = screen.getByText('Descendant post content');
            await user.click(descendantContent);

            // Reblog indicator should disappear
            await waitFor(() => {
                expect(screen.queryByText(/がブースト/)).not.toBeInTheDocument();
            });
        });

        it('should have correct accessibility attributes on ThreadItems', async () => {
            const status = createMockStatus();
            const accountSession = createMockAccountSession();
            const ancestor = createAncestorStatus();
            const descendant = createDescendantStatus();

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestor],
                descendants: [descendant],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Ancestor User')).toBeInTheDocument();
            });

            // Both ThreadItems should have button role
            const threadButtons = screen
                .getAllByRole('button')
                .filter((btn) => btn.getAttribute('aria-label')?.includes('の投稿を表示'));
            expect(threadButtons).toHaveLength(2);

            // Check ancestor ThreadItem - div with role="button" and tabIndex
            const ancestorButton = screen.getByRole('button', {
                name: /Ancestor Userの投稿を表示/,
            });
            expect(ancestorButton).toBeInTheDocument();
            expect(ancestorButton).toHaveAttribute('role', 'button');
            expect(ancestorButton).toHaveAttribute('tabindex', '0');

            // Check descendant ThreadItem
            const descendantButton = screen.getByRole('button', {
                name: /Descendant Userの投稿を表示/,
            });
            expect(descendantButton).toBeInTheDocument();
            expect(descendantButton).toHaveAttribute('role', 'button');
            expect(descendantButton).toHaveAttribute('tabindex', '0');
        });
    });

    describe('thread context', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should display loading indicator while fetching context', async () => {
            const status = createMockStatus();
            const accountSession = createMockAccountSession();

            // Create a promise that doesn't resolve immediately
            let resolveContext: (value: {
                ancestors: mastodon.v1.Status[];
                descendants: mastodon.v1.Status[];
            }) => void;
            const contextPromise = new Promise<{
                ancestors: mastodon.v1.Status[];
                descendants: mastodon.v1.Status[];
            }>((resolve) => {
                resolveContext = resolve;
            });

            vi.mocked(mastoClient.getStatusContext).mockReturnValue(contextPromise);

            await act(async () => {
                render(
                    <StatusDetailModal
                        isOpen={true}
                        onClose={() => {}}
                        status={status}
                        accountSession={accountSession}
                    />
                );
            });

            // Should show loading indicator
            expect(screen.getByText('スレッドを読み込み中...')).toBeInTheDocument();

            // Resolve the context and wait for loading to complete
            await act(async () => {
                resolveContext!({ ancestors: [], descendants: [] });
                await contextPromise;
            });

            // Loading indicator should no longer be present
            expect(screen.queryByText('スレッドを読み込み中...')).not.toBeInTheDocument();
        });

        it('should display ancestors when present', async () => {
            const status = createMockStatus();
            const accountSession = createMockAccountSession();

            const ancestorStatus = createMockStatus({
                id: 'ancestor-1',
                content: '<p>This is the parent post</p>',
                account: {
                    ...createMockStatus().account,
                    id: 'parent-user',
                    displayName: 'Parent User',
                    acct: 'parentuser',
                },
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestorStatus],
                descendants: [],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('このスレッドの上の投稿')).toBeInTheDocument();
                expect(screen.getByText('Parent User')).toBeInTheDocument();
            });
        });

        it('should display descendants when present', async () => {
            const status = createMockStatus();
            const accountSession = createMockAccountSession();

            const replyStatus = createMockStatus({
                id: 'reply-1',
                content: '<p>This is a reply</p>',
                account: {
                    ...createMockStatus().account,
                    id: 'reply-user',
                    displayName: 'Reply User',
                    acct: 'replyuser',
                },
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [replyStatus],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('返信 (1)')).toBeInTheDocument();
                expect(screen.getByText('Reply User')).toBeInTheDocument();
            });
        });

        it('should show error message when context fetch fails', async () => {
            const status = createMockStatus();
            const accountSession = createMockAccountSession();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            vi.mocked(mastoClient.getStatusContext).mockRejectedValue(new Error('Network error'));

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('スレッドの読み込みに失敗しました')).toBeInTheDocument();
            });

            consoleErrorSpy.mockRestore();
        });

        it('should not fetch context when accountSession is not provided', () => {
            const status = createMockStatus();

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    // No accountSession
                />
            );

            // Should not call getStatusContext
            expect(mastoClient.getStatusContext).not.toHaveBeenCalled();
        });

        it('should correctly calculate depth for nested replies regardless of ordering', async () => {
            const status = createMockStatus({ id: 'main-status' });
            const accountSession = createMockAccountSession();

            // Create a nested reply structure:
            // main-status (not in descendants)
            //   └─ reply-1 (depth 0)
            //        └─ reply-2 (depth 1)
            //             └─ reply-3 (depth 2)
            // But return them in reverse chronological order (child before parent)
            const reply1 = createMockStatus({
                id: 'reply-1',
                inReplyToId: 'main-status',
                content: '<p>First level reply</p>',
                account: {
                    ...createMockStatus().account,
                    id: 'user1',
                    displayName: 'User 1',
                    acct: 'user1',
                },
            });

            const reply2 = createMockStatus({
                id: 'reply-2',
                inReplyToId: 'reply-1',
                content: '<p>Second level reply</p>',
                account: {
                    ...createMockStatus().account,
                    id: 'user2',
                    displayName: 'User 2',
                    acct: 'user2',
                },
            });

            const reply3 = createMockStatus({
                id: 'reply-3',
                inReplyToId: 'reply-2',
                content: '<p>Third level reply</p>',
                account: {
                    ...createMockStatus().account,
                    id: 'user3',
                    displayName: 'User 3',
                    acct: 'user3',
                },
            });

            // Return descendants in problematic order: deepest first
            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [reply3, reply2, reply1],
            });

            const { container } = render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('User 1')).toBeInTheDocument();
                expect(screen.getByText('User 2')).toBeInTheDocument();
                expect(screen.getByText('User 3')).toBeInTheDocument();
            });

            // Check that indentation is applied correctly
            // reply-1 should have marginLeft: 0px (depth 0)
            // reply-2 should have marginLeft: 16px (depth 1)
            // reply-3 should have marginLeft: 32px (depth 2)
            const replyElements = container.querySelectorAll('[role="button"]');

            // Find each reply by checking for the user name
            const reply1Element = Array.from(replyElements).find((el) =>
                el.textContent?.includes('User 1')
            );
            const reply2Element = Array.from(replyElements).find((el) =>
                el.textContent?.includes('User 2')
            );
            const reply3Element = Array.from(replyElements).find((el) =>
                el.textContent?.includes('User 3')
            );

            expect(reply1Element).toHaveStyle({ marginLeft: '0px' });
            expect(reply2Element).toHaveStyle({ marginLeft: '16px' });
            expect(reply3Element).toHaveStyle({ marginLeft: '32px' });
        });

        it('should clear error message when navigating to another status', async () => {
            const status = createMockStatus();
            const accountSession = createMockAccountSession();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const ancestor = createMockStatus({
                id: 'ancestor-1',
                content: '<p>Ancestor post</p>',
                account: {
                    ...createMockStatus().account,
                    displayName: 'Ancestor User',
                    acct: 'ancestoruser',
                },
            });

            // First fetch fails
            vi.mocked(mastoClient.getStatusContext).mockRejectedValueOnce(
                new Error('Network error')
            );

            const { rerender } = render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            // Error message should appear
            await waitFor(() => {
                expect(screen.getByText('スレッドの読み込みに失敗しました')).toBeInTheDocument();
            });

            // Setup successful fetch with ancestor for reopening
            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestor],
                descendants: [],
            });

            // Close and reopen modal (simulates navigation by changing status)
            rerender(
                <StatusDetailModal
                    isOpen={false}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            rerender(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            // Wait for ancestor to appear (successful fetch)
            await waitFor(() => {
                expect(screen.getByText('Ancestor User')).toBeInTheDocument();
            });

            // Error message should be cleared
            expect(screen.queryByText('スレッドの読み込みに失敗しました')).not.toBeInTheDocument();

            consoleErrorSpy.mockRestore();
        });

        it('should handle circular references in thread depth calculation', async () => {
            const status = createMockStatus({ id: 'main-status' });
            const accountSession = createMockAccountSession();

            // Create a circular reference: reply1 -> reply2 -> reply1
            const reply1 = createMockStatus({
                id: 'reply-1',
                inReplyToId: 'main-status',
                content: '<p>Reply 1</p>',
                account: {
                    ...createMockStatus().account,
                    displayName: 'User 1',
                },
            });

            const reply2 = createMockStatus({
                id: 'reply-2',
                inReplyToId: 'reply-1', // Points to reply-1
                content: '<p>Reply 2 (circular)</p>',
                account: {
                    ...createMockStatus().account,
                    displayName: 'User 2',
                },
            });

            // Simulate circular reference by modifying reply1's inReplyToId
            const reply1Circular = {
                ...reply1,
                inReplyToId: 'reply-2', // Creates cycle: reply1 -> reply2 -> reply1
            };

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [reply1Circular, reply2],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            // Should render without crashing despite circular reference
            await waitFor(() => {
                expect(screen.getByText('User 1')).toBeInTheDocument();
                expect(screen.getByText('User 2')).toBeInTheDocument();
            });
        });

        it('should handle very deep thread chains without stack overflow', async () => {
            const status = createMockStatus({ id: 'main-status' });
            const accountSession = createMockAccountSession();

            // Create an extremely deep thread chain (100 levels) to test iterative implementation
            const deepReplies: mastodon.v1.Status[] = [];
            for (let i = 0; i < 100; i++) {
                deepReplies.push(
                    createMockStatus({
                        id: `reply-${i}`,
                        inReplyToId: i === 0 ? 'main-status' : `reply-${i - 1}`,
                        content: `<p>Level ${i}</p>`,
                        account: {
                            ...createMockStatus().account,
                            displayName: `User ${i}`,
                        },
                    })
                );
            }

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: deepReplies,
            });

            // Should not throw stack overflow error
            expect(() => {
                render(
                    <StatusDetailModal
                        isOpen={true}
                        onClose={() => {}}
                        status={status}
                        accountSession={accountSession}
                    />
                );
            }).not.toThrow();

            // Should render successfully
            await waitFor(() => {
                expect(screen.getByText('User 0')).toBeInTheDocument();
                expect(screen.getByText('User 99')).toBeInTheDocument();
            });

            // Verify that depth is capped at UI maxDepth (3)
            // The calculation returns up to MAX_DEPTH=10, but UI caps display at maxDepth=3
            // So the deepest reply should have marginLeft = 3 * 16 = 48px
            const container = screen.getByRole('dialog');
            const replyElements = container.querySelectorAll('[role="button"]');
            const deepestReply = Array.from(replyElements).find((el) =>
                el.textContent?.includes('User 99')
            );

            // UI caps indentation at maxDepth=3, so marginLeft should be 48px
            expect(deepestReply).toHaveStyle({ marginLeft: '48px' });
        });
    });

    describe('ThreadItem content warning click behavior', () => {
        it('should NOT navigate when clicking on CW summary', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();
            const accountSession = createMockAccountSession();

            // Create an ancestor with CW
            const ancestorWithCW = createMockStatus({
                id: 'ancestor-with-cw-summary',
                content: '<p>Hidden content</p>',
                spoilerText: 'Thread spoiler!',
                account: {
                    ...createMockStatus().account,
                    displayName: 'Ancestor With CW Summary',
                },
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestorWithCW],
                descendants: [],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    status={status}
                    onClose={() => {}}
                    accountSession={accountSession}
                />
            );

            // Wait for initial context to load
            await waitFor(() => {
                expect(screen.getByText('Ancestor With CW Summary')).toBeInTheDocument();
            });

            const initialCallCount = vi.mocked(mastoClient.getStatusContext).mock.calls.length;

            // Find the ThreadItem container and get the CW summary within it
            const threadItem = screen
                .getByText('Ancestor With CW Summary')
                .closest('[role="button"]');
            expect(threadItem).toBeInTheDocument();
            if (!threadItem) throw new Error('ThreadItem not found');

            const summary = threadItem.querySelector('summary');
            expect(summary).toBeInTheDocument();
            if (!summary) throw new Error('CW summary not found in ThreadItem');

            await user.click(summary);

            // Should NOT navigate - getStatusContext call count should remain the same
            expect(vi.mocked(mastoClient.getStatusContext).mock.calls.length).toBe(
                initialCallCount
            );
        });

        it('should re-fetch context when clicking on expanded CW content in thread', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();
            const accountSession = createMockAccountSession();

            // Create an ancestor with CW
            const ancestorWithCW = createMockStatus({
                id: 'ancestor-with-cw',
                content: '<p>This content is hidden</p>',
                spoilerText: 'Spoiler warning!',
                account: {
                    ...createMockStatus().account,
                    displayName: 'Ancestor With CW',
                },
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestorWithCW],
                descendants: [],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    status={status}
                    onClose={() => {}}
                    accountSession={accountSession}
                />
            );

            // Wait for initial context to load
            await waitFor(() => {
                expect(screen.getByText('Ancestor With CW')).toBeInTheDocument();
            });

            // Initial fetch was for status '12345'
            expect(mastoClient.getStatusContext).toHaveBeenCalledWith(expect.anything(), '12345');

            // Setup mock for the next fetch
            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [],
            });

            // Find and expand the CW
            const summary = Array.from(document.querySelectorAll('summary')).find((el) =>
                el.textContent?.includes('Spoiler warning!')
            );

            expect(summary).toBeInTheDocument();
            if (!summary) throw new Error('Summary not found');

            await user.click(summary);

            // Click on the expanded CW content to navigate
            // Find the ThreadItem container and get the status-content within it
            const threadItem = screen.getByText('Ancestor With CW').closest('[role="button"]');
            expect(threadItem).toBeInTheDocument();
            if (!threadItem) throw new Error('ThreadItem not found');

            const cwContent = threadItem.querySelector('.status-content');
            expect(cwContent).toBeInTheDocument();
            if (!cwContent) throw new Error('CW content not found in ThreadItem');

            await user.click(cwContent);

            // Should re-fetch context with the ancestor's ID
            await waitFor(() => {
                expect(mastoClient.getStatusContext).toHaveBeenCalledWith(
                    expect.anything(),
                    'ancestor-with-cw'
                );
            });
        });

        it('should NOT navigate when clicking links in CW thread content', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();
            const accountSession = createMockAccountSession();

            // Create an ancestor with CW containing a link
            const ancestorWithCW = createMockStatus({
                id: 'ancestor-with-cw-link',
                content: '<p>Text with <a href="https://example.com">link</a></p>',
                spoilerText: 'CW with link',
                account: {
                    ...createMockStatus().account,
                    displayName: 'Ancestor With CW Link',
                },
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestorWithCW],
                descendants: [],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    status={status}
                    onClose={() => {}}
                    accountSession={accountSession}
                />
            );

            // Wait for initial context to load
            await waitFor(() => {
                expect(screen.getByText('Ancestor With CW Link')).toBeInTheDocument();
            });

            const initialCallCount = vi.mocked(mastoClient.getStatusContext).mock.calls.length;

            // Find and expand the CW
            const summary = Array.from(document.querySelectorAll('summary')).find((el) =>
                el.textContent?.includes('CW with link')
            );

            expect(summary).toBeInTheDocument();
            if (!summary) throw new Error('Summary not found');

            await user.click(summary);

            // Click on the link inside the expanded CW content
            // Find the ThreadItem container and get the link within it
            const threadItem = screen.getByText('Ancestor With CW Link').closest('[role="button"]');
            expect(threadItem).toBeInTheDocument();
            if (!threadItem) throw new Error('ThreadItem not found');

            const link = threadItem.querySelector('a[href="https://example.com"]');
            expect(link).toBeInTheDocument();
            if (!link) throw new Error('Link not found in ThreadItem');

            await user.click(link);

            // Should NOT re-fetch context - call count should remain the same
            expect(vi.mocked(mastoClient.getStatusContext).mock.calls.length).toBe(
                initialCallCount
            );
        });

        it('should NOT navigate when pressing Enter on CW summary in ThreadItem', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();
            const accountSession = createMockAccountSession();

            const ancestorWithCW = createMockStatus({
                id: 'ancestor-with-cw-keyboard',
                content: '<p>Hidden content</p>',
                spoilerText: 'Keyboard test CW',
                account: {
                    ...createMockStatus().account,
                    displayName: 'Ancestor With CW Keyboard',
                },
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [ancestorWithCW],
                descendants: [],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    status={status}
                    onClose={() => {}}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Ancestor With CW Keyboard')).toBeInTheDocument();
            });

            const initialCallCount = vi.mocked(mastoClient.getStatusContext).mock.calls.length;

            // Find the ThreadItem container and get the CW summary within it
            const threadItem = screen
                .getByText('Ancestor With CW Keyboard')
                .closest('[role="button"]');
            expect(threadItem).toBeInTheDocument();
            if (!threadItem) throw new Error('ThreadItem not found');

            const summary = threadItem.querySelector('summary');
            expect(summary).toBeInTheDocument();
            if (!summary) throw new Error('CW summary not found in ThreadItem');

            summary.focus();
            await user.keyboard('{Enter}');

            expect(vi.mocked(mastoClient.getStatusContext).mock.calls.length).toBe(
                initialCallCount
            );
        });

        it('should NOT navigate when pressing Space on CW summary in ThreadItem', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();
            const accountSession = createMockAccountSession();

            const descendantWithCW = createMockStatus({
                id: 'descendant-with-cw-keyboard',
                content: '<p>Hidden content</p>',
                spoilerText: 'Space test CW',
                account: {
                    ...createMockStatus().account,
                    displayName: 'Descendant With CW Keyboard',
                },
            });

            vi.mocked(mastoClient.getStatusContext).mockResolvedValue({
                ancestors: [],
                descendants: [descendantWithCW],
            });

            render(
                <StatusDetailModal
                    isOpen={true}
                    status={status}
                    onClose={() => {}}
                    accountSession={accountSession}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Descendant With CW Keyboard')).toBeInTheDocument();
            });

            const initialCallCount = vi.mocked(mastoClient.getStatusContext).mock.calls.length;

            // Find the ThreadItem container and get the CW summary within it
            const threadItem = screen
                .getByText('Descendant With CW Keyboard')
                .closest('[role="button"]');
            expect(threadItem).toBeInTheDocument();
            if (!threadItem) throw new Error('ThreadItem not found');

            const summary = threadItem.querySelector('summary');
            expect(summary).toBeInTheDocument();
            if (!summary) throw new Error('CW summary not found in ThreadItem');

            summary.focus();
            await user.keyboard(' ');

            expect(vi.mocked(mastoClient.getStatusContext).mock.calls.length).toBe(
                initialCallCount
            );
        });
    });
});
