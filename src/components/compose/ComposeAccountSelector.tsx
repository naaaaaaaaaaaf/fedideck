import { type RefObject } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import type { AccountSession } from '../../api/mastoClient';
import { DisplayName } from '../DisplayName';

interface ComposeAccountSelectorProps {
    accounts: AccountSession[];
    composingAccount: AccountSession | undefined;
    isLocked: boolean;
    showSelector: boolean;
    focusedIndex: number;
    selectedAccountId: string | null;
    listboxRef: RefObject<HTMLDivElement | null>;
    onSelectAccount: (id: string) => void;
    onToggleSelector: (show: boolean) => void;
    onSetFocusedIndex: (index: number) => void;
}

/**
 * Account selector component for compose modal
 * Allows switching between accounts for new posts
 * Locked for replies and edit mode
 */
export function ComposeAccountSelector({
    accounts,
    composingAccount,
    isLocked,
    showSelector,
    focusedIndex,
    selectedAccountId,
    listboxRef,
    onSelectAccount,
    onToggleSelector,
    onSetFocusedIndex,
}: ComposeAccountSelectorProps) {
    if (!composingAccount) return null;

    const handleToggle = () => {
        if (isLocked) return;
        const newState = !showSelector;
        onToggleSelector(newState);
        if (newState) {
            // Reset focused index to current account when opening
            const currentIndex = accounts.findIndex((a) => a.id === selectedAccountId);
            onSetFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const newIndex = (focusedIndex + 1) % accounts.length;
            onSetFocusedIndex(newIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const newIndex = (focusedIndex - 1 + accounts.length) % accounts.length;
            onSetFocusedIndex(newIndex);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onSelectAccount(accounts[focusedIndex].id);
            onToggleSelector(false);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelector(false);
        } else if (e.key === 'Tab') {
            // Close listbox and allow Tab to move focus naturally
            onToggleSelector(false);
            e.stopPropagation();
        }
    };

    return (
        <div className="relative mb-3">
            <button
                onClick={handleToggle}
                disabled={isLocked}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                    isLocked ? 'cursor-default' : 'hover:bg-slate-700/50'
                }`}
                aria-expanded={showSelector}
                aria-haspopup="listbox"
                aria-label={`投稿アカウント: ${composingAccount.account.displayName || composingAccount.account.username}`}
            >
                <img src={composingAccount.account.avatar} alt="" className="w-8 h-8 rounded-lg" />
                <div className="text-sm flex-1 min-w-0">
                    <DisplayName
                        account={composingAccount.account}
                        className="text-slate-200 truncate block"
                    />
                    <div className="text-slate-400 truncate">@{composingAccount.account.acct}</div>
                </div>
                {!isLocked && accounts.length > 1 && (
                    <LuChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                            showSelector ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                    />
                )}
            </button>

            {/* Account dropdown */}
            {!isLocked && showSelector && accounts.length > 1 && (
                <div
                    ref={listboxRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10 overflow-hidden"
                    role="listbox"
                    aria-label="アカウント一覧"
                    aria-activedescendant={
                        focusedIndex >= 0 &&
                        focusedIndex < accounts.length &&
                        accounts[focusedIndex]?.id
                            ? `account-option-${accounts[focusedIndex].id}`
                            : undefined
                    }
                    tabIndex={-1}
                    onKeyDown={handleKeyDown}
                >
                    {accounts.map((acc, index) => (
                        <button
                            key={acc.id}
                            id={`account-option-${acc.id}`}
                            onClick={() => {
                                onSelectAccount(acc.id);
                                onToggleSelector(false);
                            }}
                            className={`flex items-center gap-2 p-2 w-full text-left hover:bg-slate-700/50 transition-colors ${
                                acc.id === selectedAccountId ? 'bg-slate-700/30' : ''
                            } ${index === focusedIndex ? 'bg-slate-700/40' : ''}`}
                            role="option"
                            aria-selected={acc.id === selectedAccountId}
                            tabIndex={-1}
                        >
                            <img src={acc.account.avatar} alt="" className="w-8 h-8 rounded-lg" />
                            <div className="text-sm flex-1 min-w-0">
                                <DisplayName
                                    account={acc.account}
                                    className="text-slate-200 truncate block"
                                />
                                <div className="text-slate-400 truncate">@{acc.account.acct}</div>
                            </div>
                            {acc.id === selectedAccountId && (
                                <div
                                    className="w-2 h-2 rounded-full bg-indigo-400"
                                    aria-hidden="true"
                                />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
