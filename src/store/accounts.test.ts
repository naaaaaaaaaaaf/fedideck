import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAccountsStore } from '../store/accounts';

// Mock account for testing
const mockAccount = {
    id: '12345',
    username: 'testuser',
    acct: 'testuser',
    displayName: 'Test User',
    locked: false,
    bot: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    note: 'Test bio',
    url: 'https://mastodon.social/@testuser',
    avatar: 'https://example.com/avatar.png',
    avatarStatic: 'https://example.com/avatar.png',
    header: 'https://example.com/header.png',
    headerStatic: 'https://example.com/header.png',
    followersCount: 100,
    followingCount: 50,
    statusesCount: 200,
    lastStatusAt: '2024-01-01',
    emojis: [],
    fields: [],
};

const createMockSession = (id: string, instanceUrl: string) => ({
    id: `${id}@${new URL(instanceUrl).hostname}`,
    instanceUrl,
    accessToken: `token_${id}`,
    account: { ...mockAccount, id } as any,
    createdAt: Date.now(),
});

describe('useAccountsStore', () => {
    beforeEach(() => {
        // Reset the store state
        const { result } = renderHook(() => useAccountsStore());
        act(() => {
            result.current.accounts.forEach(acc => {
                result.current.removeAccount(acc.id);
            });
        });
    });

    describe('addAccount', () => {
        it('should add a new account', () => {
            const { result } = renderHook(() => useAccountsStore());
            const session = createMockSession('12345', 'https://mastodon.social');

            act(() => {
                result.current.addAccount(session);
            });

            expect(result.current.accounts).toHaveLength(1);
            expect(result.current.accounts[0].id).toBe(session.id);
        });

        it('should set first account as active', () => {
            const { result } = renderHook(() => useAccountsStore());
            const session = createMockSession('12345', 'https://mastodon.social');

            act(() => {
                result.current.addAccount(session);
            });

            expect(result.current.activeAccountId).toBe(session.id);
        });

        it('should not change active account when adding second account', () => {
            const { result } = renderHook(() => useAccountsStore());
            const session1 = createMockSession('12345', 'https://mastodon.social');
            const session2 = createMockSession('67890', 'https://mstdn.jp');

            act(() => {
                result.current.addAccount(session1);
                result.current.addAccount(session2);
            });

            expect(result.current.accounts).toHaveLength(2);
            expect(result.current.activeAccountId).toBe(session1.id);
        });
    });

    describe('removeAccount', () => {
        it('should remove an account', () => {
            const { result } = renderHook(() => useAccountsStore());
            const session = createMockSession('12345', 'https://mastodon.social');

            act(() => {
                result.current.addAccount(session);
            });

            expect(result.current.accounts).toHaveLength(1);

            act(() => {
                result.current.removeAccount(session.id);
            });

            expect(result.current.accounts).toHaveLength(0);
        });

        it('should switch active account when removing active account', () => {
            const { result } = renderHook(() => useAccountsStore());
            const session1 = createMockSession('12345', 'https://mastodon.social');
            const session2 = createMockSession('67890', 'https://mstdn.jp');

            act(() => {
                result.current.addAccount(session1);
                result.current.addAccount(session2);
            });

            expect(result.current.activeAccountId).toBe(session1.id);

            act(() => {
                result.current.removeAccount(session1.id);
            });

            expect(result.current.activeAccountId).toBe(session2.id);
        });
    });

    describe('setActiveAccount', () => {
        it('should change active account', () => {
            const { result } = renderHook(() => useAccountsStore());
            const session1 = createMockSession('12345', 'https://mastodon.social');
            const session2 = createMockSession('67890', 'https://mstdn.jp');

            act(() => {
                result.current.addAccount(session1);
                result.current.addAccount(session2);
                result.current.setActiveAccount(session2.id);
            });

            expect(result.current.activeAccountId).toBe(session2.id);
        });
    });

    describe('getActiveAccount', () => {
        it('should return null when no accounts', () => {
            const { result } = renderHook(() => useAccountsStore());

            const activeAccount = result.current.getActiveAccount();
            expect(activeAccount).toBeNull();
        });

        it('should return the active account', () => {
            const { result } = renderHook(() => useAccountsStore());
            const session = createMockSession('12345', 'https://mastodon.social');

            act(() => {
                result.current.addAccount(session);
            });

            const activeAccount = result.current.getActiveAccount();
            expect(activeAccount).toBeDefined();
            expect(activeAccount?.id).toBe(session.id);
        });
    });
});
