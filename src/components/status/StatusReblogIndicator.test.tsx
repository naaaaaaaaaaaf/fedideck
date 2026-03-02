import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusReblogIndicator } from './StatusReblogIndicator';
import type { mastodon } from 'masto';

const createMockAccount = (overrides: Partial<mastodon.v1.Account> = {}): mastodon.v1.Account =>
    ({
        id: '1',
        username: 'testuser',
        acct: 'testuser@example.com',
        displayName: 'Test User',
        note: '',
        url: 'https://example.com/@testuser',
        locked: false,
        bot: false,
        discoverable: false,
        group: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        avatar: 'https://example.com/avatar.png',
        avatarStatic: 'https://example.com/avatar-static.png',
        header: 'https://example.com/header.png',
        headerStatic: 'https://example.com/header-static.png',
        followersCount: 100,
        followingCount: 50,
        statusesCount: 200,
        lastStatusAt: '2024-01-01T00:00:00.000Z',
        emojis: [],
        fields: [],
        roles: [],
        ...overrides,
    }) as mastodon.v1.Account;

describe('StatusReblogIndicator', () => {
    it('renders reblogger information', () => {
        const reblogger = createMockAccount({
            id: '2',
            username: 'booster',
            displayName: 'Booster User',
            acct: 'booster@example.com',
        });

        render(<StatusReblogIndicator reblogger={reblogger} />);

        expect(screen.getByText(/Booster User/)).toBeInTheDocument();
        expect(screen.getByText(/がブースト/)).toBeInTheDocument();
    });

    it('renders reblog icon', () => {
        const reblogger = createMockAccount();
        render(<StatusReblogIndicator reblogger={reblogger} />);

        const icon = document.querySelector('svg');
        expect(icon).toHaveClass('text-green-400');
    });

    it('renders reblogger avatar', () => {
        const reblogger = createMockAccount({
            avatar: 'https://example.com/custom-avatar.png',
        });
        render(<StatusReblogIndicator reblogger={reblogger} />);

        // Find the avatar img inside the reblog indicator
        const container = screen.getByText(/がブースト/).parentElement;
        const avatar = container?.querySelector('img');
        expect(avatar).toHaveAttribute('src', 'https://example.com/custom-avatar.png');
    });

    it('applies card variant styles by default', () => {
        const reblogger = createMockAccount();
        render(<StatusReblogIndicator reblogger={reblogger} />);

        const container = screen.getByText(/がブースト/).parentElement;
        expect(container).toHaveClass('mb-2');
    });

    it('applies detail variant styles', () => {
        const reblogger = createMockAccount();
        render(<StatusReblogIndicator reblogger={reblogger} variant="detail" />);

        const container = screen.getByText(/がブースト/).parentElement;
        expect(container).toHaveClass('mb-3');
        expect(container).not.toHaveClass('ml-12');
    });

    it('uses larger avatar in detail variant', () => {
        const reblogger = createMockAccount();
        render(<StatusReblogIndicator reblogger={reblogger} variant="detail" />);

        const container = screen.getByText(/がブースト/).parentElement;
        const avatar = container?.querySelector('img');
        expect(avatar).toHaveClass('w-5', 'h-5');
    });

    it('uses smaller avatar in card variant', () => {
        const reblogger = createMockAccount();
        render(<StatusReblogIndicator reblogger={reblogger} variant="card" />);

        const container = screen.getByText(/がブースト/).parentElement;
        const avatar = container?.querySelector('img');
        expect(avatar).toHaveClass('w-4', 'h-4');
    });

    it('applies custom className', () => {
        const reblogger = createMockAccount();
        render(<StatusReblogIndicator reblogger={reblogger} className="custom-class" />);

        const container = screen.getByText(/がブースト/).parentElement;
        expect(container).toHaveClass('custom-class');
    });

    it('truncates text in card variant', () => {
        const reblogger = createMockAccount();
        render(<StatusReblogIndicator reblogger={reblogger} variant="card" />);

        const textSpan = screen.getByText(/がブースト/);
        expect(textSpan).toHaveClass('truncate');
    });

    it('does not truncate text in detail variant', () => {
        const reblogger = createMockAccount();
        render(<StatusReblogIndicator reblogger={reblogger} variant="detail" />);

        const textSpan = screen.getByText(/がブースト/);
        expect(textSpan).not.toHaveClass('truncate');
    });
});
