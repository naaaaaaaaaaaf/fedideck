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
});
