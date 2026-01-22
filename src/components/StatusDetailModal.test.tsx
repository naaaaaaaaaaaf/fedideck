import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

    describe('focus management', () => {
        it('should have proper ARIA attributes for accessibility', () => {
            const status = createMockStatus();
            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                />
            );

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-labelledby', 'status-detail-title');
        });

        it('should focus close button when modal opens', () => {
            const status = createMockStatus();
            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                />
            );

            const closeButton = screen.getByRole('button', { name: '閉じる' });
            expect(closeButton).toHaveFocus();
        });

        it('should call onClose when Escape key is pressed', async () => {
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

            await user.keyboard('{Escape}');

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should trap focus within modal when Tab is pressed', async () => {
            const user = userEvent.setup();
            const status = createMockStatus();

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                />
            );

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

        it('should not show favourite button as active when status is not favourited', () => {
            const status = createMockStatus({ favourited: false });
            const accountSession = createMockAccountSession();

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            // Find all buttons and locate favourite button by checking for star icon
            const buttons = screen.getAllByRole('button');
            const favouriteButton = buttons.find(btn => btn.querySelector('svg'));
            
            // The button should not have the filled star or active color class
            expect(favouriteButton?.className).not.toMatch(/text-amber-400/);
        });

        it('should show favourite button as active when status is favourited', () => {
            const status = createMockStatus({ favourited: true, favouritesCount: 10 });
            const accountSession = createMockAccountSession();

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            // Favourite count should be visible
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it('should call favouriteStatus API when unfavourited status is clicked', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ favourited: false, favouritesCount: 5 });
            const accountSession = createMockAccountSession();
            const onStatusUpdate = vi.fn();

            const updatedStatus = createMockStatus({ favourited: true, favouritesCount: 6 });
            
            vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as ReturnType<typeof mastoClient.getClient>);
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
            
            vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as ReturnType<typeof mastoClient.getClient>);
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

            vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as ReturnType<typeof mastoClient.getClient>);
            vi.spyOn(mastoClient, 'favouriteStatus').mockReturnValue(favouritePromise);

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            // Initial count should be 5 (in stats section)
            expect(screen.getByText((_content, element) => {
                return element?.textContent === '5 お気に入り';
            })).toBeInTheDocument();

            const favouriteButton = screen.getByRole('button', { name: /お気に入り/ });
            await user.click(favouriteButton);

            // Count should optimistically update to 6 before API completes
            await waitFor(() => {
                expect(screen.getByText((_content, element) => {
                    return element?.textContent === '6 お気に入り';
                })).toBeInTheDocument();
            });

            // Resolve the API call
            resolvePromise!(createMockStatus({ favourited: true, favouritesCount: 6 }));
        });

        it('should revert optimistic update on API failure', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ favourited: false, favouritesCount: 5 });
            const accountSession = createMockAccountSession();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as ReturnType<typeof mastoClient.getClient>);
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
                expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to toggle favourite:', expect.any(Error));
            });

            // Count should be back to 5
            expect(screen.getByText((_content, element) => {
                return element?.textContent === '5 お気に入り';
            })).toBeInTheDocument();

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

            vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as ReturnType<typeof mastoClient.getClient>);
            const favouriteSpy = vi.spyOn(mastoClient, 'favouriteStatus').mockReturnValue(favouritePromise);

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            const favouriteButton = screen.getByRole('button', { name: /お気に入り/ });

            // Click multiple times rapidly
            await user.click(favouriteButton);
            await user.click(favouriteButton);
            await user.click(favouriteButton);

            // Should only call the API once
            expect(favouriteSpy).toHaveBeenCalledTimes(1);

            // Resolve the promise
            resolvePromise!(createMockStatus({ favourited: true, favouritesCount: 6 }));
        });
    });

    describe('reblog button interactions', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should call reblogStatus API when unreblogged status is clicked', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ reblogged: false, reblogsCount: 3, visibility: 'public' });
            const accountSession = createMockAccountSession();
            const onStatusUpdate = vi.fn();

            const updatedStatus = createMockStatus({ reblogged: true, reblogsCount: 4 });
            
            vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as ReturnType<typeof mastoClient.getClient>);
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
            const status = createMockStatus({ reblogged: true, reblogsCount: 8, visibility: 'public' });
            const accountSession = createMockAccountSession();
            const onStatusUpdate = vi.fn();

            const updatedStatus = createMockStatus({ reblogged: false, reblogsCount: 7 });
            
            vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as ReturnType<typeof mastoClient.getClient>);
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
            
            vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as ReturnType<typeof mastoClient.getClient>);
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

            vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as ReturnType<typeof mastoClient.getClient>);
            vi.spyOn(mastoClient, 'reblogStatus').mockReturnValue(reblogPromise);

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

            // Count should optimistically update to 6
            await waitFor(() => {
                expect(screen.getByText((_content, element) => {
                    return element?.textContent === '6 ブースト';
                })).toBeInTheDocument();
            });

            resolvePromise!(createMockStatus({ reblogged: true, reblogsCount: 6 }));
        });

        it('should revert optimistic reblog update on API failure', async () => {
            const user = userEvent.setup();
            const status = createMockStatus({ reblogged: false, reblogsCount: 5 });
            const accountSession = createMockAccountSession();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as ReturnType<typeof mastoClient.getClient>);
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
                expect(screen.getByText((_content, element) => {
                    return element?.textContent === '5 ブースト';
                })).toBeInTheDocument();
            });

            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to toggle reblog:', expect.any(Error));
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

            vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as ReturnType<typeof mastoClient.getClient>);
            const reblogSpy = vi.spyOn(mastoClient, 'reblogStatus').mockReturnValue(reblogPromise);

            render(
                <StatusDetailModal
                    isOpen={true}
                    onClose={() => {}}
                    status={status}
                    accountSession={accountSession}
                />
            );

            const reblogButton = screen.getByRole('button', { name: /ブースト/ });

            // Click multiple times rapidly
            await user.click(reblogButton);
            await user.click(reblogButton);
            await user.click(reblogButton);

            // Should only call once
            expect(reblogSpy).toHaveBeenCalledTimes(1);

            resolvePromise!(createMockStatus({ reblogged: true, reblogsCount: 6 }));
        });
    });
});
