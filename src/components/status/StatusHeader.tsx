import React from 'react';
import type { mastodon } from 'masto';
import { DisplayName } from '../DisplayName';
import { formatDate } from '../../utils/dateFormat';
import { getVisibilityMeta } from '../../utils/statusVisibility';

interface StatusHeaderProps {
    /** The account that authored the status */
    account: mastodon.v1.Account;
    /** Timestamp of the status creation */
    createdAt: string;
    /** Visibility level of the status */
    visibility: mastodon.v1.Status['visibility'];
    /** Size variant for styling */
    variant?: 'card' | 'detail' | 'thread';
    /** Callback when account is clicked (enables button mode) */
    onAccountClick?: (account: mastodon.v1.Account, accountSessionId: string) => void;
    /** Account session ID for account click handler */
    accountSessionId?: string;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays status header with avatar, display name, account handle, timestamp, and visibility.
 * Supports card, detail, and thread variants with different styling.
 */
export const StatusHeader = React.memo(function StatusHeader({
    account,
    createdAt,
    visibility,
    variant = 'card',
    onAccountClick,
    accountSessionId,
    className = '',
}: StatusHeaderProps) {
    const avatarSize = variant === 'detail' ? 'w-14 h-14' : 'w-12 h-12';
    const avatarRounded = variant === 'detail' ? 'rounded-xl' : 'rounded-lg';
    const displayNameSize = variant === 'detail' ? 'text-lg' : '';
    const createdAtText = formatDate(createdAt);
    const { label: visibilityLabel, icon: VisibilityIcon } = getVisibilityMeta(visibility);

    const canClickAccount = onAccountClick && accountSessionId;

    return (
        <div className={`flex gap-3 items-start ${className}`}>
            {/* Avatar */}
            {canClickAccount ? (
                <button
                    type="button"
                    onClick={() => onAccountClick(account, accountSessionId)}
                    className="shrink-0"
                    aria-label={`${account.displayName || account.username}のプロフィールを表示`}
                >
                    <img
                        src={account.avatar}
                        alt={account.displayName || account.username}
                        className={`${avatarSize} ${avatarRounded} hover:opacity-80 transition-opacity`}
                    />
                </button>
            ) : (
                <a
                    href={account.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                >
                    <img
                        src={account.avatar}
                        alt={account.displayName || account.username}
                        className={`${avatarSize} ${avatarRounded} hover:opacity-80 transition-opacity`}
                    />
                </a>
            )}

            {/* Content */}
            <div className="min-w-0 flex-1">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        {canClickAccount ? (
                            <button
                                onClick={() => onAccountClick(account, accountSessionId)}
                                className="hover:underline text-left min-w-0 max-w-full"
                                aria-label={`${account.displayName || account.username}のプロフィールを表示`}
                                type="button"
                            >
                                <DisplayName
                                    account={account}
                                    className={`font-semibold text-slate-100 block truncate ${displayNameSize}`}
                                />
                                <span className="text-sm text-slate-400 block truncate">
                                    @{account.acct}
                                </span>
                            </button>
                        ) : (
                            <a
                                href={account.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline block min-w-0 max-w-full"
                            >
                                <DisplayName
                                    account={account}
                                    className={`font-semibold text-slate-100 block truncate ${displayNameSize}`}
                                />
                                <span className="text-sm text-slate-400 block truncate">
                                    @{account.acct}
                                </span>
                            </a>
                        )}
                    </div>
                    <a
                        href={account.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300 shrink-0"
                        aria-label={`公開範囲: ${visibilityLabel}、投稿日時: ${createdAtText}`}
                        title={`公開範囲: ${visibilityLabel}`}
                    >
                        <VisibilityIcon className="w-4 h-4" aria-hidden="true" />
                        <span>{createdAtText}</span>
                    </a>
                </div>
            </div>
        </div>
    );
});
