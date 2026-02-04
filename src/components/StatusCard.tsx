import { useState, useEffect, useRef, useMemo } from 'react';
import type { mastodon } from 'masto';
import {
    LuRepeat2,
    LuMessageCircle,
    LuStar,
    LuLink,
    LuTriangleAlert,
    LuCornerUpLeft,
} from 'react-icons/lu';
import {
    type AccountSession,
    type MastoClient,
    getClient,
    favouriteStatus,
    unfavouriteStatus,
    reblogStatus,
    unreblogStatus,
} from '../api/mastoClient';
import { formatDate } from '../utils/dateFormat';
import { replaceEmojisWithImages } from '../utils/emoji';
import type { ImageViewerImage } from './ImageViewer';
import { DisplayName } from './DisplayName';

interface StatusCardProps {
    status: mastodon.v1.Status;
    isReblog?: boolean;
    accountSession?: AccountSession; // Required for boost/favorite - uses column's account
    onStatusUpdate?: (updatedStatus: mastodon.v1.Status) => void;
    onReply?: (status: mastodon.v1.Status) => void;
    onStatusClick?: (status: mastodon.v1.Status) => void;
    onImageClick?: (images: ImageViewerImage[], index: number) => void;
    onAccountClick?: (account: mastodon.v1.Account, accountId: string) => void;
}

export function StatusCard({
    status,
    isReblog = false,
    accountSession,
    onStatusUpdate,
    onReply,
    onStatusClick,
    onImageClick,
    onAccountClick,
}: StatusCardProps) {
    // If it's a reblog, show the original status with reblog indicator
    const displayStatus = status.reblog ?? status;
    const reblogger = status.reblog ? status.account : null;

    // Local state for optimistic UI updates
    const [localFavourited, setLocalFavourited] = useState(displayStatus.favourited ?? false);
    const [localFavouritesCount, setLocalFavouritesCount] = useState(
        displayStatus.favouritesCount ?? 0
    );
    const [localReblogged, setLocalReblogged] = useState(displayStatus.reblogged ?? false);
    const [localReblogsCount, setLocalReblogsCount] = useState(displayStatus.reblogsCount ?? 0);
    const [isLoading, setIsLoading] = useState({ favourite: false, reblog: false });

    // Track pending props updates that arrived during loading
    const pendingPropsRef = useRef<{
        favourited: boolean;
        favouritesCount: number;
        reblogged: boolean;
        reblogsCount: number;
    } | null>(null);

    // Sync local state with props when displayStatus changes externally
    // (e.g., from streaming updates or parent re-renders with new data)
    useEffect(() => {
        const newProps = {
            favourited: displayStatus.favourited ?? false,
            favouritesCount: displayStatus.favouritesCount ?? 0,
            reblogged: displayStatus.reblogged ?? false,
            reblogsCount: displayStatus.reblogsCount ?? 0,
        };

        // If currently loading, store the update to apply after completion
        if (isLoading.favourite || isLoading.reblog) {
            pendingPropsRef.current = newProps;
        } else {
            // Apply immediately when not loading
            setLocalFavourited(newProps.favourited);
            setLocalFavouritesCount(newProps.favouritesCount);
            setLocalReblogged(newProps.reblogged);
            setLocalReblogsCount(newProps.reblogsCount);
            pendingPropsRef.current = null;
        }
        // Note: isLoading is intentionally excluded from deps to avoid re-running on loading changes
        // The second useEffect handles applying pending props when loading completes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        displayStatus.id,
        displayStatus.favourited,
        displayStatus.favouritesCount,
        displayStatus.reblogged,
        displayStatus.reblogsCount,
    ]);

    // Apply pending props when loading completes
    useEffect(() => {
        if (!isLoading.favourite && !isLoading.reblog && pendingPropsRef.current) {
            const pending = pendingPropsRef.current;
            setLocalFavourited(pending.favourited);
            setLocalFavouritesCount(pending.favouritesCount);
            setLocalReblogged(pending.reblogged);
            setLocalReblogsCount(pending.reblogsCount);
            pendingPropsRef.current = null;
        }
    }, [isLoading.favourite, isLoading.reblog]);

    // Safely access arrays with fallbacks
    const mediaAttachments = displayStatus.mediaAttachments ?? [];
    const poll = displayStatus.poll;

    // Convert image attachments to ImageViewerImage format (memoized)
    // Use displayStatus.mediaAttachments as dependency for stable reference
    // Filter out images without valid URLs to prevent broken image rendering
    const imageViewerImages = useMemo(() => {
        const attachments = displayStatus.mediaAttachments ?? [];
        return attachments
            .filter((media) => media.type === 'image')
            .slice(0, 4)
            .map((media) => ({
                url: media.url ?? media.previewUrl ?? '',
                previewUrl: media.previewUrl ?? undefined,
                description: media.description ?? undefined,
            }))
            .filter((image) => image.url !== '');
    }, [displayStatus.mediaAttachments]);

    // Safely access account
    const account = displayStatus.account;
    if (!account) {
        return null; // Cannot render without account
    }

    const handleFavourite = async () => {
        if (!accountSession || isLoading.favourite) return;

        setIsLoading((prev) => ({ ...prev, favourite: true }));

        // Optimistic update
        const wasLocalFavourited = localFavourited;
        setLocalFavourited(!wasLocalFavourited);
        setLocalFavouritesCount((prev) => (wasLocalFavourited ? prev - 1 : prev + 1));

        try {
            const client: MastoClient = getClient(accountSession);
            const updatedStatus = wasLocalFavourited
                ? await unfavouriteStatus(client, displayStatus.id)
                : await favouriteStatus(client, displayStatus.id);

            // Update with server response - this is authoritative, clear any pending stale updates
            setLocalFavourited(updatedStatus.favourited ?? false);
            setLocalFavouritesCount(updatedStatus.favouritesCount ?? 0);
            pendingPropsRef.current = null;
            onStatusUpdate?.(updatedStatus);
        } catch (error) {
            // Revert on error
            setLocalFavourited(wasLocalFavourited);
            setLocalFavouritesCount((prev) => (wasLocalFavourited ? prev + 1 : prev - 1));
            console.error('Failed to toggle favourite:', error);
        } finally {
            setIsLoading((prev) => ({ ...prev, favourite: false }));
        }
    };

    const handleReblog = async () => {
        if (!accountSession || isLoading.reblog) return;

        // Don't allow reblogging private or direct messages
        if (displayStatus.visibility === 'private' || displayStatus.visibility === 'direct') {
            return;
        }

        setIsLoading((prev) => ({ ...prev, reblog: true }));

        // Optimistic update
        const wasLocalReblogged = localReblogged;
        setLocalReblogged(!wasLocalReblogged);
        setLocalReblogsCount((prev) => (wasLocalReblogged ? prev - 1 : prev + 1));

        try {
            const client: MastoClient = getClient(accountSession);
            const updatedStatus = wasLocalReblogged
                ? await unreblogStatus(client, displayStatus.id)
                : await reblogStatus(client, displayStatus.id);

            // For reblog, the API returns the reblog wrapper status
            // We need to extract the actual status
            const actualStatus = updatedStatus.reblog ?? updatedStatus;
            setLocalReblogged(actualStatus.reblogged ?? false);
            setLocalReblogsCount(actualStatus.reblogsCount ?? 0);
            pendingPropsRef.current = null;
            onStatusUpdate?.(actualStatus);
        } catch (error) {
            // Revert on error
            setLocalReblogged(wasLocalReblogged);
            setLocalReblogsCount((prev) => (wasLocalReblogged ? prev + 1 : prev - 1));
            console.error('Failed to toggle reblog:', error);
        } finally {
            setIsLoading((prev) => ({ ...prev, reblog: false }));
        }
    };

    // Check if reblog is allowed (not for private/direct messages)
    const canReblog =
        displayStatus.visibility !== 'private' && displayStatus.visibility !== 'direct';

    // Handle card click to open detail modal
    const handleCardClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        // Ignore clicks on interactive elements
        if (
            target.closest('a') ||
            target.closest('button') ||
            target.closest('video') ||
            target.closest('summary')
        ) {
            return;
        }
        openStatusDetail();
    };

    // Handle keyboard navigation for card
    const handleCardKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const target = e.target as HTMLElement;
            // Ignore keyboard events on interactive elements
            if (
                target.closest('a') ||
                target.closest('button') ||
                target.closest('video') ||
                target.closest('summary')
            ) {
                return;
            }
            e.preventDefault();
            openStatusDetail();
        }
    };

    // Open status detail modal
    const openStatusDetail = () => {
        // Always pass displayStatus (the actual content being shown) with local state
        // This ensures consistent handling regardless of reblog status
        const statusWithLocalState: mastodon.v1.Status = {
            ...displayStatus,
            favourited: localFavourited,
            favouritesCount: localFavouritesCount,
            reblogged: localReblogged,
            reblogsCount: localReblogsCount,
        };
        onStatusClick?.(statusWithLocalState);
    };

    return (
        <article
            className={`p-4 border-b border-slate-700/50 card-hover ${onStatusClick ? 'cursor-pointer' : ''} ${isReblog ? 'animate-fade-in' : ''}`}
            onClick={onStatusClick ? handleCardClick : undefined}
            onKeyDown={onStatusClick ? handleCardKeyDown : undefined}
            tabIndex={onStatusClick && !accountSession && !onReply ? 0 : undefined}
            aria-label={
                onStatusClick
                    ? `${account.displayName || account.username}の投稿を詳細表示`
                    : undefined
            }
        >
            {/* Reblog indicator */}
            {reblogger && (
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-2 ml-12">
                    <LuRepeat2 className="text-green-400" aria-hidden="true" />
                    <img src={reblogger.avatar} alt="" className="w-4 h-4 rounded" />
                    <span className="truncate">
                        <DisplayName account={reblogger} /> がブースト
                    </span>
                </div>
            )}

            {/* Reply indicator */}
            {displayStatus.inReplyToId && (
                <div
                    className={`flex items-center gap-2 text-sm text-slate-400 mb-2 ml-12 ${onStatusClick ? 'cursor-pointer hover:text-slate-300' : ''}`}
                    {...(onStatusClick
                        ? {
                              onClick: (e) => {
                                  e.stopPropagation();
                                  openStatusDetail();
                              },
                              role: 'button',
                              tabIndex: 0,
                              onKeyDown: (e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openStatusDetail();
                                  }
                              },
                              'aria-label': 'スレッドを表示',
                          }
                        : {})}
                >
                    <LuCornerUpLeft className="text-blue-400" aria-hidden="true" />
                    <span className="truncate">
                        {(() => {
                            // Find reply target from mentions using inReplyToAccountId
                            const replyToAccountId = displayStatus.inReplyToAccountId;
                            const replyToMention = displayStatus.mentions?.find(
                                (m) => m.id === replyToAccountId
                            );
                            if (replyToMention) {
                                return `@${replyToMention.acct} への返信`;
                            }
                            return '返信';
                        })()}
                    </span>
                </div>
            )}

            <div className="flex gap-3 items-start">
                {/* Avatar */}
                {onAccountClick ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAccountClick(account, accountSession?.id ?? '');
                        }}
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
                    <a
                        href={account.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                    >
                        <img
                            src={account.avatar}
                            alt={account.displayName || account.username}
                            className="w-12 h-12 rounded-lg hover:opacity-80 transition-opacity"
                        />
                    </a>
                )}

                {/* Content */}
                <div className="min-w-0 flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            {onAccountClick ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAccountClick(account, accountSession?.id ?? '');
                                    }}
                                    className="hover:underline text-left min-w-0 max-w-full"
                                    aria-label={`${account.displayName || account.username}のプロフィールを表示`}
                                    type="button"
                                >
                                    <DisplayName
                                        account={account}
                                        className="font-semibold text-slate-100 block truncate"
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
                                        className="font-semibold text-slate-100 block truncate"
                                    />
                                    <span className="text-sm text-slate-400 block truncate">
                                        @{account.acct}
                                    </span>
                                </a>
                            )}
                        </div>
                        <a
                            href={displayStatus.url ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-slate-400 hover:text-slate-300 shrink-0"
                        >
                            {formatDate(displayStatus.createdAt)}
                        </a>
                    </div>

                    {/* Content Warning */}
                    {displayStatus.spoilerText && (
                        <details className="mt-2">
                            <summary className="cursor-pointer text-amber-400 text-sm">
                                <LuTriangleAlert className="inline mr-1" />{' '}
                                {displayStatus.spoilerText}
                            </summary>
                            <div
                                className="mt-2 text-slate-200 wrap-break-word status-content"
                                dangerouslySetInnerHTML={{
                                    __html: replaceEmojisWithImages(
                                        displayStatus.content,
                                        displayStatus.emojis
                                    ),
                                }}
                            />
                        </details>
                    )}

                    {/* Main content */}
                    {!displayStatus.spoilerText && (
                        <div
                            className="mt-2 text-slate-200 wrap-break-word status-content"
                            dangerouslySetInnerHTML={{
                                __html: replaceEmojisWithImages(
                                    displayStatus.content,
                                    displayStatus.emojis
                                ),
                            }}
                        />
                    )}

                    {/* Media attachments - safely check length */}
                    {mediaAttachments.length > 0 && (
                        <div
                            className={`mt-3 grid gap-1 ${
                                mediaAttachments.length === 1
                                    ? 'grid-cols-1'
                                    : mediaAttachments.length >= 2
                                      ? 'grid-cols-2'
                                      : 'grid-cols-2'
                            }`}
                        >
                            {mediaAttachments.slice(0, 4).map((media) => {
                                // For images, use button to open ImageViewer
                                if (media.type === 'image') {
                                    // Skip images without valid URLs (matches imageViewerImages filtering)
                                    const imageUrl = media.url ?? media.previewUrl ?? '';
                                    if (imageUrl === '') {
                                        return null;
                                    }

                                    // Find the index in the filtered imageViewerImages array
                                    const imageIndex = imageViewerImages.findIndex(
                                        (img) => img.url === imageUrl
                                    );
                                    if (imageIndex === -1) {
                                        return null; // Guard against mismatch
                                    }

                                    const accessibleLabel =
                                        media.description ||
                                        `画像を拡大 (${imageIndex + 1}/${imageViewerImages.length})`;

                                    return (
                                        <button
                                            key={media.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onImageClick?.(imageViewerImages, imageIndex);
                                            }}
                                            className="block overflow-hidden rounded-lg text-left"
                                            aria-label={accessibleLabel}
                                        >
                                            <img
                                                src={media.previewUrl ?? media.url ?? ''}
                                                alt={media.description ?? ''}
                                                className="w-full h-36 object-cover hover:opacity-90 transition-opacity"
                                            />
                                        </button>
                                    );
                                }

                                // For video/gifv, keep existing behavior with <a> tag
                                return (
                                    <a
                                        key={media.id}
                                        href={media.url ?? '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block overflow-hidden rounded-lg"
                                    >
                                        {media.type === 'video' && (
                                            <video
                                                src={media.url ?? undefined}
                                                poster={media.previewUrl ?? undefined}
                                                className="w-full h-36 object-cover"
                                                controls
                                            />
                                        )}
                                        {media.type === 'gifv' && (
                                            <video
                                                src={media.url ?? undefined}
                                                className="w-full h-36 object-cover"
                                                autoPlay
                                                loop
                                                muted
                                                playsInline
                                            />
                                        )}
                                    </a>
                                );
                            })}
                        </div>
                    )}

                    {/* Poll - safely check existence and options */}
                    {poll && poll.options && poll.options.length > 0 && (
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                            {poll.options.map((option, i) => {
                                const votesCount = poll.votesCount ?? 0;
                                const percentage =
                                    votesCount > 0
                                        ? Math.round(((option.votesCount ?? 0) / votesCount) * 100)
                                        : 0;
                                return (
                                    <div key={i} className="mb-2 last:mb-0">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>{option.title}</span>
                                            <span className="text-slate-400">{percentage}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-700 rounded overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 transition-all"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="text-xs text-slate-400 mt-2">
                                {poll.votesCount ?? 0}票{poll.expired && ' · 終了'}
                            </div>
                        </div>
                    )}

                    {/* Action bar */}
                    <div className="flex items-center gap-6 mt-3 text-slate-400">
                        <button
                            onClick={() => onReply?.(displayStatus)}
                            className="flex items-center gap-1.5 hover:text-blue-400 transition-colors"
                            aria-label="返信"
                        >
                            <LuMessageCircle aria-hidden="true" />
                            <span className="text-sm">{displayStatus.repliesCount || ''}</span>
                        </button>
                        <button
                            onClick={handleReblog}
                            disabled={!accountSession || isLoading.reblog || !canReblog}
                            tabIndex={!canReblog ? -1 : undefined}
                            className={`flex items-center gap-1.5 transition-colors ${
                                !canReblog
                                    ? 'opacity-50 cursor-not-allowed'
                                    : localReblogged
                                      ? 'text-green-400 hover:text-green-300'
                                      : 'hover:text-green-400'
                            } ${isLoading.reblog ? 'opacity-50' : ''}`}
                            title={!canReblog ? 'この投稿はブーストできません' : undefined}
                            aria-label={localReblogged ? 'ブースト解除' : 'ブースト'}
                            aria-disabled={!canReblog}
                        >
                            <LuRepeat2 aria-hidden="true" />
                            <span className="text-sm">{localReblogsCount || ''}</span>
                        </button>
                        <button
                            onClick={handleFavourite}
                            disabled={!accountSession || isLoading.favourite}
                            className={`flex items-center gap-1.5 transition-colors ${
                                localFavourited
                                    ? 'text-amber-400 hover:text-amber-300'
                                    : 'hover:text-amber-400'
                            } ${isLoading.favourite ? 'opacity-50' : ''}`}
                            aria-label={localFavourited ? 'お気に入り解除' : 'お気に入り'}
                        >
                            <LuStar
                                className={localFavourited ? 'fill-current' : ''}
                                aria-hidden="true"
                            />
                            <span className="text-sm">{localFavouritesCount || ''}</span>
                        </button>
                        <button
                            className="hover:text-indigo-400 transition-colors"
                            aria-label="リンクをコピー"
                        >
                            <LuLink aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
}
