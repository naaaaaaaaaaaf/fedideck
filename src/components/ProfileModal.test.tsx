import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileModal } from './ProfileModal';
import type { mastodon } from 'masto';
import type { AccountSession } from '../api/mastoClient';
import * as mastoClient from '../api/mastoClient';

vi.mock('../api/mastoClient', async () => {
    const actual = await vi.importActual('../api/mastoClient');
    return {
        ...actual,
        fetchAccount: vi.fn(),
    };
});

const mockFetchAccount = vi.mocked(mastoClient.fetchAccount);

describe('ProfileModal', () => {
    // Suppress console.error during tests to keep CI logs clean
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    const mockAccount: mastodon.v1.Account = {
        id: '123',
        username: 'testuser',
        acct: 'testuser@mastodon.social',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.png',
        avatarStatic: 'https://example.com/avatar-static.png',
        header: 'https://example.com/header.png',
        headerStatic: 'https://example.com/header.png',
        note: '<p>Test bio</p>',
        followersCount: 100,
        followingCount: 50,
        statusesCount: 200,
        url: 'https://mastodon.social/@testuser',
        createdAt: '2024-01-01T00:00:00.000Z',
        bot: false,
        discoverable: true,
        locked: false,
        group: false,
        lastStatusAt: '',
        emojis: [],
        fields: [],
        roles: [],
        suspended: false,
        limited: false,
    };

    const mockSession: AccountSession = {
        id: '123@mastodon.social',
        instanceUrl: 'https://mastodon.social',
        accessToken: 'token',
        account: mockAccount,
    };

    const onClose = vi.fn();

    beforeEach(() => {
        // Suppress console.error during tests to keep CI logs clean
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        // Reset mocks for each test
        onClose.mockClear();
        mockFetchAccount.mockResolvedValue(mockAccount);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('does not render when isOpen is false', () => {
        const { container } = render(
            <ProfileModal
                isOpen={false}
                onClose={onClose}
                account={mockAccount}
                accountSession={mockSession}
            />
        );

        expect(container.firstChild).toBe(null);
    });

    it('renders basic account information', async () => {
        render(
            <ProfileModal
                isOpen={true}
                onClose={onClose}
                account={mockAccount}
                accountSession={mockSession}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Test User')).toBeInTheDocument();
            expect(screen.getByText('@testuser@mastodon.social')).toBeInTheDocument();
            expect(screen.getByText('Test bio')).toBeInTheDocument();
            expect(screen.getByText('100')).toBeInTheDocument();
            expect(screen.getByText('50')).toBeInTheDocument();
            expect(screen.getByText('200')).toBeInTheDocument();
        });
    });

    it('closes when close button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <ProfileModal
                isOpen={true}
                onClose={onClose}
                account={mockAccount}
                accountSession={mockSession}
            />
        );

        const closeButton = await screen.findByRole('button', { name: '閉じる' });
        await user.click(closeButton);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes when backdrop is clicked', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <ProfileModal
                isOpen={true}
                onClose={onClose}
                account={mockAccount}
                accountSession={mockSession}
            />
        );

        // Backdrop is a sibling of the modal, not a descendant of the header
        const backdrop = container.querySelector('[aria-hidden="true"]');
        expect(backdrop).not.toBeNull();
        if (backdrop) {
            await user.click(backdrop);
            expect(onClose).toHaveBeenCalledTimes(1);
        }
    });

    it('displays error message when fetch fails', async () => {
        mockFetchAccount.mockRejectedValueOnce(new Error('Failed to fetch'));

        render(
            <ProfileModal
                isOpen={true}
                onClose={onClose}
                account={mockAccount}
                accountSession={mockSession}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/プロフィールの読み込みに失敗しました/)).toBeInTheDocument();
        });

        // Verify that console.error was called for the fetch failure
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('handles missing optional account fields', async () => {
        const minimalAccount: mastodon.v1.Account = {
            ...mockAccount,
            displayName: '',
            note: '',
        };

        render(
            <ProfileModal
                isOpen={true}
                onClose={onClose}
                account={minimalAccount}
                accountSession={mockSession}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('@testuser@mastodon.social')).toBeInTheDocument();
            // Should fall back to username when displayName is empty
            expect(screen.getByText('testuser')).toBeInTheDocument();
        });
    });
});
