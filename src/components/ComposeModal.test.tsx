import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComposeModal } from './ComposeModal';
import * as mastoClient from '../api/mastoClient';
import { useAccountsStore } from '../store/accounts';
import type { Session } from '../auth/sessions';

// Mock the mastoClient module
vi.mock('../api/mastoClient', () => ({
    getClient: vi.fn(() => ({})),
    createStatus: vi.fn(),
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
        const { container } = render(
            <ComposeModal isOpen={false} onClose={() => { }} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders the modal when isOpen is true', () => {
        render(<ComposeModal isOpen={true} onClose={() => { }} />);
        expect(screen.getByText('新しい投稿')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('今なにしてる？')).toBeInTheDocument();
    });

    it('displays the active account info', () => {
        render(<ComposeModal isOpen={true} onClose={() => { }} />);
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('@testuser')).toBeInTheDocument();
    });

    it('shows character count', () => {
        render(<ComposeModal isOpen={true} onClose={() => { }} />);
        expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('updates character count when typing', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => { }} />);

        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Hello world');

        expect(screen.getByText('489')).toBeInTheDocument();
    });

    it('disables submit button when content is empty', () => {
        render(<ComposeModal isOpen={true} onClose={() => { }} />);
        const submitButton = screen.getByRole('button', { name: '投稿' });
        expect(submitButton).toBeDisabled();
    });

    it('enables submit button when content is not empty', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => { }} />);

        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Test post');

        const submitButton = screen.getByRole('button', { name: '投稿' });
        expect(submitButton).not.toBeDisabled();
    });

    it('toggles CW input when clicking CW button', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => { }} />);

        // CW input should not be visible initially
        expect(screen.queryByPlaceholderText('警告文を入力...')).not.toBeInTheDocument();

        // Click CW button
        const cwButton = screen.getByRole('button', { name: /CW/i });
        await user.click(cwButton);

        // CW input should now be visible
        expect(screen.getByPlaceholderText('警告文を入力...')).toBeInTheDocument();
    });

    it('displays visibility options', () => {
        render(<ComposeModal isOpen={true} onClose={() => { }} />);
        expect(screen.getByText('公開')).toBeInTheDocument();
        expect(screen.getByText('未収載')).toBeInTheDocument();
        expect(screen.getByText('フォロワーのみ')).toBeInTheDocument();
        expect(screen.getByText('ダイレクト')).toBeInTheDocument();
    });

    it('calls onClose when cancel button is clicked', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<ComposeModal isOpen={true} onClose={onClose} />);

        const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
        await user.click(cancelButton);

        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<ComposeModal isOpen={true} onClose={onClose} />);

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
        mockCreateStatus.mockResolvedValueOnce({} as any);

        render(<ComposeModal isOpen={true} onClose={onClose} />);

        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Test post content');

        const submitButton = screen.getByRole('button', { name: '投稿' });
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

        render(<ComposeModal isOpen={true} onClose={() => { }} />);

        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Test post content');

        const submitButton = screen.getByRole('button', { name: '投稿' });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Network error')).toBeInTheDocument();
        });
    });

    it('includes spoilerText when CW is enabled', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const mockCreateStatus = vi.mocked(mastoClient.createStatus);
        mockCreateStatus.mockResolvedValueOnce({} as any);

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
        const submitButton = screen.getByRole('button', { name: '投稿' });
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
        mockCreateStatus.mockResolvedValueOnce({} as any);

        render(<ComposeModal isOpen={true} onClose={onClose} />);

        // Select private visibility
        const privateOption = screen.getByText('フォロワーのみ');
        await user.click(privateOption);

        // Enter content
        const textarea = screen.getByPlaceholderText('今なにしてる？');
        await user.type(textarea, 'Private post');

        // Submit
        const submitButton = screen.getByRole('button', { name: '投稿' });
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
    it('shows poll button', () => {
        render(<ComposeModal isOpen={true} onClose={() => { }} />);
        expect(screen.getByRole('button', { name: /投票/i })).toBeInTheDocument();
    });

    it('toggles poll UI when clicking poll button', async () => {
        const user = userEvent.setup();
        render(<ComposeModal isOpen={true} onClose={() => { }} />);

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
        render(<ComposeModal isOpen={true} onClose={() => { }} />);

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
        render(<ComposeModal isOpen={true} onClose={() => { }} />);

        // Enable poll
        const pollButton = screen.getByRole('button', { name: /投票/i });
        await user.click(pollButton);

        // Add a third option first
        const addButton = screen.getByRole('button', { name: /選択肢を追加/i });
        await user.click(addButton);

        // Should have 3 options now
        expect(screen.getByPlaceholderText('選択肢 3')).toBeInTheDocument();

        // Click the first visible remove button
        const removeButton = screen.getByPlaceholderText('選択肢 3').parentElement?.querySelector('button');
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
        mockCreateStatus.mockResolvedValueOnce({} as any);

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
        const submitButton = screen.getByRole('button', { name: '投稿' });
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
        render(<ComposeModal isOpen={true} onClose={() => { }} />);

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
    it('does not show NSFW toggle when no media is attached', () => {
        render(<ComposeModal isOpen={true} onClose={() => { }} />);
        expect(screen.queryByText('閲覧注意 (NSFW)')).not.toBeInTheDocument();
    });
});
