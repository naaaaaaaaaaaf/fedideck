import type { mastodon } from 'masto';
import React from 'react';
import { DisplayName } from './DisplayName';

interface UserListItemProps {
    account: mastodon.v1.Account;
    onAccountClick?: (account: mastodon.v1.Account) => void;
}

/**
 * Renders a single user in a followers/following list.
 * Displays avatar, display name (with emoji support), and username.
 * Clickable to open the user's profile.
 */
export const UserListItem = React.memo(function UserListItem({
    account,
    onAccountClick,
}: UserListItemProps) {
    const handleClick = () => {
        onAccountClick?.(account);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAccountClick?.(account);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-700/50 transition-colors cursor-pointer rounded-lg"
            aria-label={`${account.displayName || account.username} (@${account.acct})`}
        >
            <img
                src={account.avatar}
                alt=""
                className="w-10 h-10 rounded-full flex-shrink-0"
                loading="lazy"
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <DisplayName account={account} className="font-semibold text-slate-100" />
                </div>
                <div className="text-sm text-slate-400 truncate">@{account.acct}</div>
            </div>
        </button>
    );
});
