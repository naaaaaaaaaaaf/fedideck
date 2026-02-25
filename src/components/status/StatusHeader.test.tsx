import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusHeader } from './StatusHeader';
import type { mastodon } from 'masto';

const createMockAccount = (overrides: Partial<mastodon.v1.Account> = {}): mastodon.v1.Account =>
    ({
        id: '1',
        username: 'testuser',
        acct: 'testuser@example.com',
        displayName: 'Test User',
        note: '',
        locked: false,
        bot: false,
        discoverable: false,
        group: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        avatar: 'https://example.com/avatar.png',
        avatarStatic: 'https://example.com/avatar-static.png',
        header: 'https://example.com/header.png',
        headerStatic: 'https://example.com/header-static.png',
        url: 'https://example.com/@testuser',
        followersCount: 100,
        followingCount: 50,
        statusesCount: 200,
        lastStatusAt: '2024-01-01T00:00:00.000Z',
        emojis: [],
        fields: [],
        roles: [],
        ...overrides,
    }) as mastodon.v1.Account;

describe('StatusHeader', () => {
    const defaultProps = {
        account: createMockAccount(),
        createdAt: '2024-01-15T12:00:00.000Z',
        visibility: 'public' as const,
    };

    it('renders account display name', () => {
        render(<StatusHeader {...defaultProps} />);

        expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('renders account handle', () => {
        render(<StatusHeader {...defaultProps} />);

        expect(screen.getByText('@testuser@example.com')).toBeInTheDocument();
    });

    it('renders avatar', () => {
        render(<StatusHeader {...defaultProps} />);

        const avatar = screen.getByAltText('Test User');
        expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.png');
    });

    it('renders timestamp', () => {
        render(<StatusHeader {...defaultProps} />);

        // formatDate should render a relative date
        const timestampLink = screen.getByRole('link', { name: /公開範囲/ });
        expect(timestampLink).toBeInTheDocument();
    });

    it('renders visibility icon', () => {
        render(<StatusHeader {...defaultProps} />);

        // Public visibility should have a globe icon
        const visibilityLink = screen.getByRole('link', { name: /公開範囲: 公開/ });
        expect(visibilityLink).toBeInTheDocument();
    });

    it('applies card variant styles by default', () => {
        render(<StatusHeader {...defaultProps} />);

        const avatar = screen.getByAltText('Test User');
        expect(avatar).toHaveClass('w-12', 'h-12', 'rounded-lg');
    });

    it('applies detail variant styles', () => {
        render(<StatusHeader {...defaultProps} variant="detail" />);

        const avatar = screen.getByAltText('Test User');
        expect(avatar).toHaveClass('w-14', 'h-14', 'rounded-xl');
    });

    it('renders account as link when onAccountClick is not provided', () => {
        render(<StatusHeader {...defaultProps} />);

        // Multiple links contain "Test User", check the one that points to the profile
        const profileLinks = screen.getAllByRole('link', { name: /Test User/ });
        const profileLink = profileLinks.find(
            (link) => link.getAttribute('href') === 'https://example.com/@testuser'
        );
        expect(profileLink).toBeDefined();
    });

    it('renders account as button when onAccountClick is provided with accountSessionId', () => {
        const onAccountClick = vi.fn();
        render(
            <StatusHeader
                {...defaultProps}
                onAccountClick={onAccountClick}
                accountSessionId="session-123"
            />
        );

        // Should have profile buttons (both avatar and display name)
        const profileButtons = screen.getAllByRole('button', {
            name: /Test User.*プロフィールを表示/,
        });
        expect(profileButtons.length).toBeGreaterThan(0);
    });

    it('calls onAccountClick when account button is clicked', () => {
        const onAccountClick = vi.fn();
        render(
            <StatusHeader
                {...defaultProps}
                onAccountClick={onAccountClick}
                accountSessionId="session-123"
            />
        );

        // There are two buttons (avatar and display name), click the first one
        const profileButtons = screen.getAllByRole('button', {
            name: /Test User.*プロフィールを表示/,
        });
        profileButtons[0].click();

        expect(onAccountClick).toHaveBeenCalledWith(defaultProps.account, 'session-123');
    });

    it('does not render button without accountSessionId even if onAccountClick is provided', () => {
        const onAccountClick = vi.fn();
        render(<StatusHeader {...defaultProps} onAccountClick={onAccountClick} />);

        // Should not have profile button
        const profileButton = screen.queryByRole('button', {
            name: /Test User.*プロフィールを表示/,
        });
        expect(profileButton).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
        render(<StatusHeader {...defaultProps} className="custom-class" />);

        // The custom className is applied to the outer container (the one with flex gap-3)
        const avatar = screen.getByAltText('Test User');
        const container = avatar.closest('.flex.gap-3');
        expect(container).toHaveClass('custom-class');
    });

    it('uses larger text in detail variant', () => {
        render(<StatusHeader {...defaultProps} variant="detail" />);

        // DisplayName should have text-lg class in detail variant
        const displayName = screen.getByText('Test User');
        expect(displayName).toHaveClass('text-lg');
    });

    it('renders unlisted visibility correctly', () => {
        render(<StatusHeader {...defaultProps} visibility="unlisted" />);

        const visibilityLink = screen.getByRole('link', { name: /公開範囲: 未収載/ });
        expect(visibilityLink).toBeInTheDocument();
    });

    it('renders private visibility correctly', () => {
        render(<StatusHeader {...defaultProps} visibility="private" />);

        const visibilityLink = screen.getByRole('link', { name: /公開範囲: フォロワーのみ/ });
        expect(visibilityLink).toBeInTheDocument();
    });

    it('renders direct visibility correctly', () => {
        render(<StatusHeader {...defaultProps} visibility="direct" />);

        const visibilityLink = screen.getByRole('link', { name: /公開範囲: ダイレクト/ });
        expect(visibilityLink).toBeInTheDocument();
    });

    it('falls back to username when displayName is empty', () => {
        const account = createMockAccount({ displayName: '' });
        render(<StatusHeader {...defaultProps} account={account} />);

        expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    describe('statusUrl', () => {
        it('uses statusUrl for timestamp link when provided', () => {
            const statusUrl = 'https://example.com/@testuser/123456';
            render(<StatusHeader {...defaultProps} statusUrl={statusUrl} />);

            // The timestamp/visibility link should point to the status URL
            const timestampLink = screen.getByRole('link', { name: /公開範囲/ });
            expect(timestampLink).toHaveAttribute('href', statusUrl);
        });

        it('falls back to account URL for timestamp link when statusUrl is not provided', () => {
            render(<StatusHeader {...defaultProps} />);

            // The timestamp/visibility link should fall back to account URL
            const timestampLink = screen.getByRole('link', { name: /公開範囲/ });
            expect(timestampLink).toHaveAttribute('href', 'https://example.com/@testuser');
        });

        it('prefers statusUrl over account URL for timestamp link', () => {
            const statusUrl = 'https://other.instance/@user/789';
            const account = createMockAccount({
                url: 'https://example.com/@testuser',
            });
            render(<StatusHeader {...defaultProps} account={account} statusUrl={statusUrl} />);

            const timestampLink = screen.getByRole('link', { name: /公開範囲/ });
            expect(timestampLink).toHaveAttribute('href', statusUrl);
            expect(timestampLink).not.toHaveAttribute('href', 'https://example.com/@testuser');
        });
    });
});
