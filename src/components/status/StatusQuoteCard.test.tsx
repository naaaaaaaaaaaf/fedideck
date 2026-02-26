import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusQuoteCard } from './StatusQuoteCard';
import type { mastodon } from 'masto';
import type { AccountSession, MastoClient } from '../../api/mastoClient';
import * as mastoClient from '../../api/mastoClient';

// Mock DisplayName component
vi.mock('../DisplayName', () => ({
    DisplayName: ({ account }: { account: { displayName?: string; username: string } }) => (
        <span>{account.displayName || account.username}</span>
    ),
}));

// Mock StatusBody component
vi.mock('./StatusBody', () => ({
    StatusBody: ({ content }: { content: string }) => (
        <div dangerouslySetInnerHTML={{ __html: content }} />
    ),
}));

// Helper to create minimal mock status
function createMockStatus(overrides: Partial<mastodon.v1.Status> = {}): mastodon.v1.Status {
    return {
        id: '1',
        createdAt: '2024-01-01T00:00:00Z',
        uri: 'https://example.com/status/1',
        url: 'https://example.com/@user/1',
        account: {
            id: '1',
            username: 'testuser',
            displayName: 'Test User',
            url: 'https://example.com/@testuser',
            acct: 'testuser@example.com',
            createdAt: '2024-01-01T00:00:00Z',
            followersCount: 0,
            followingCount: 0,
            statusesCount: 0,
            note: '',
            avatar: 'https://example.com/avatar.png',
            avatarStatic: '',
            header: '',
            headerStatic: '',
            emojis: [],
            fields: [],
            locked: false,
            bot: false,
            group: false,
            discoverable: false,
            noindex: false,
            suspended: false,
            limited: false,
        },
        content: '<p>Test content</p>',
        visibility: 'public',
        sensitive: false,
        spoilerText: '',
        mediaAttachments: [],
        mentions: [],
        tags: [],
        emojis: [],
        reblogsCount: 0,
        favouritesCount: 0,
        repliesCount: 0,
        ...overrides,
    } as mastodon.v1.Status;
}

function createMockAccountSession(): AccountSession {
    return {
        id: 'session-1',
        instanceUrl: 'https://example.com',
        accessToken: 'test-token',
        account: createMockStatus().account,
    };
}

describe('StatusQuoteCard', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('renders quoted status content', () => {
        const status = createMockStatus({ content: '<p>Quoted post content</p>' });
        render(<StatusQuoteCard status={status} />);

        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('@testuser@example.com')).toBeInTheDocument();
    });

    it('renders avatar', () => {
        const status = createMockStatus();
        render(<StatusQuoteCard status={status} />);

        // Avatar img has alt="" which makes it role="presentation"
        const avatar = screen.getByRole('presentation');
        expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.png');
    });

    it('calls onClick when clicked', async () => {
        const user = userEvent.setup();
        const status = createMockStatus();
        const onClick = vi.fn();

        render(<StatusQuoteCard status={status} onClick={onClick} />);

        await user.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalledWith(status);
    });

    it('stops propagation on click', async () => {
        const user = userEvent.setup();
        const status = createMockStatus();
        const onClick = vi.fn();
        const parentClick = vi.fn();

        render(
            <div onClick={parentClick}>
                <StatusQuoteCard status={status} onClick={onClick} />
            </div>
        );

        await user.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalled();
        expect(parentClick).not.toHaveBeenCalled();
    });

    it('handles keyboard navigation', async () => {
        const user = userEvent.setup();
        const status = createMockStatus();
        const onClick = vi.fn();

        render(<StatusQuoteCard status={status} onClick={onClick} />);

        const button = screen.getByRole('button');
        button.focus();
        await user.keyboard('{Enter}');

        expect(onClick).toHaveBeenCalledWith(status);
    });

    it('stops propagation on keyboard navigation', async () => {
        const user = userEvent.setup();
        const status = createMockStatus();
        const onClick = vi.fn();
        const parentKeyDown = vi.fn();

        render(
            <div onKeyDown={parentKeyDown}>
                <StatusQuoteCard status={status} onClick={onClick} />
            </div>
        );

        const button = screen.getByRole('button');
        button.focus();
        await user.keyboard('{Enter}');

        expect(onClick).toHaveBeenCalled();
        expect(parentKeyDown).not.toHaveBeenCalled();
    });

    it('does not render as button when onClick is not provided', () => {
        const status = createMockStatus();
        render(<StatusQuoteCard status={status} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows poll indicator when status has poll', () => {
        const status = createMockStatus({
            poll: {
                id: 'poll1',
                expiresAt: null,
                expired: false,
                multiple: false,
                votesCount: 5,
                votersCount: 5,
                options: [{ title: 'Option 1', votesCount: 3, emojis: [] }],
                emojis: [],
            } as mastodon.v1.Poll,
        });

        render(<StatusQuoteCard status={status} />);

        expect(screen.getByText('投票')).toBeInTheDocument();
    });

    it('applies card variant styles by default', () => {
        const status = createMockStatus();
        const { container } = render(<StatusQuoteCard status={status} />);

        const card = container.firstChild as HTMLElement;
        expect(card).toHaveClass('mt-3');
    });

    it('applies detail variant styles when specified', () => {
        const status = createMockStatus();
        const { container } = render(<StatusQuoteCard status={status} variant="detail" />);

        const card = container.firstChild as HTMLElement;
        expect(card).toHaveClass('mt-4');
    });

    it('resolves accepted shallow nested quote when accountSession is provided', async () => {
        const rootStatus = createMockStatus({
            id: 'root-1',
            content: '<p>Root quoted content</p>',
            account: {
                ...createMockStatus().account,
                id: 'root-user',
                displayName: 'Root User',
                acct: 'rootuser',
            },
        });

        const quotedStatus = createMockStatus({
            id: 'quote-2',
            content: '<p>Second quote content</p>',
            quote: {
                state: 'accepted',
                quotedStatusId: 'root-1',
            } as mastodon.v1.ShallowQuote,
        });

        vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as MastoClient);
        vi.spyOn(mastoClient, 'fetchStatus').mockResolvedValue(rootStatus);

        render(
            <StatusQuoteCard status={quotedStatus} accountSession={createMockAccountSession()} />
        );

        await waitFor(() => {
            expect(mastoClient.fetchStatus).toHaveBeenCalledWith(expect.anything(), 'root-1');
        });

        expect(await screen.findByText('Root quoted content')).toBeInTheDocument();
    });

    it('does not render quotes beyond MAX_QUOTE_DEPTH (4th level is hidden)', async () => {
        // Create a 4-level quote chain: statusD -> statusC -> statusB -> statusA
        const statusA = createMockStatus({
            id: 'status-a',
            content: '<p>Status A content</p>',
        });

        const statusB = createMockStatus({
            id: 'status-b',
            content: '<p>Status B content</p>',
            quote: {
                state: 'accepted',
                quotedStatusId: 'status-a',
                quotedStatus: statusA,
            } as mastodon.v1.Quote,
        });

        const statusC = createMockStatus({
            id: 'status-c',
            content: '<p>Status C content</p>',
            quote: {
                state: 'accepted',
                quotedStatusId: 'status-b',
                quotedStatus: statusB,
            } as mastodon.v1.Quote,
        });

        const statusD = createMockStatus({
            id: 'status-d',
            content: '<p>Status D content</p>',
            quote: {
                state: 'accepted',
                quotedStatusId: 'status-c',
                quotedStatus: statusC,
            } as mastodon.v1.Quote,
        });

        vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as MastoClient);

        render(<StatusQuoteCard status={statusD} accountSession={createMockAccountSession()} />);

        // Status D (root, depth=0) is visible
        expect(screen.getByText('Status D content')).toBeInTheDocument();

        // Status C (depth=1) is visible
        expect(screen.getByText('Status C content')).toBeInTheDocument();

        // Status B (depth=2) is visible (MAX_QUOTE_DEPTH=2 allows up to depth=2)
        expect(screen.getByText('Status B content')).toBeInTheDocument();

        // Status A (depth=3) is NOT visible due to MAX_QUOTE_DEPTH=2
        expect(screen.queryByText('Status A content')).not.toBeInTheDocument();
    });

    it('prevents circular reference rendering', () => {
        // Create status A that quotes status B
        const statusB = createMockStatus({
            id: 'status-b',
            content: '<p>Status B content</p>',
        });

        // Create status A that quotes B
        const statusA = createMockStatus({
            id: 'status-a',
            content: '<p>Status A content</p>',
            quote: {
                state: 'accepted',
                quotedStatusId: 'status-b',
                quotedStatus: statusB,
            } as mastodon.v1.Quote,
        });

        // Now make B quote A (circular)
        statusB.quote = {
            state: 'accepted',
            quotedStatusId: 'status-a',
            quotedStatus: statusA,
        } as mastodon.v1.Quote;

        vi.spyOn(mastoClient, 'getClient').mockReturnValue({} as MastoClient);

        render(<StatusQuoteCard status={statusA} accountSession={createMockAccountSession()} />);

        // Status A (root) is visible
        expect(screen.getByText('Status A content')).toBeInTheDocument();

        // Status B (quoted by A) is visible
        expect(screen.getByText('Status B content')).toBeInTheDocument();

        // Status A should NOT appear again (circular reference prevented)
        // Count occurrences of 'Status A content' - should be exactly 1
        const statusATexts = screen.getAllByText('Status A content');
        expect(statusATexts).toHaveLength(1);
    });
});
