import type { mastodon } from 'masto';
import { useState, type ReactNode } from 'react';
import {
    LuMessageCircle,
    LuRepeat2,
    LuStar,
    LuUserPlus,
    LuUserCheck,
    LuChartBar,
    LuFileText,
    LuPencil,
    LuPartyPopper,
    LuCircleAlert,
    LuBell,
    LuTriangleAlert,
} from 'react-icons/lu';
import { formatDate } from '../utils/dateFormat';
import { replaceEmojisWithImages } from '../utils/emoji';
import { DisplayName } from './DisplayName';
import { MediaAttachment } from './MediaAttachment';

interface NotificationCardProps {
    notification: mastodon.v1.Notification;
    onStatusClick?: (status: mastodon.v1.Status) => void;
    onAccountClick?: (account: mastodon.v1.Account) => void;
    onNsfwReveal?: (statusId: string) => void;
    nsfwRevealedStatusIds?: Set<string>;
}

export function NotificationCard({
    notification,
    onStatusClick,
    onAccountClick,
    onNsfwReveal,
    nsfwRevealedStatusIds,
}: NotificationCardProps) {
    const getNotificationInfo = (): { icon: ReactNode; label: string; color: string } => {
        switch (notification.type) {
            case 'mention':
                return { icon: <LuMessageCircle />, label: 'メンション', color: 'text-blue-400' };
            case 'reblog':
                return { icon: <LuRepeat2 />, label: 'ブースト', color: 'text-green-400' };
            case 'favourite':
                return { icon: <LuStar />, label: 'お気に入り', color: 'text-amber-400' };
            case 'follow':
                return { icon: <LuUserPlus />, label: 'フォロー', color: 'text-purple-400' };
            case 'follow_request':
                return {
                    icon: <LuUserCheck />,
                    label: 'フォローリクエスト',
                    color: 'text-purple-400',
                };
            case 'poll':
                return { icon: <LuChartBar />, label: '投票終了', color: 'text-indigo-400' };
            case 'status':
                return { icon: <LuFileText />, label: '新規投稿', color: 'text-slate-400' };
            case 'update':
                return { icon: <LuPencil />, label: '編集', color: 'text-slate-400' };
            case 'admin.sign_up':
                return { icon: <LuPartyPopper />, label: '新規登録', color: 'text-emerald-400' };
            case 'admin.report':
                return { icon: <LuCircleAlert />, label: '通報', color: 'text-red-400' };
            default:
                return { icon: <LuBell />, label: notification.type, color: 'text-slate-400' };
        }
    };

    const info = getNotificationInfo();
    const account = notification.account;
    const status = notification.status;
    const displayStatus = status?.reblog ?? status;

    // NSFW state: controlled from parent or local
    // If parent provides state (nsfwRevealedStatusIds), always use it
    // When onNsfwReveal is missing, operates in read-only mode
    const isControlled = nsfwRevealedStatusIds !== undefined;
    const [localNsfwRevealed, setLocalNsfwRevealed] = useState(false);
    const nsfwRevealed = isControlled
        ? displayStatus
            ? nsfwRevealedStatusIds.has(displayStatus.id)
            : false
        : localNsfwRevealed;

    const handleNsfwToggle = () => {
        // Controlled mode: use parent state
        if (isControlled) {
            // If callback provided, notify parent (read-only mode if no callback)
            if (!nsfwRevealed && onNsfwReveal && displayStatus) {
                onNsfwReveal(displayStatus.id);
            }
            return;
        }

        // Uncontrolled mode: notify parent if callback provided, then toggle local state
        if (!nsfwRevealed && onNsfwReveal && displayStatus) {
            onNsfwReveal(displayStatus.id);
        }
        setLocalNsfwRevealed((prev) => !prev);
    };

    // Note: nsfwRevealed state is automatically reset when notification changes
    // because NotificationCard is rendered with key={notification.id} in parent

    // Check if status area should be clickable
    const isStatusClickable = Boolean(status && onStatusClick);

    // Check if card itself should be clickable for profile
    // Note: follow_request has action buttons, so card should not be clickable
    const isCardClickable = Boolean(!status && onAccountClick && notification.type === 'follow');

    // Handle click on card (for notifications without status)
    const handleCardClick = (e: React.MouseEvent) => {
        if (!isCardClickable) return;

        const target = e.target as HTMLElement;
        // Ignore clicks on interactive elements
        if (
            target.closest('a') ||
            target.closest('button') ||
            target.closest('summary') ||
            target.closest('audio')
        ) {
            return;
        }
        onAccountClick?.(account);
    };

    // Handle keyboard navigation for card
    const handleCardKeyDown = (e: React.KeyboardEvent) => {
        if (!isCardClickable) return;

        if (e.key === 'Enter' || e.key === ' ') {
            const target = e.target as HTMLElement;
            if (
                target.closest('a') ||
                target.closest('button') ||
                target.closest('video') ||
                target.closest('audio') ||
                target.closest('summary')
            ) {
                return;
            }
            e.preventDefault();
            onAccountClick?.(account);
        }
    };

    // Handle click on status area
    const handleStatusClick = (e: React.MouseEvent) => {
        if (!status || !onStatusClick) return;

        const target = e.target as HTMLElement;
        // Ignore clicks on interactive elements
        if (
            target.closest('a') ||
            target.closest('button') ||
            target.closest('summary') ||
            target.closest('audio')
        ) {
            return;
        }
        onStatusClick(status);
    };

    // Handle keyboard navigation for status area
    const handleStatusKeyDown = (e: React.KeyboardEvent) => {
        if (!status || !onStatusClick) return;

        if (e.key === 'Enter' || e.key === ' ') {
            // Ignore keyboard events on interactive elements
            const target = e.target as HTMLElement;
            if (
                target.closest('a') ||
                target.closest('button') ||
                target.closest('video') ||
                target.closest('audio') ||
                target.closest('summary')
            ) {
                return;
            }
            e.preventDefault();
            onStatusClick(status);
        }
    };

    return (
        <article
            className={`p-4 border-b border-slate-700/50 card-hover animate-fade-in ${isCardClickable ? 'cursor-pointer hover:bg-slate-800/50 transition-colors' : ''}`}
            onClick={isCardClickable ? handleCardClick : undefined}
            onKeyDown={isCardClickable ? handleCardKeyDown : undefined}
            role={isCardClickable ? 'button' : undefined}
            tabIndex={isCardClickable ? 0 : undefined}
            aria-label={
                isCardClickable
                    ? `${account.displayName || account.username}のプロフィールを表示`
                    : undefined
            }
        >
            {/* Notification header */}
            <div className="flex items-center gap-3 mb-2">
                <span className={`text-lg ${info.color}`} aria-hidden="true">
                    {info.icon}
                </span>
                <div className="flex items-baseline gap-2 min-w-0 flex-1">
                    {isCardClickable ? (
                        // Card is clickable - use non-interactive elements
                        <img
                            src={account.avatar}
                            alt={account.displayName || account.username}
                            className="w-6 h-6 rounded hover:opacity-80 transition-opacity shrink-0"
                        />
                    ) : onAccountClick ? (
                        // Card not clickable but has onAccountClick - use button
                        <button
                            type="button"
                            onClick={() => onAccountClick(account)}
                            className="shrink-0"
                            aria-label={`${account.displayName || account.username}のプロフィールを表示`}
                        >
                            <img
                                src={account.avatar}
                                alt={account.displayName || account.username}
                                className="w-6 h-6 rounded hover:opacity-80 transition-opacity"
                            />
                        </button>
                    ) : (
                        // No onAccountClick - use external link
                        <a
                            href={account.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0"
                        >
                            <img
                                src={account.avatar}
                                alt={account.displayName || account.username}
                                className="w-6 h-6 rounded"
                            />
                        </a>
                    )}
                    <span className="text-sm">
                        {isCardClickable ? (
                            // Card is clickable - use span with visual hover effect
                            <span className="font-semibold text-slate-100 hover:underline">
                                <DisplayName account={account} />
                            </span>
                        ) : onAccountClick ? (
                            // Card not clickable but has onAccountClick - use button
                            <button
                                type="button"
                                onClick={() => onAccountClick(account)}
                                className="font-semibold text-slate-100 hover:underline"
                                aria-label={`${account.displayName || account.username}のプロフィールを表示`}
                            >
                                <DisplayName account={account} />
                            </button>
                        ) : (
                            // No onAccountClick - use external link
                            <a
                                href={account.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-slate-100 hover:underline"
                            >
                                <DisplayName account={account} />
                            </a>
                        )}
                        <span className="text-slate-400"> さんが{info.label}</span>
                    </span>
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                    {formatDate(notification.createdAt)}
                </span>
            </div>

            {/* Follow notification - show account info */}
            {(notification.type === 'follow' || notification.type === 'follow_request') && (
                <div className="ml-9 p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-start gap-3">
                        {isCardClickable ? (
                            // Card is clickable - use non-interactive img
                            <img
                                src={account.avatar}
                                alt={account.displayName || account.username}
                                className="w-12 h-12 rounded-lg hover:opacity-80 transition-opacity shrink-0"
                            />
                        ) : onAccountClick ? (
                            // Card not clickable but has onAccountClick - use button
                            <button
                                type="button"
                                onClick={() => onAccountClick(account)}
                                className="shrink-0"
                                aria-label={`${account.displayName || account.username}のプロフィールを表示`}
                            >
                                <img
                                    src={account.avatar}
                                    alt={account.displayName || account.username}
                                    className="w-12 h-12 rounded-lg hover:opacity-80 transition-opacity"
                                />
                            </button>
                        ) : (
                            // No onAccountClick - plain img
                            <img
                                src={account.avatar}
                                alt={account.displayName || account.username}
                                className="w-12 h-12 rounded-lg"
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            {isCardClickable ? (
                                // Card is clickable - use span with visual hover effect
                                <span className="font-semibold text-slate-100 truncate text-left w-full hover:underline">
                                    <DisplayName account={account} />
                                </span>
                            ) : onAccountClick ? (
                                // Card not clickable but has onAccountClick - use button
                                <button
                                    type="button"
                                    onClick={() => onAccountClick(account)}
                                    className="font-semibold text-slate-100 truncate text-left w-full hover:underline"
                                    aria-label={`${account.displayName || account.username}のプロフィールを表示`}
                                >
                                    <DisplayName account={account} />
                                </button>
                            ) : (
                                // No onAccountClick - plain DisplayName
                                <DisplayName
                                    account={account}
                                    className="font-semibold text-slate-100 truncate block"
                                />
                            )}
                            <div className="text-sm text-slate-400 truncate">@{account.acct}</div>
                            {account.note && (
                                <div
                                    className="text-sm text-slate-300 mt-1 line-clamp-2 profile-bio"
                                    dangerouslySetInnerHTML={{
                                        __html: replaceEmojisWithImages(
                                            account.note,
                                            account.emojis ?? []
                                        ),
                                    }}
                                />
                            )}
                        </div>
                    </div>
                    {notification.type === 'follow_request' && (
                        <div className="flex gap-2 mt-3 ml-15">
                            <button
                                type="button"
                                className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm transition-colors"
                                aria-label={`${account.displayName || account.username}のフォローリクエストを承認`}
                            >
                                承認
                            </button>
                            <button
                                type="button"
                                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
                                aria-label={`${account.displayName || account.username}のフォローリクエストを拒否`}
                            >
                                拒否
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Status-related notifications */}
            {displayStatus && (
                <div
                    className={`ml-9 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 ${isStatusClickable ? 'cursor-pointer hover:bg-slate-700/50 transition-colors' : ''}`}
                    onClick={isStatusClickable ? handleStatusClick : undefined}
                    onKeyDown={isStatusClickable ? handleStatusKeyDown : undefined}
                    role={isStatusClickable ? 'button' : undefined}
                    tabIndex={isStatusClickable ? 0 : undefined}
                    aria-label={isStatusClickable ? '投稿の詳細を表示' : undefined}
                >
                    {displayStatus.spoilerText ? (
                        <details>
                            <summary className="cursor-pointer text-amber-400 text-sm">
                                <LuTriangleAlert className="inline mr-1" />{' '}
                                {displayStatus.spoilerText}
                            </summary>
                            <div
                                className="mt-2 text-sm text-slate-300 wrap-break-word"
                                dangerouslySetInnerHTML={{
                                    __html: replaceEmojisWithImages(
                                        displayStatus.content,
                                        displayStatus.emojis
                                    ),
                                }}
                            />
                        </details>
                    ) : (
                        <div
                            className="text-sm text-slate-300 wrap-break-word line-clamp-4"
                            dangerouslySetInnerHTML={{
                                __html: replaceEmojisWithImages(
                                    displayStatus.content,
                                    displayStatus.emojis
                                ),
                            }}
                        />
                    )}

                    {/* Media indicator */}
                    {displayStatus.mediaAttachments.length > 0 && (
                        <div className="flex gap-1 mt-2">
                            {displayStatus.mediaAttachments.slice(0, 4).map((media, index) => {
                                const isSensitive = displayStatus.sensitive ?? false;
                                const totalCount = displayStatus.mediaAttachments.length;

                                return (
                                    <MediaAttachment
                                        key={media.id}
                                        media={media}
                                        variant="compact"
                                        isSensitive={isSensitive}
                                        nsfwRevealed={nsfwRevealed}
                                        onNsfwToggle={handleNsfwToggle}
                                        imageIndex={index}
                                        totalImages={totalCount}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}
