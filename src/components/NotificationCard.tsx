import type { mastodon } from 'masto';
import React, { useMemo, type ReactNode } from 'react';
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
import { getDisplayStatusOrNull } from '../utils/statusView';
import { replaceEmojisWithImages } from '../utils/emoji';
import { useCardInteraction } from '../hooks/useCardInteraction';
import { useNsfwState } from '../hooks/useNsfwState';
import { DisplayName } from './DisplayName';
import { MediaAttachment } from './MediaAttachment';

interface NotificationCardProps {
    notification: mastodon.v1.Notification;
    onStatusClick?: (status: mastodon.v1.Status) => void;
    onAccountClick?: (account: mastodon.v1.Account) => void;
    onNsfwReveal?: (statusId: string) => void;
    isNsfwRevealed?: boolean;
}

export const NotificationCard = React.memo(function NotificationCard({
    notification,
    onStatusClick,
    onAccountClick,
    onNsfwReveal,
    isNsfwRevealed,
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
                return { icon: <LuChartBar />, label: '投票が終了', color: 'text-indigo-400' };
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
    const displayStatus = getDisplayStatusOrNull(status);
    const actionText =
        notification.type === 'poll' ? `${info.label}しました` : `さんが${info.label}しました`;

    // NSFW state with controlled/uncontrolled mode
    const { nsfwRevealed, handleNsfwToggle } = useNsfwState({
        isRevealed: isNsfwRevealed,
        onReveal: onNsfwReveal,
        statusId: displayStatus?.id ?? '',
    });

    // Note: nsfwRevealed state is automatically reset when notification changes
    // because NotificationCard is rendered with key={notification.id} in parent

    // Memoize emoji processing to avoid redundant work on re-renders
    const accountNoteWithEmojis = useMemo(
        () => (account.note ? replaceEmojisWithImages(account.note, account.emojis ?? []) : null),
        [account.note, account.emojis]
    );

    const statusContentWithEmojis = useMemo(
        () =>
            displayStatus
                ? replaceEmojisWithImages(displayStatus.content, displayStatus.emojis)
                : null,
        [displayStatus]
    );

    // Check if status area should be clickable
    const isStatusClickable = Boolean(status && onStatusClick);

    // Check if card itself should be clickable for profile
    // Note: follow_request has action buttons, so card should not be clickable
    const isCardClickable = Boolean(!status && onAccountClick && notification.type === 'follow');

    // Custom selector for NotificationCard (excludes [role="button"] to allow card itself to be clickable)
    const notificationInteractiveSelector =
        'a, button, input, label, select, textarea, video, audio, summary';

    // Card interaction handlers for follow notifications
    const { handleClick: handleCardClick, handleKeyDown: handleCardKeyDown } = useCardInteraction({
        onClick: () => onAccountClick?.(account),
        isEnabled: isCardClickable,
        interactiveSelector: notificationInteractiveSelector,
    });

    // Status area interaction handlers
    const { handleClick: handleStatusClick, handleKeyDown: handleStatusKeyDown } =
        useCardInteraction({
            onClick: () => status && onStatusClick?.(status),
            isEnabled: Boolean(status && onStatusClick),
            interactiveSelector: notificationInteractiveSelector,
        });

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
            <div className="flex items-start gap-3 mb-2">
                <span className={`text-lg ${info.color} mt-0.5`} aria-hidden="true">
                    {info.icon}
                </span>
                <div className="flex items-start gap-2 min-w-0 flex-1">
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
                    <div className="min-w-0 text-sm leading-relaxed">
                        <span>
                            {isCardClickable ? (
                                <span className="font-semibold text-slate-100 hover:underline">
                                    <DisplayName account={account} />
                                </span>
                            ) : onAccountClick ? (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAccountClick(account);
                                    }}
                                    className="inline appearance-none whitespace-normal bg-transparent border-0 p-0 m-0 align-baseline font-semibold text-slate-100 text-left hover:underline cursor-pointer"
                                    aria-label={`${account.displayName || account.username}のプロフィールを表示`}
                                >
                                    <DisplayName account={account} />
                                    <span className="text-slate-400 font-normal">
                                        {' '}
                                        {actionText}
                                    </span>
                                </button>
                            ) : (
                                <>
                                    <a
                                        href={account.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold text-slate-100 hover:underline"
                                    >
                                        <DisplayName account={account} />
                                    </a>
                                    <span className="text-slate-400"> {actionText}</span>
                                </>
                            )}
                            {isCardClickable && (
                                <span className="text-slate-400"> {actionText}</span>
                            )}
                        </span>
                    </div>
                </div>
                <span className="text-xs text-slate-500 shrink-0 whitespace-nowrap">
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
                            {accountNoteWithEmojis && (
                                <div
                                    className="text-sm text-slate-300 mt-1 line-clamp-2 profile-bio"
                                    dangerouslySetInnerHTML={{ __html: accountNoteWithEmojis }}
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
                                    __html: statusContentWithEmojis ?? '',
                                }}
                            />
                        </details>
                    ) : (
                        <div
                            className="text-sm text-slate-300 wrap-break-word line-clamp-4"
                            dangerouslySetInnerHTML={{
                                __html: statusContentWithEmojis ?? '',
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
                                        onNsfwReveal={handleNsfwToggle}
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
});
