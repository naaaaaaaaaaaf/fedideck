import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { mastodon } from 'masto';
import { loadSessions, saveSession, removeSession, type Session } from '../auth/sessions';

interface AccountsState {
    accounts: Session[];
    activeAccountId: string | null;

    // Actions
    loadFromStorage: () => void;
    addAccount: (session: Session) => void;
    removeAccount: (accountId: string) => void;
    setActiveAccount: (accountId: string | null) => void;
    getActiveAccount: () => Session | null;
    updateAccountInfo: (accountId: string, account: mastodon.v1.Account) => void;
}

export const useAccountsStore = create<AccountsState>()(
    persist(
        (set, get) => ({
            accounts: [],
            activeAccountId: null,

            loadFromStorage: () => {
                const sessions = loadSessions();
                set({
                    accounts: sessions,
                    activeAccountId: sessions.length > 0 ? sessions[0].id : null,
                });
            },

            addAccount: (session) => {
                saveSession(session);
                set((state) => {
                    const exists = state.accounts.some(a => a.id === session.id);
                    if (exists) {
                        return {
                            accounts: state.accounts.map(a => a.id === session.id ? session : a),
                        };
                    }
                    return {
                        accounts: [...state.accounts, session],
                        activeAccountId: state.activeAccountId ?? session.id,
                    };
                });
            },

            removeAccount: (accountId) => {
                removeSession(accountId);
                set((state) => {
                    const filtered = state.accounts.filter(a => a.id !== accountId);
                    return {
                        accounts: filtered,
                        activeAccountId: state.activeAccountId === accountId
                            ? (filtered[0]?.id ?? null)
                            : state.activeAccountId,
                    };
                });
            },

            setActiveAccount: (accountId) => {
                set({ activeAccountId: accountId });
            },

            getActiveAccount: () => {
                const { accounts, activeAccountId } = get();
                return accounts.find(a => a.id === activeAccountId) ?? null;
            },

            updateAccountInfo: (accountId, account) => {
                set((state) => ({
                    accounts: state.accounts.map(a =>
                        a.id === accountId ? { ...a, account } : a
                    ),
                }));
            },
        }),
        {
            name: 'fedideck:accounts-store',
            partialize: (state) => ({ activeAccountId: state.activeAccountId }),
        }
    )
);
