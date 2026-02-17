import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { mastodon } from 'masto';
import { ComposeModal } from './ComposeModal';
import * as mastoClient from '../api/mastoClient';
import { useAccountsStore } from '../store/accounts';
import type { Session } from '../auth/sessions';

// Mock the mastoClient module
vi.mock('../api/mastoClient', () => ({
    getClient: vi.fn(() => ({
        v1: {
            instance: {
                fetch: vi.fn(),
            },
        },
    })),
    createStatus: vi.fn(),
    uploadMedia: vi.fn().mockResolvedValue({ id: 'mock-media-id' }),
    waitForMediaReady: vi.fn().mockResolvedValue(undefined),
    getStatusSource: vi.fn().mockResolvedValue({
        id: 'status-123',
        text: 'Original post text',
        spoilerText: '',
    }),
    editStatus: vi.fn().mockResolvedValue({} as unknown as mastodon.v1.Status),
}));

// Mock the instanceConfig module
vi.mock('../api/instanceConfig', () => ({
    getInstanceConfig: vi.fn().mockResolvedValue({
        maxCharacters: 500,
        maxMediaAttachments: 4,
        supportedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/webm',
        ],
    }),
    getDefaultConfig: vi.fn(() => ({
        maxCharacters: 500,
        maxMediaAttachments: 4,
        supportedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/webm',
        ],
    })),
    clearInstanceConfigCache: vi.fn(),
}));

// Mock account data - using type assertion for test mock
const mockAccount = {
    id: 'test-account-1',
    instanceUrl: 'https://mastodon.social',
    accessToken: 'test-token',
    account: {
        id: '123',
        username: 'testuser',
        acct: 'testuser',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.png',
    },
    createdAt: Date.now(),
} as Session;

describe('ComposeModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset store state and set mock account
        useAccountsStore.setState({
            accounts: [mockAccount],
            activeAccountId: mockAccount.id,
        });
    });

    it('renders nothing when isOpen is false', () => {
        const { container } = render(<ComposeModal isOpen={false} onClose={() => {}} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the modal when isOpen is true', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} />);
        // Use findBy* to wait for async instance config fetching to complete
        expect(await screen.findByText('新しい投稿')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('今なにしてる？')).toBeInTheDocument();
    });

    it('displays the active account info', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} />);
        // Use findBy* to wait for async instance config fetching to complete
        expect(await screen.findByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('@testuser')).toBeInTheDocument();
    });

    it('shows character count', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} />);
        // Use findBy* to wait for async instance config fetching to complete
        expect(await screen.findByText('500')).toBeInTheDocument();
    });

    it('updates character count when typing', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => {}} />);

        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Hello world');

        expect(screen.getByText('489')).toBeInTheDocument();
    });

    it('disables submit button when content is empty', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} />);
        // Use findBy* to wait for async instance config fetching to complete
        const submitButton = await screen.findByRole('button', { name: /投稿を送信/ });
        expect(submitButton).toBeDisabled();
    });

    it('enables submit button when content is not empty', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => {}} />);

        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Test post');

        const submitButton = screen.getByRole('button', { name: /投稿を送信/ });
        expect(submitButton).not.toBeDisabled();
    });

    it('toggles CW input when clicking CW button', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => {}} />);

        // CW input should not be visible initially
        expect(screen.queryByPlaceholderText('警告文を入力...')).not.toBeInTheDocument();

        // Click CW button
        const cwButton = screen.getByRole('button', { name: /CW/i });
        await user.click(cwButton);

        // CW input should now be visible
        expect(screen.getByPlaceholderText('警告文を入力...')).toBeInTheDocument();
    });

    it('displays visibility options', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} />);
        // Use findBy* to wait for async instance config fetching to complete
        expect(await screen.findByText('公開')).toBeInTheDocument();
        expect(screen.getByText('未収載')).toBeInTheDocument();
        expect(screen.getByText('フォロワーのみ')).toBeInTheDocument();
        expect(screen.getByText('ダイレクト')).toBeInTheDocument();
    });

    it('calls onClose when cancel button is clicked', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<ComposeModal isOpen={true} onClose={onClose} />);

        // Use findBy* to wait for async instance config fetching to complete
        const cancelButton = await screen.findByRole('button', { name: 'キャンセル' });
        await user.click(cancelButton);

        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<ComposeModal isOpen={true} onClose={onClose} />);

        // Use findBy* to wait for async instance config fetching to complete
        await screen.findByRole('button', { name: 'キャンセル' });

        // Click the backdrop (the first div with absolute positioning)
        const backdrop = document.querySelector('.bg-black\\/60');
        if (backdrop) {
            await user.click(backdrop);
        }

        expect(onClose).toHaveBeenCalled();
    });

    it('submits the post and closes modal on success', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const mockCreateStatus = vi.mocked(mastoClient.createStatus);
        mockCreateStatus.mockResolvedValueOnce({} as unknown as mastodon.v1.Status);

        render(<ComposeModal isOpen={true} onClose={onClose} />);

        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Test post content');

        const submitButton = screen.getByRole('button', { name: /投稿を送信/ });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockCreateStatus).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    status: 'Test post content',
                    visibility: 'public',
                })
            );
        });

        await waitFor(() => {
            expect(onClose).toHaveBeenCalled();
        });
    });

    it('displays error message on post failure', async () => {
        const user = userEvent.setup();
        const mockCreateStatus = vi.mocked(mastoClient.createStatus);
        mockCreateStatus.mockRejectedValueOnce(new Error('Network error'));

        render(<ComposeModal isOpen={true} onClose={() => {}} />);

        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Test post content');

        const submitButton = screen.getByRole('button', { name: /投稿を送信/ });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Network error')).toBeInTheDocument();
        });
    });

    it('includes spoilerText when CW is enabled', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const mockCreateStatus = vi.mocked(mastoClient.createStatus);
        mockCreateStatus.mockResolvedValueOnce({} as unknown as mastodon.v1.Status);

        render(<ComposeModal isOpen={true} onClose={onClose} />);

        // Enable CW
        const cwButton = screen.getByRole('button', { name: /CW/i });
        await user.click(cwButton);

        // Enter CW text
        const cwInput = screen.getByPlaceholderText('警告文を入力...');
        await user.type(cwInput, 'Spoiler warning');

        // Enter content
        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Hidden content');

        // Submit
        const submitButton = screen.getByRole('button', { name: /投稿を送信/ });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockCreateStatus).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    status: 'Hidden content',
                    visibility: 'public',
                    spoilerText: 'Spoiler warning',
                })
            );
        });
    });

    it('changes visibility when option is selected', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const mockCreateStatus = vi.mocked(mastoClient.createStatus);
        mockCreateStatus.mockResolvedValueOnce({} as unknown as mastodon.v1.Status);

        render(<ComposeModal isOpen={true} onClose={onClose} />);

        // Select private visibility
        const privateOption = screen.getByText('フォロワーのみ');
        await user.click(privateOption);

        // Enter content
        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Private post');

        // Submit
        const submitButton = screen.getByRole('button', { name: /投稿を送信/ });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockCreateStatus).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    status: 'Private post',
                    visibility: 'private',
                })
            );
        });
    });

    // Poll tests
    it('shows poll button', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} />);
        // Use findBy* to wait for async instance config fetching to complete
        expect(await screen.findByRole('button', { name: /投票/i })).toBeInTheDocument();
    });

    it('toggles poll UI when clicking poll button', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => {}} />);

        // Poll options should not be visible initially
        expect(screen.queryByPlaceholderText('選択肢 1')).not.toBeInTheDocument();

        // Click poll button
        const pollButton = screen.getByRole('button', { name: /投票/i });
        await user.click(pollButton);

        // Poll options should now be visible
        expect(screen.getByPlaceholderText('選択肢 1')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('選択肢 2')).toBeInTheDocument();
    });

    it('can add poll options up to 4', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => {}} />);

        // Enable poll
        const pollButton = screen.getByRole('button', { name: /投票/i });
        await user.click(pollButton);

        // Initially 2 options
        expect(screen.getByPlaceholderText('選択肢 1')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('選択肢 2')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('選択肢 3')).not.toBeInTheDocument();

        // Add option
        const addButton = screen.getByRole('button', { name: /選択肢を追加/i });
        await user.click(addButton);

        expect(screen.getByPlaceholderText('選択肢 3')).toBeInTheDocument();

        // Add another option
        await user.click(addButton);
        expect(screen.getByPlaceholderText('選択肢 4')).toBeInTheDocument();

        // Add button should be gone now (max 4)
        expect(screen.queryByRole('button', { name: /選択肢を追加/i })).not.toBeInTheDocument();
    });

    it('can remove poll options but keeps minimum 2', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => {}} />);

        // Enable poll
        const pollButton = screen.getByRole('button', { name: /投票/i });
        await user.click(pollButton);

        // Add a third option first
        const addButton = screen.getByRole('button', { name: /選択肢を追加/i });
        await user.click(addButton);

        // Should have 3 options now
        expect(screen.getByPlaceholderText('選択肢 3')).toBeInTheDocument();

        // Click the first visible remove button
        const removeButton = screen
            .getByPlaceholderText('選択肢 3')
            .parentElement?.querySelector('button');
        if (removeButton) {
            await user.click(removeButton);
        }

        // Should be back to 2 options
        expect(screen.queryByPlaceholderText('選択肢 3')).not.toBeInTheDocument();
    });

    it('submits post with poll params', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const mockCreateStatus = vi.mocked(mastoClient.createStatus);
        mockCreateStatus.mockResolvedValueOnce({} as unknown as mastodon.v1.Status);

        render(<ComposeModal isOpen={true} onClose={onClose} />);

        // Enable poll
        const pollButton = screen.getByRole('button', { name: /投票/i });
        await user.click(pollButton);

        // Fill poll options
        const option1 = screen.getByPlaceholderText('選択肢 1');
        const option2 = screen.getByPlaceholderText('選択肢 2');
        await user.type(option1, 'Option A');
        await user.type(option2, 'Option B');

        // Enter content
        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Poll question');

        // Submit
        const submitButton = screen.getByRole('button', { name: /投稿を送信/ });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockCreateStatus).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    status: 'Poll question',
                    poll: expect.objectContaining({
                        options: ['Option A', 'Option B'],
                        expiresIn: 86400,
                        multiple: false,
                    }),
                })
            );
        });
    });

    it('shows expiration selector in poll UI', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => {}} />);

        // Enable poll
        const pollButton = screen.getByRole('button', { name: /投票/i });
        await user.click(pollButton);

        // Check for expiration selector label
        expect(screen.getByText('有効期限:')).toBeInTheDocument();

        // Check for multiple choice checkbox
        expect(screen.getByText('複数選択可')).toBeInTheDocument();
    });

    // NSFW tests - Note: NSFW toggle only shows when media is attached
    // Since mocking file uploads is complex, we test the state logic indirectly
    it('does not show NSFW toggle when no media is attached', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} />);
        // Use findBy* to wait for async instance config fetching to complete
        await screen.findByRole('button', { name: /投票/i });
        expect(screen.queryByText('閲覧注意 (NSFW)')).not.toBeInTheDocument();
    });

    // Reply mode tests
    const mockReplyToStatus = {
        id: 'status-123',
        acct: 'otheruser@example.com',
        displayName: 'Other User',
        content: '<p>Original post content</p>',
        avatar: 'https://example.com/other-avatar.png',
    };

    it('shows reply header when replyToStatus is provided', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} replyToStatus={mockReplyToStatus} />);
        // Use findBy* to wait for async instance config fetching to complete
        expect(await screen.findByText('返信')).toBeInTheDocument();
        expect(screen.queryByText('新しい投稿')).not.toBeInTheDocument();
    });

    it('displays reply indicator with target user info', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} replyToStatus={mockReplyToStatus} />);
        // Use findBy* to wait for async instance config fetching to complete
        expect(await screen.findByText('返信先:')).toBeInTheDocument();
        // Reply indicator contains the target user info - use getAllByText since text may appear multiple places
        expect(screen.getAllByText('Other User').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('@otheruser@example.com').length).toBeGreaterThanOrEqual(1);
    });

    it('prefills content with mention when replying', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} replyToStatus={mockReplyToStatus} />);
        // Use findBy* to wait for async instance config fetching to complete
        await screen.findByText('返信先:');
        const textarea = screen.getByPlaceholderText('今なにしてる？') as HTMLTextAreaElement;
        expect(textarea.value).toBe('@otheruser@example.com ');
    });

    it('includes inReplyToId when submitting a reply', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const mockCreateStatus = vi.mocked(mastoClient.createStatus);
        mockCreateStatus.mockResolvedValueOnce({} as unknown as mastodon.v1.Status);

        render(<ComposeModal isOpen={true} onClose={onClose} replyToStatus={mockReplyToStatus} />);

        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'My reply text');

        const submitButton = screen.getByRole('button', { name: /投稿を送信/ });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockCreateStatus).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    inReplyToId: 'status-123',
                })
            );
        });
    });

    // Emoji palette tests
    // Note: emoji-picker-element uses Shadow DOM which React Testing Library cannot access.
    // The library itself is well-tested, so we only test our integration points here.

    it('shows emoji button in modal', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} />);
        // Use findBy* to wait for async instance config fetching to complete
        expect(await screen.findByRole('button', { name: '絵文字を挿入' })).toBeInTheDocument();
    });

    it('toggles emoji palette state when clicking button', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => {}} />);

        const emojiButton = screen.getByRole('button', { name: '絵文字を挿入' });

        // Click to open - picker element should be created in document.body
        await user.click(emojiButton);
        const picker = document.body.querySelector('emoji-picker');
        expect(picker).toBeInTheDocument();

        // Click to close - picker should be removed
        await user.click(emojiButton);
        const pickerAfterClose = document.body.querySelector('emoji-picker');
        expect(pickerAfterClose).not.toBeInTheDocument();
    });

    it('removes picker when modal is closed', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<ComposeModal isOpen={true} onClose={() => {}} />);

        // Open emoji palette
        const emojiButton = screen.getByRole('button', { name: '絵文字を挿入' });
        await user.click(emojiButton);

        const picker = document.body.querySelector('emoji-picker');
        expect(picker).toBeInTheDocument();

        // Unmount modal
        unmount();

        // Picker should be cleaned up
        const pickerAfterUnmount = document.body.querySelector('emoji-picker');
        expect(pickerAfterUnmount).not.toBeInTheDocument();
    });

    // Layout alignment tests
    it('has consistent horizontal padding between account selector and textarea', async () => {
        render(<ComposeModal isOpen={true} onClose={() => {}} />);
        // Use findBy* to wait for async instance config fetching to complete
        await screen.findByRole('button', { name: /投稿を送信/ });

        // Find account selector button by its label (contains display name)
        const accountSelector = screen.getByRole('button', {
            name: /投稿アカウント:/i,
        });
        const textarea = screen.getByPlaceholderText('今なにしてる？');

        // Both should have px-3 class for consistent horizontal padding
        expect(accountSelector).toHaveClass('px-3');
        expect(textarea).toHaveClass('px-3');
    });

    // Edit mode tests
    const mockEditTarget = {
        status: {
            id: 'status-456',
            account: {
                id: '123',
                username: 'testuser',
                acct: 'testuser@mastodon.social',
                displayName: 'Test User',
                avatar: 'https://example.com/avatar.png',
            },
            content: '<p>Original post content</p>',
            text: 'Original post text',
            visibility: 'public',
            sensitive: false,
            spoilerText: '',
            mediaAttachments: [],
            createdAt: new Date().toISOString(),
            uri: 'https://mastodon.social/status/456',
            url: 'https://mastodon.social/status/456',
        } as unknown as mastodon.v1.Status,
        accountSessionId: mockAccount.id,
    };

    describe('edit mode', () => {
        it('shows edit header when editTarget is provided', async () => {
            render(<ComposeModal isOpen={true} onClose={() => {}} editTarget={mockEditTarget} />);
            // Wait for loading to complete
            expect(await screen.findByText('投稿を編集')).toBeInTheDocument();
            expect(screen.queryByText('新しい投稿')).not.toBeInTheDocument();
        });

        it('prefills content from getStatusSource API', async () => {
            render(<ComposeModal isOpen={true} onClose={() => {}} editTarget={mockEditTarget} />);

            // Wait for loading to complete
            await screen.findByText('投稿を編集');

            // Check that content was prefilled
            const textarea = screen.getByPlaceholderText('今なにしてる？') as HTMLTextAreaElement;
            expect(textarea.value).toBe('Original post text');
        });

        it('shows loading state while fetching status source', async () => {
            // Delay the getStatusSource response
            const mockGetStatusSource = vi.mocked(mastoClient.getStatusSource);
            mockGetStatusSource.mockImplementationOnce(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () => resolve({ id: 'status-456', text: 'Delayed', spoilerText: '' }),
                            100
                        )
                    )
            );

            render(<ComposeModal isOpen={true} onClose={() => {}} editTarget={mockEditTarget} />);

            // Should show loading state
            expect(screen.getByText('編集データを読み込み中...')).toBeInTheDocument();
        });

        it('displays error when getStatusSource fails', async () => {
            const mockGetStatusSource = vi.mocked(mastoClient.getStatusSource);
            mockGetStatusSource.mockRejectedValueOnce(new Error('API Error'));

            render(<ComposeModal isOpen={true} onClose={() => {}} editTarget={mockEditTarget} />);

            // Wait for error to appear
            await waitFor(() => {
                expect(screen.getByText('編集用データの取得に失敗しました')).toBeInTheDocument();
            });
        });

        it('calls editStatus with empty mediaIds when all media is removed', async () => {
            const user = userEvent.setup();
            const onStatusEdited = vi.fn();
            const mockEditStatus = vi.mocked(mastoClient.editStatus);
            const mockGetStatusSource = vi.mocked(mastoClient.getStatusSource);

            // Create edit target with media
            const editTargetWithMedia = {
                status: {
                    ...mockEditTarget.status,
                    mediaAttachments: [
                        {
                            id: 'media-1',
                            type: 'image' as const,
                            url: 'https://example.com/image.png',
                            previewUrl: 'https://example.com/image-preview.png',
                            description: 'Test image',
                        },
                    ],
                } as unknown as mastodon.v1.Status,
                accountSessionId: mockAccount.id,
            };

            mockGetStatusSource.mockResolvedValueOnce({
                id: 'status-456',
                text: 'Post with image',
                spoilerText: '',
            });

            render(
                <ComposeModal
                    isOpen={true}
                    onClose={() => {}}
                    editTarget={editTargetWithMedia}
                    onStatusEdited={onStatusEdited}
                />
            );

            // Wait for loading to complete
            await screen.findByText('投稿を編集');

            // Wait for media preview to appear
            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: 'メディア 1 を削除' })
                ).toBeInTheDocument();
            });

            // Remove the media
            await user.click(screen.getByRole('button', { name: 'メディア 1 を削除' }));

            // Submit the edit
            const submitButton = screen.getByRole('button', { name: /更新/ });
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockEditStatus).toHaveBeenCalledWith(
                    expect.anything(),
                    'status-456',
                    expect.objectContaining({
                        mediaIds: [],
                    })
                );
            });
        });

        it('sends empty spoilerText when CW is disabled in edit mode', async () => {
            const user = userEvent.setup();
            const mockEditStatus = vi.mocked(mastoClient.editStatus);
            const mockGetStatusSource = vi.mocked(mastoClient.getStatusSource);

            // Create edit target with CW
            const editTargetWithCW = {
                status: {
                    ...mockEditTarget.status,
                    sensitive: true,
                    spoilerText: 'Spoiler warning',
                } as unknown as mastodon.v1.Status,
                accountSessionId: mockAccount.id,
            };

            mockGetStatusSource.mockResolvedValueOnce({
                id: 'status-456',
                text: 'Hidden content',
                spoilerText: 'Spoiler warning',
            });

            render(<ComposeModal isOpen={true} onClose={() => {}} editTarget={editTargetWithCW} />);

            // Wait for loading and CW to appear
            await screen.findByText('投稿を編集');
            await waitFor(() => {
                expect(screen.getByPlaceholderText('警告文を入力...')).toBeInTheDocument();
            });

            // Clear CW text and toggle off
            const cwInput = screen.getByPlaceholderText('警告文を入力...');
            await user.clear(cwInput);

            // Click CW button to disable
            const cwButton = screen.getByRole('button', { name: /CW/i });
            await user.click(cwButton);

            // Submit the edit
            const submitButton = screen.getByRole('button', { name: /更新/ });
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockEditStatus).toHaveBeenCalledWith(
                    expect.anything(),
                    'status-456',
                    expect.objectContaining({
                        spoilerText: '',
                    })
                );
            });
        });

        it('sends sensitive: false when NSFW is disabled in edit mode', async () => {
            const user = userEvent.setup();
            const mockEditStatus = vi.mocked(mastoClient.editStatus);
            const mockGetStatusSource = vi.mocked(mastoClient.getStatusSource);

            // Create edit target with NSFW media
            const editTargetWithNSFW = {
                status: {
                    ...mockEditTarget.status,
                    sensitive: true,
                    mediaAttachments: [
                        {
                            id: 'media-1',
                            type: 'image' as const,
                            url: 'https://example.com/image.png',
                            previewUrl: 'https://example.com/image-preview.png',
                        },
                    ],
                } as unknown as mastodon.v1.Status,
                accountSessionId: mockAccount.id,
            };

            mockGetStatusSource.mockResolvedValueOnce({
                id: 'status-456',
                text: 'NSFW post',
                spoilerText: '',
            });

            render(
                <ComposeModal isOpen={true} onClose={() => {}} editTarget={editTargetWithNSFW} />
            );

            // Wait for loading to complete
            await screen.findByText('投稿を編集');

            // Wait for NSFW checkbox to appear
            await waitFor(() => {
                const nsfwCheckbox = screen.getByRole('checkbox', { name: /閲覧注意/i });
                expect(nsfwCheckbox).toBeChecked();
            });

            // Uncheck NSFW
            const nsfwCheckbox = screen.getByRole('checkbox', { name: /閲覧注意/i });
            await user.click(nsfwCheckbox);
            expect(nsfwCheckbox).not.toBeChecked();

            // Submit the edit
            const submitButton = screen.getByRole('button', { name: /更新/ });
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockEditStatus).toHaveBeenCalledWith(
                    expect.anything(),
                    'status-456',
                    expect.objectContaining({
                        sensitive: false,
                    })
                );
            });
        });

        it('displays existing video with correct preview', async () => {
            const mockGetStatusSource = vi.mocked(mastoClient.getStatusSource);

            const editTargetWithVideo = {
                status: {
                    ...mockEditTarget.status,
                    mediaAttachments: [
                        {
                            id: 'video-1',
                            type: 'video' as const,
                            url: 'https://example.com/video.mp4',
                            previewUrl: 'https://example.com/video-preview.png',
                            description: 'Test video',
                        },
                    ],
                } as unknown as mastodon.v1.Status,
                accountSessionId: mockAccount.id,
            };

            mockGetStatusSource.mockResolvedValueOnce({
                id: 'status-456',
                text: 'Post with video',
                spoilerText: '',
            });

            const { container } = render(
                <ComposeModal isOpen={true} onClose={() => {}} editTarget={editTargetWithVideo} />
            );

            // Wait for loading to complete
            await screen.findByText('投稿を編集');

            // Wait for video preview
            await waitFor(() => {
                const videoPreview = container.querySelector('video');
                expect(videoPreview).toBeInTheDocument();
                expect(videoPreview).toHaveAttribute('src', 'https://example.com/video.mp4');
            });
        });

        it('displays existing audio with correct preview', async () => {
            const mockGetStatusSource = vi.mocked(mastoClient.getStatusSource);

            const editTargetWithAudio = {
                status: {
                    ...mockEditTarget.status,
                    mediaAttachments: [
                        {
                            id: 'audio-1',
                            type: 'audio' as const,
                            url: 'https://example.com/audio.mp3',
                            previewUrl: undefined,
                            description: 'Test audio',
                        },
                    ],
                } as unknown as mastodon.v1.Status,
                accountSessionId: mockAccount.id,
            };

            mockGetStatusSource.mockResolvedValueOnce({
                id: 'status-456',
                text: 'Post with audio',
                spoilerText: '',
            });

            const { container } = render(
                <ComposeModal isOpen={true} onClose={() => {}} editTarget={editTargetWithAudio} />
            );

            // Wait for loading to complete
            await screen.findByText('投稿を編集');

            // Wait for audio preview
            await waitFor(() => {
                const audioPreview = container.querySelector('audio');
                expect(audioPreview).toBeInTheDocument();
                expect(audioPreview).toHaveAttribute('src', 'https://example.com/audio.mp3');
            });
        });

        it('disables poll button in edit mode', async () => {
            render(<ComposeModal isOpen={true} onClose={() => {}} editTarget={mockEditTarget} />);

            // Wait for loading to complete
            await screen.findByText('投稿を編集');

            const pollButton = screen.getByRole('button', { name: /投票/i });
            expect(pollButton).toBeDisabled();
        });

        it('disables visibility change in edit mode', async () => {
            render(<ComposeModal isOpen={true} onClose={() => {}} editTarget={mockEditTarget} />);

            // Wait for loading to complete
            await screen.findByText('投稿を編集');

            // Try to click on private visibility
            const privateOption = screen.getByText('フォロワーのみ');
            await userEvent.click(privateOption);

            // Visibility should remain public (default from editTarget)
            const publicOption = screen.getByText('公開').closest('label');
            expect(publicOption).toHaveClass('bg-indigo-500/20');
        });

        it('locks account selector in edit mode', async () => {
            const user = userEvent.setup();
            render(<ComposeModal isOpen={true} onClose={() => {}} editTarget={mockEditTarget} />);

            // Wait for loading to complete
            await screen.findByText('投稿を編集');

            const accountSelector = screen.getByRole('button', {
                name: /投稿アカウント:/i,
            });

            // Account selector should not open dropdown when clicked in edit mode
            await user.click(accountSelector);

            // No dropdown should appear (no listbox for account selection)
            const dropdown = screen.queryByRole('listbox', { name: 'アカウント一覧' });
            expect(dropdown).not.toBeInTheDocument();
        });

        it('calls onStatusEdited callback after successful edit', async () => {
            const user = userEvent.setup();
            const onStatusEdited = vi.fn();
            const mockEditStatus = vi.mocked(mastoClient.editStatus);
            const editedStatus = { id: 'status-456' } as unknown as mastodon.v1.Status;
            mockEditStatus.mockResolvedValueOnce(editedStatus);

            render(
                <ComposeModal
                    isOpen={true}
                    onClose={() => {}}
                    editTarget={mockEditTarget}
                    onStatusEdited={onStatusEdited}
                />
            );

            // Wait for loading to complete
            await screen.findByText('投稿を編集');

            // Submit the edit
            const submitButton = screen.getByRole('button', { name: /更新/ });
            await user.click(submitButton);

            await waitFor(() => {
                expect(onStatusEdited).toHaveBeenCalledWith(editedStatus);
            });
        });
    });

    describe('file type detection', () => {
        it('should detect video file by extension when MIME is empty', async () => {
            // Create a file without proper MIME type (browsers may not detect it)
            const videoFile = new File([''], 'video.webm', { type: '' });
            Object.defineProperty(videoFile, 'name', {
                value: 'video.webm',
                writable: false,
            });

            // user-event v14 applies input accept filtering by default.
            // We disable it here to verify ComposeModal's extension fallback logic itself.
            const user = userEvent.setup({ applyAccept: false });
            const onClose = vi.fn();
            const { container } = render(<ComposeModal isOpen={true} onClose={onClose} />);

            // Wait for instance config to load and submit button to appear
            let submitButton: HTMLButtonElement | null = null;
            await waitFor(
                () => {
                    submitButton = container.querySelector('button');
                    expect(submitButton).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            const fileInput = container.querySelector('input[type="file"]');
            expect(fileInput).toBeInTheDocument();

            if (fileInput) {
                await user.upload(fileInput as HTMLInputElement, videoFile);

                // Video preview should be rendered, not image
                const videoPreview = container.querySelector('video');
                expect(videoPreview).toBeInTheDocument();
            }
        });

        it('should detect audio file by extension when MIME is application/octet-stream', async () => {
            const audioFile = new File([''], 'audio.mp3', { type: 'application/octet-stream' });
            Object.defineProperty(audioFile, 'name', {
                value: 'audio.mp3',
                writable: false,
            });

            const user = userEvent.setup({ applyAccept: false });
            const onClose = vi.fn();
            const { container } = render(<ComposeModal isOpen={true} onClose={onClose} />);

            await waitFor(
                () => {
                    const button = container.querySelector('button');
                    expect(button).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            const fileInput = container.querySelector('input[type="file"]');
            expect(fileInput).toBeInTheDocument();

            if (fileInput) {
                await user.upload(fileInput as HTMLInputElement, audioFile);

                // Audio preview should be rendered
                const audioPreview = container.querySelector('audio');
                expect(audioPreview).toBeInTheDocument();
            }
        });

        it('should detect audio file by extension when MIME is empty string', async () => {
            const audioFile = new File([''], 'song.wav', { type: '' });
            Object.defineProperty(audioFile, 'name', {
                value: 'song.wav',
                writable: false,
            });

            const user = userEvent.setup({ applyAccept: false });
            const onClose = vi.fn();
            const { container } = render(<ComposeModal isOpen={true} onClose={onClose} />);

            await waitFor(
                () => {
                    const button = container.querySelector('button');
                    expect(button).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            const fileInput = container.querySelector('input[type="file"]');
            expect(fileInput).toBeInTheDocument();

            if (fileInput) {
                await user.upload(fileInput as HTMLInputElement, audioFile);

                // Audio preview should be rendered
                const audioPreview = container.querySelector('audio');
                expect(audioPreview).toBeInTheDocument();
            }
        });
    });

    // Clipboard paste tests
    describe('clipboard paste functionality', () => {
        // Helper to create mock clipboard data
        const makeClipboardData = (files: File[], useItems = true) => {
            const items = useItems
                ? files.map((file) => ({
                      kind: 'file',
                      type: file.type,
                      getAsFile: () => file,
                  }))
                : [];
            return {
                items,
                files: {
                    length: files.length,
                    item: (index: number) => files[index],
                    [Symbol.iterator]: function* () {
                        for (const file of files) yield file;
                    },
                } as unknown as FileList,
                types: files.length > 0 ? ['Files'] : ['text/plain'],
                getData: () => '',
            } as unknown as DataTransfer;
        };

        it('uploads image when pasted from clipboard via items API', async () => {
            const mockUploadMedia = vi.mocked(mastoClient.uploadMedia);
            mockUploadMedia.mockClear();
            mockUploadMedia.mockResolvedValueOnce({
                id: 'paste-media-id',
            } as unknown as mastodon.v1.MediaAttachment);

            const { container } = render(<ComposeModal isOpen={true} onClose={() => {}} />);

            // Wait for modal to render
            await screen.findByRole('button', { name: /投稿を送信/ });

            // Create a mock image file
            const imageFile = new File(['image-data'], 'paste.png', { type: 'image/png' });

            // Get the modal container and fire paste event
            const modalContent = container.querySelector('.relative.w-full.max-w-lg');
            expect(modalContent).toBeInTheDocument();

            // Simulate paste event using fireEvent
            const clipboardData = makeClipboardData([imageFile], true);
            fireEvent.paste(modalContent!, { clipboardData });

            // Verify upload was called
            await waitFor(() => {
                expect(mockUploadMedia).toHaveBeenCalledWith(expect.anything(), imageFile);
            });
        });

        it('falls back to clipboardData.files when items is empty', async () => {
            const mockUploadMedia = vi.mocked(mastoClient.uploadMedia);
            mockUploadMedia.mockClear();
            mockUploadMedia.mockResolvedValueOnce({
                id: 'fallback-media-id',
            } as unknown as mastodon.v1.MediaAttachment);

            const { container } = render(<ComposeModal isOpen={true} onClose={() => {}} />);

            await screen.findByRole('button', { name: /投稿を送信/ });

            const imageFile = new File(['image-data'], 'fallback.png', { type: 'image/png' });

            const modalContent = container.querySelector('.relative.w-full.max-w-lg');
            expect(modalContent).toBeInTheDocument();

            // Use items = false to test fallback path
            const clipboardData = makeClipboardData([imageFile], false);
            fireEvent.paste(modalContent!, { clipboardData });

            await waitFor(() => {
                expect(mockUploadMedia).toHaveBeenCalledWith(expect.anything(), imageFile);
            });
        });

        it('does not allow paste media while poll is enabled', async () => {
            const user = userEvent.setup();
            const mockUploadMedia = vi.mocked(mastoClient.uploadMedia);
            mockUploadMedia.mockClear();

            const { container } = render(<ComposeModal isOpen={true} onClose={() => {}} />);

            await screen.findByRole('button', { name: /投稿を送信/ });

            // Enable poll
            const pollButton = screen.getByRole('button', { name: /投票/i });
            await user.click(pollButton);

            // Try to paste an image
            const imageFile = new File(['image-data'], 'poll-test.png', { type: 'image/png' });
            const modalContent = container.querySelector('.relative.w-full.max-w-lg');
            const clipboardData = makeClipboardData([imageFile], true);
            fireEvent.paste(modalContent!, { clipboardData });

            // Upload should NOT be called
            expect(mockUploadMedia).not.toHaveBeenCalled();

            // Error message should appear
            await waitFor(() => {
                expect(
                    screen.getByText('投票とメディアは同時に添付できません')
                ).toBeInTheDocument();
            });
        });

        it('allows text paste to still work in textarea', async () => {
            const user = userEvent.setup();
            const mockUploadMedia = vi.mocked(mastoClient.uploadMedia);
            mockUploadMedia.mockClear();

            render(<ComposeModal isOpen={true} onClose={() => {}} />);

            const textarea = screen.getByPlaceholderText('今なにしてる？');
            await user.click(textarea);

            // Try to paste text (no files)
            const clipboardData = {
                items: [],
                files: { length: 0, [Symbol.iterator]: function* () {} } as unknown as FileList,
                types: ['text/plain'],
                getData: (type: string) => (type === 'text/plain' ? 'pasted text' : ''),
            } as unknown as DataTransfer;

            // Dispatch paste event on textarea using fireEvent
            fireEvent.paste(textarea, { clipboardData });

            // Upload should not be called for text paste
            expect(mockUploadMedia).not.toHaveBeenCalled();
        });

        it('rejects unsupported MIME types from clipboard', async () => {
            const mockUploadMedia = vi.mocked(mastoClient.uploadMedia);
            mockUploadMedia.mockClear();

            const { container } = render(<ComposeModal isOpen={true} onClose={() => {}} />);

            await screen.findByRole('button', { name: /投稿を送信/ });

            // Create a file with unsupported MIME type (e.g., image/bmp which is not in supportedMimeTypes)
            const unsupportedFile = new File(['image-data'], 'test.bmp', { type: 'image/bmp' });

            const modalContent = container.querySelector('.relative.w-full.max-w-lg');
            const clipboardData = makeClipboardData([unsupportedFile], true);
            fireEvent.paste(modalContent!, { clipboardData });

            // Upload should NOT be called
            expect(mockUploadMedia).not.toHaveBeenCalled();

            // Error message should appear
            await waitFor(() => {
                expect(screen.getByText(/未対応のファイル形式です/)).toBeInTheDocument();
            });
        });

        it('filters non-image files from clipboard', async () => {
            const mockUploadMedia = vi.mocked(mastoClient.uploadMedia);
            mockUploadMedia.mockClear();

            const { container } = render(<ComposeModal isOpen={true} onClose={() => {}} />);

            await screen.findByRole('button', { name: /投稿を送信/ });

            // Create a non-image file (video)
            const videoFile = new File(['video-data'], 'video.mp4', { type: 'video/mp4' });

            const modalContent = container.querySelector('.relative.w-full.max-w-lg');
            const clipboardData = makeClipboardData([videoFile], true);
            fireEvent.paste(modalContent!, { clipboardData });

            // Upload should NOT be called (video is filtered out from clipboard paste)
            expect(mockUploadMedia).not.toHaveBeenCalled();
        });
    });
});
