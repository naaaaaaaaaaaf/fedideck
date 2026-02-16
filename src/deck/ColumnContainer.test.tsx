import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColumnContainer } from './ColumnContainer';
import type { mastodon } from 'masto';
import type { Column } from '../store/columns';

const createMockSession = (overrides = {}) => ({
    id: '1@mastodon.social',
    instanceUrl: 'https://mastodon.social',
    accessToken: 'token',
    account: {
        id: '1',
        username: 'testuser',
        acct: 'testuser',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.png',
    } as mastodon.v1.Account,
    createdAt: Date.now(),
    ...overrides,
});

const mockColumns: Column[] = [];
const mockAccounts: ReturnType<typeof createMockSession>[] = [];
let mockActiveAccountId: string | null = null;
const mockRemoveColumn = vi.fn();

vi.mock('../store/columns', () => ({
    useColumnsStore: (selector: (state: unknown) => unknown) => {
        const state = {
            columns: mockColumns,
            removeColumn: mockRemoveColumn,
        };
        return selector(state);
    },
}));

vi.mock('../store/accounts', () => ({
    useAccountsStore: (selector: (state: unknown) => unknown) => {
        const state = {
            accounts: mockAccounts,
            activeAccountId: mockActiveAccountId,
        };
        return selector(state);
    },
}));

// Mock Column component to avoid complex dependencies
vi.mock('./Column', () => ({
    Column: ({ id, onRemove }: { id: string; onRemove?: () => void }) => (
        <div data-testid={`column-${id}`}>
            <span>Column {id}</span>
            {onRemove && (
                <button onClick={onRemove} data-testid={`remove-${id}`}>
                    Remove
                </button>
            )}
        </div>
    ),
}));

describe('ColumnContainer', () => {
    beforeEach(() => {
        mockColumns.length = 0;
        mockAccounts.length = 0;
        mockActiveAccountId = null;
        mockRemoveColumn.mockClear();
    });

    describe('empty states', () => {
        it('should show welcome message when no columns and no accounts', () => {
            render(<ColumnContainer />);
            expect(screen.getByText('FediDeckへようこそ')).toBeInTheDocument();
            expect(screen.getByText('まずはアカウントを追加してください')).toBeInTheDocument();
        });

        it('should show "カラムがありません" when has accounts but no columns', () => {
            mockAccounts.push(createMockSession());
            render(<ColumnContainer />);
            expect(screen.getByText('カラムがありません')).toBeInTheDocument();
        });
    });

    describe('column rendering', () => {
        it('should render valid columns', () => {
            mockAccounts.push(createMockSession());
            mockColumns.push({
                id: 'col-1',
                accountId: '1@mastodon.social',
                stream: { type: 'home' },
            });
            render(<ColumnContainer />);
            expect(screen.getByTestId('column-col-1')).toBeInTheDocument();
        });

        it('should filter out columns with invalid account IDs', () => {
            mockAccounts.push(createMockSession());
            mockColumns.push({
                id: 'col-1',
                accountId: '1@mastodon.social',
                stream: { type: 'home' },
            });
            mockColumns.push({
                id: 'col-2',
                accountId: 'nonexistent@example.com',
                stream: { type: 'public' },
            });
            render(<ColumnContainer />);
            expect(screen.getByTestId('column-col-1')).toBeInTheDocument();
            expect(screen.queryByTestId('column-col-2')).not.toBeInTheDocument();
        });
    });

    describe('add column button', () => {
        it('should show add column button when activeAccountId is set', () => {
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<ColumnContainer />);
            expect(screen.getByTitle('カラムを追加')).toBeInTheDocument();
        });

        it('should not show add column button when activeAccountId is null', () => {
            mockAccounts.push(createMockSession());
            mockActiveAccountId = null;
            render(<ColumnContainer />);
            expect(screen.queryByTitle('カラムを追加')).not.toBeInTheDocument();
        });

        it('should call onAddColumn when add button is clicked', async () => {
            const user = userEvent.setup();
            const onAddColumn = vi.fn();
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<ColumnContainer onAddColumn={onAddColumn} />);

            await user.click(screen.getByTitle('カラムを追加'));
            expect(onAddColumn).toHaveBeenCalledTimes(1);
        });

        it('should have centering classes on add column button', () => {
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<ColumnContainer />);
            const addButton = screen.getByTitle('カラムを追加');
            expect(addButton.classList.contains('flex')).toBe(true);
            expect(addButton.classList.contains('items-center')).toBe(true);
            expect(addButton.classList.contains('justify-center')).toBe(true);
        });

        it('should render LuPlus icon with size class', () => {
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<ColumnContainer />);
            const addButton = screen.getByTitle('カラムを追加');
            // LuPlus is an SVG icon rendered inside the button
            const svg = addButton.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg?.classList.contains('w-6')).toBe(true);
            expect(svg?.classList.contains('h-6')).toBe(true);
        });
    });

    describe('column removal', () => {
        it('should call removeColumn when column onRemove is triggered', async () => {
            const user = userEvent.setup();
            mockAccounts.push(createMockSession());
            mockColumns.push({
                id: 'col-1',
                accountId: '1@mastodon.social',
                stream: { type: 'home' },
            });
            render(<ColumnContainer />);

            await user.click(screen.getByTestId('remove-col-1'));
            expect(mockRemoveColumn).toHaveBeenCalledWith('col-1');
        });
    });
});
