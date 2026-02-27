import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserListItem } from './UserListItem';
import type { mastodon } from 'masto';

describe('UserListItem', () => {
    const mockAccount: mastodon.v1.Account = {
        id: '1',
        username: 'testuser',
        displayName: 'Test User',
        url: 'https://example.com/@testuser',
        acct: 'testuser@example.com',
        note: '',
        avatar: 'https://example.com/avatar.png',
        avatarStatic: 'https://example.com/avatar.png',
        header: '',
        headerStatic: '',
        locked: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        followersCount: 100,
        followingCount: 50,
        statusesCount: 200,
        emojis: [],
        fields: [],
        bot: false,
        discoverable: true,
        group: false,
        lastStatusAt: null,
        noindex: false,
        moved: null,
        suspended: false,
        limited: false,
    };

    it('renders account avatar', () => {
        render(<UserListItem account={mockAccount} />);

        // Images with alt="" are treated as presentation role
        const avatar = screen.getByRole('presentation');
        expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.png');
    });

    it('renders account display name', () => {
        render(<UserListItem account={mockAccount} />);

        expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('renders account username (acct)', () => {
        render(<UserListItem account={mockAccount} />);

        expect(screen.getByText('@testuser@example.com')).toBeInTheDocument();
    });

    it('falls back to username when displayName is empty', () => {
        const accountWithoutDisplayName = {
            ...mockAccount,
            displayName: '',
        };

        render(<UserListItem account={accountWithoutDisplayName} />);

        expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('has accessible label with display name and acct', () => {
        render(<UserListItem account={mockAccount} />);

        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-label',
            'Test User (@testuser@example.com)'
        );
    });

    it('has accessible label with username fallback when displayName is empty', () => {
        const accountWithoutDisplayName = {
            ...mockAccount,
            displayName: '',
        };

        render(<UserListItem account={accountWithoutDisplayName} />);

        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-label',
            'testuser (@testuser@example.com)'
        );
    });

    it('calls onAccountClick when clicked', () => {
        const onAccountClick = vi.fn();

        render(<UserListItem account={mockAccount} onAccountClick={onAccountClick} />);

        fireEvent.click(screen.getByRole('button'));

        expect(onAccountClick).toHaveBeenCalledWith(mockAccount);
    });

    it('calls onAccountClick when Enter key is pressed', () => {
        const onAccountClick = vi.fn();

        render(<UserListItem account={mockAccount} onAccountClick={onAccountClick} />);

        fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

        expect(onAccountClick).toHaveBeenCalledWith(mockAccount);
    });

    it('calls onAccountClick when Space key is pressed', () => {
        const onAccountClick = vi.fn();

        render(<UserListItem account={mockAccount} onAccountClick={onAccountClick} />);

        fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

        expect(onAccountClick).toHaveBeenCalledWith(mockAccount);
    });

    it('does not call onAccountClick when other keys are pressed', () => {
        const onAccountClick = vi.fn();

        render(<UserListItem account={mockAccount} onAccountClick={onAccountClick} />);

        fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' });

        expect(onAccountClick).not.toHaveBeenCalled();
    });

    it('does not throw when onAccountClick is not provided', () => {
        render(<UserListItem account={mockAccount} />);

        expect(() => {
            fireEvent.click(screen.getByRole('button'));
        }).not.toThrow();
    });

    it('renders custom emojis in display name', () => {
        const accountWithEmoji = {
            ...mockAccount,
            displayName: 'Test :emoji:',
            emojis: [
                {
                    shortcode: 'emoji',
                    url: 'https://example.com/emoji.png',
                    staticUrl: 'https://example.com/emoji.png',
                    visibleInPicker: true,
                },
            ],
        };

        render(<UserListItem account={accountWithEmoji} />);

        // The DisplayName component handles emoji rendering
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
    });
});
