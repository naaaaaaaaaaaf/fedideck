import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from './Sidebar';
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
        url: 'https://mastodon.social/@testuser',
    } as mastodon.v1.Account,
    createdAt: Date.now(),
    ...overrides,
});

// Mock accounts store
const mockAccounts: ReturnType<typeof createMockSession>[] = [];
const mockRemoveAccount = vi.fn();

vi.mock('../store/accounts', () => ({
    useAccountsStore: (selector: (state: unknown) => unknown) => {
        const state = {
            accounts: mockAccounts,
            removeAccount: mockRemoveAccount,
        };
        return selector(state);
    },
}));

describe('Sidebar', () => {
    beforeEach(() => {
        mockAccounts.length = 0;
        mockRemoveAccount.mockClear();
    });

    describe('rendering', () => {
        it('should render aside with aria-label', () => {
            render(<Sidebar onAddAccount={vi.fn()} onCompose={vi.fn()} />);
            expect(screen.getByLabelText('サイドバー')).toBeInTheDocument();
        });

        it('should render compose button with aria-label', () => {
            render(<Sidebar onAddAccount={vi.fn()} onCompose={vi.fn()} />);
            expect(screen.getByLabelText('新しい投稿を作成')).toBeInTheDocument();
        });

        it('should render add account button with aria-label', () => {
            render(<Sidebar onAddAccount={vi.fn()} onCompose={vi.fn()} />);
            expect(screen.getByLabelText('アカウントを追加')).toBeInTheDocument();
        });

        it('should render empty navigation when no accounts', () => {
            render(<Sidebar onAddAccount={vi.fn()} onCompose={vi.fn()} />);
            const nav = screen.getByLabelText('アカウント一覧');
            expect(nav.children.length).toBe(0);
        });
    });

    describe('account display', () => {
        it('should display account avatar with alt text', () => {
            mockAccounts.push(createMockSession());
            render(<Sidebar onAddAccount={vi.fn()} onCompose={vi.fn()} />);
            expect(screen.getByAltText('Test Userのアバター')).toBeInTheDocument();
        });

        it('should display account title with full acct', () => {
            mockAccounts.push(createMockSession());
            render(<Sidebar onAddAccount={vi.fn()} onCompose={vi.fn()} />);
            expect(screen.getByTitle('@testuser@mastodon.social')).toBeInTheDocument();
        });

        it('should display multiple accounts', () => {
            mockAccounts.push(createMockSession());
            mockAccounts.push(
                createMockSession({
                    id: '2@mstdn.jp',
                    instanceUrl: 'https://mstdn.jp',
                    account: {
                        id: '2',
                        username: 'user2',
                        acct: 'user2',
                        displayName: 'User Two',
                        avatar: 'https://example.com/avatar2.png',
                    } as mastodon.v1.Account,
                })
            );
            render(<Sidebar onAddAccount={vi.fn()} onCompose={vi.fn()} />);
            expect(screen.getByAltText('Test Userのアバター')).toBeInTheDocument();
            expect(screen.getByAltText('User Twoのアバター')).toBeInTheDocument();
        });
    });

    describe('interactions', () => {
        it('should call onCompose when compose button is clicked', async () => {
            const user = userEvent.setup();
            const onCompose = vi.fn();
            render(<Sidebar onAddAccount={vi.fn()} onCompose={onCompose} />);

            await user.click(screen.getByLabelText('新しい投稿を作成'));
            expect(onCompose).toHaveBeenCalledTimes(1);
        });

        it('should call onAddAccount when add account button is clicked', async () => {
            const user = userEvent.setup();
            const onAddAccount = vi.fn();
            render(<Sidebar onAddAccount={onAddAccount} onCompose={vi.fn()} />);

            await user.click(screen.getByLabelText('アカウントを追加'));
            expect(onAddAccount).toHaveBeenCalledTimes(1);
        });

        it('should call removeAccount when confirm is accepted', async () => {
            const user = userEvent.setup();
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            mockAccounts.push(createMockSession());

            render(<Sidebar onAddAccount={vi.fn()} onCompose={vi.fn()} />);

            const logoutButton = screen.getByLabelText('Test Userをログアウト');
            await user.click(logoutButton);

            expect(window.confirm).toHaveBeenCalledWith('このアカウントをログアウトしますか？');
            expect(mockRemoveAccount).toHaveBeenCalledWith('1@mastodon.social');
        });

        it('should NOT call removeAccount when confirm is rejected', async () => {
            const user = userEvent.setup();
            vi.spyOn(window, 'confirm').mockReturnValue(false);
            mockAccounts.push(createMockSession());

            render(<Sidebar onAddAccount={vi.fn()} onCompose={vi.fn()} />);

            const logoutButton = screen.getByLabelText('Test Userをログアウト');
            await user.click(logoutButton);

            expect(mockRemoveAccount).not.toHaveBeenCalled();
        });
    });

    describe('layout', () => {
        it('should have overflow-x-hidden on nav container', () => {
            render(<Sidebar onAddAccount={vi.fn()} onCompose={vi.fn()} />);
            const nav = screen.getByLabelText('アカウント一覧');
            expect(nav.className).toContain('overflow-x-hidden');
        });

        it('should have centering classes on add account button', () => {
            render(<Sidebar onAddAccount={vi.fn()} onCompose={vi.fn()} />);
            const addButton = screen.getByLabelText('アカウントを追加');
            expect(addButton.className).toContain('flex');
            expect(addButton.className).toContain('items-center');
            expect(addButton.className).toContain('justify-center');
        });
    });
});
