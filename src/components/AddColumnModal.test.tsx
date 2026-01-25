import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddColumnModal } from './AddColumnModal';
import type { mastodon } from 'masto';

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

const mockAccounts: ReturnType<typeof createMockSession>[] = [];
let mockActiveAccountId: string | null = null;
const mockAddColumn = vi.fn();

vi.mock('../store/accounts', () => ({
    useAccountsStore: (selector: (state: unknown) => unknown) => {
        const state = {
            accounts: mockAccounts,
            activeAccountId: mockActiveAccountId,
        };
        return selector(state);
    },
}));

vi.mock('../store/columns', () => ({
    useColumnsStore: (selector: (state: unknown) => unknown) => {
        const state = {
            addColumn: mockAddColumn,
        };
        return selector(state);
    },
}));

vi.mock('../hooks/useModalAccessibility', () => ({
    useModalAccessibility: ({ onClose }: { onClose: () => void }) => ({
        handleKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        },
    }),
}));

describe('AddColumnModal', () => {
    beforeEach(() => {
        mockAccounts.length = 0;
        mockActiveAccountId = null;
        mockAddColumn.mockClear();
    });

    describe('rendering', () => {
        it('should return null when isOpen is false', () => {
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            const { container } = render(<AddColumnModal isOpen={false} onClose={vi.fn()} />);
            expect(container.firstChild).toBeNull();
        });

        it('should render modal when isOpen is true', () => {
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={vi.fn()} />);
            expect(screen.getByText('カラムを追加')).toBeInTheDocument();
        });

        it('should display four column types', () => {
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={vi.fn()} />);
            expect(screen.getByText('ホーム')).toBeInTheDocument();
            expect(screen.getByText('通知')).toBeInTheDocument();
            expect(screen.getByText('ローカル')).toBeInTheDocument();
            expect(screen.getByText('連合')).toBeInTheDocument();
        });

        it('should have dialog role and aria attributes', () => {
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={vi.fn()} />);
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-labelledby', 'add-column-modal-title');
        });
    });

    describe('account selector', () => {
        it('should display selected account', () => {
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={vi.fn()} />);
            expect(screen.getByText('Test User')).toBeInTheDocument();
        });

        it('should open dropdown when account button is clicked', async () => {
            const user = userEvent.setup();
            mockAccounts.push(createMockSession());
            mockAccounts.push(createMockSession({
                id: '2@mstdn.jp',
                instanceUrl: 'https://mstdn.jp',
                account: {
                    id: '2',
                    username: 'user2',
                    acct: 'user2',
                    displayName: 'User Two',
                    avatar: 'https://example.com/avatar2.png',
                } as mastodon.v1.Account,
            }));
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={vi.fn()} />);

            const accountButton = screen.getByLabelText(/アカウント選択/);
            await user.click(accountButton);

            expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        it('should update selectedAccountId when account is selected from dropdown', async () => {
            const user = userEvent.setup();
            mockAccounts.push(createMockSession());
            mockAccounts.push(createMockSession({
                id: '2@mstdn.jp',
                instanceUrl: 'https://mstdn.jp',
                account: {
                    id: '2',
                    username: 'user2',
                    acct: 'user2',
                    displayName: 'User Two',
                    avatar: 'https://example.com/avatar2.png',
                } as mastodon.v1.Account,
            }));
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={vi.fn()} />);

            // Open dropdown
            const accountButton = screen.getByLabelText(/アカウント選択/);
            await user.click(accountButton);

            // Select second account
            const option = screen.getByRole('option', { name: /User Two/ });
            await user.click(option);

            // Now add a column - it should use the new account
            await user.click(screen.getByText('ホーム'));
            expect(mockAddColumn).toHaveBeenCalledWith({
                accountId: '2@mstdn.jp',
                stream: { type: 'home' },
            });
        });
    });

    describe('column addition', () => {
        it('should call addColumn with home type and close', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={onClose} />);

            await user.click(screen.getByText('ホーム'));

            expect(mockAddColumn).toHaveBeenCalledWith({
                accountId: '1@mastodon.social',
                stream: { type: 'home' },
            });
            expect(onClose).toHaveBeenCalled();
        });

        it('should call addColumn with notifications type', async () => {
            const user = userEvent.setup();
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={vi.fn()} />);

            await user.click(screen.getByText('通知'));

            expect(mockAddColumn).toHaveBeenCalledWith({
                accountId: '1@mastodon.social',
                stream: { type: 'notifications' },
            });
        });

        it('should call addColumn with public:local type', async () => {
            const user = userEvent.setup();
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={vi.fn()} />);

            await user.click(screen.getByText('ローカル'));

            expect(mockAddColumn).toHaveBeenCalledWith({
                accountId: '1@mastodon.social',
                stream: { type: 'public:local' },
            });
        });

        it('should call addColumn with public type', async () => {
            const user = userEvent.setup();
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={vi.fn()} />);

            await user.click(screen.getByText('連合'));

            expect(mockAddColumn).toHaveBeenCalledWith({
                accountId: '1@mastodon.social',
                stream: { type: 'public' },
            });
        });

        it('should not call addColumn when no account is selected', async () => {
            const user = userEvent.setup();
            // No accounts, no active account
            render(<AddColumnModal isOpen={true} onClose={vi.fn()} />);

            await user.click(screen.getByText('ホーム'));

            expect(mockAddColumn).not.toHaveBeenCalled();
        });
    });

    describe('close behavior', () => {
        it('should call onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={onClose} />);

            await user.click(screen.getByLabelText('閉じる'));
            expect(onClose).toHaveBeenCalled();
        });

        it('should call onClose when backdrop is clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            mockAccounts.push(createMockSession());
            mockActiveAccountId = '1@mastodon.social';
            render(<AddColumnModal isOpen={true} onClose={onClose} />);

            const backdrop = document.querySelector('[aria-hidden="true"]');
            await user.click(backdrop!);
            expect(onClose).toHaveBeenCalled();
        });
    });
});
