import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { mastodon } from 'masto';
import {
    LuRepeat2,
    LuMessageCircle,
    LuStar,
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
import { getVisibilityMeta } from '../utils/statusVisibility';
import { replaceEmojisWithImages } from '../utils/emoji';
import { firstNonEmpty } from '../utils/firstNonEmpty';
import { toVideoViewerVideos } from '../utils/videoAttachments';
import { toAudioViewerTracks } from '../utils/audioAttachments';
import type { ImageViewerImage } from './ImageViewer';
import type { VideoViewerVideo } from '../types/video';
import type { AudioViewerTrack } from '../types/audio';
import { DisplayName } from './DisplayName';
import { MediaAttachment } from './MediaAttachment';
import { StatusMenu } from './StatusMenu';

interface StatusCardProps {
    status: mastodon.v1.Status;
    isReblog?: boolean;
    accountSession?: AccountSession; // Required for boost/favorite - uses column's account
    onStatusUpdate?: (updatedStatus: mastodon.v1.Status) => void;
    onReply?: (status: mastodon.v1.Status) => void;
    onStatusClick?: (status: mastodon.v1.Status) => void;
    onImageClick?: (images: ImageViewerImage[], index: number) => void;
    onVideoClick?: (videos: VideoViewerVideo[], index: number) => void;
    onAudioClick?: (tracks: AudioViewerTrack[], index: number) => void;
    onAccountClick?: (account: mastodon.v1.Account, accountSessionId: string | undefined) => void;
    onNsfwReveal?: (statusId: string) => void;
    isNsfwRevealed?: boolean;
    onStatusDelete?: (status: mastodon.v1.Status) => void;
    onStatusEdit?: (status: mastodon.v1.Status) => void;
}

export const StatusCard = React.memo(function StatusCard({
    status,
    isReblog = false,
    accountSession,
    onStatusUpdate,
    onReply,
    onStatusClick,
    onImageClick,
    onVideoClick,
    onAudioClick,
    onAccountClick,
    onNsfwReveal,
    isNsfwRevealed = false,
    onStatusDelete,
    onStatusEdit,
}: StatusCardProps) {
    // Common action button base styles (WCAG 36px touch target)
    const actionButtonBase =
        'inline-flex min-h-[36px] items-center justify-center gap-2 rounded-lg px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 disabled:opacity-50 disabled:cursor-not-allowed';

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

    // NSFW state:
    // - onNsfwReveal provided: controlled mode, uses isNsfwRevealed from parent
    // - onNsfwReveal missing: uncontrolled mode, toggles local state
    const [localNsfwRevealed, setLocalNsfwRevealed] = useState(false);
    const nsfwRevealed = onNsfwReveal !== undefined ? isNsfwRevealed : localNsfwRevealed;

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

    // Note: nsfwRevealed state is automatically reset when status changes
    // because StatusCard is rendered with key={status.id} in parent

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
                url: firstNonEmpty(media.url, media.previewUrl),
                previewUrl: media.previewUrl ?? undefined,
                description: media.description ?? undefined,
            }))
            .filter((image) => image.url !== '');
    }, [displayStatus.mediaAttachments]);

    // Convert video/gifv attachments to VideoViewerVideo format (memoized)
    const videoViewerVideos = useMemo(
        () => toVideoViewerVideos(displayStatus.mediaAttachments),
        [displayStatus.mediaAttachments]
    );

    // Convert audio attachments to AudioViewerTrack format (memoized)
    const audioViewerTracks = useMemo(
        () => toAudioViewerTracks(displayStatus.mediaAttachments),
        [displayStatus.mediaAttachments]
    );

    // Memoize emoji processing for content to avoid redundant work on re-renders
    const contentWithEmojis = useMemo(
        () => replaceEmojisWithImages(displayStatus.content, displayStatus.emojis),
        [displayStatus.content, displayStatus.emojis]
    );

    // Safely access account
    const account = displayStatus.account;

    // Use ref to track nsfwRevealed state without causing callback recreation
    const nsfwRevealedRef = useRef(nsfwRevealed);
    useEffect(() => {
        nsfwRevealedRef.current = nsfwRevealed;
    }, [nsfwRevealed]);

    // NSFW toggle handler - must be defined before early return to follow hooks rules
    const handleNsfwToggle = useCallback(() => {
        // Controlled mode: parent provides the state via isNsfwRevealed
        if (onNsfwReveal) {
            if (!nsfwRevealedRef.current) {
                onNsfwReveal(displayStatus.id);
            }
            return;
        }

        // Uncontrolled mode: toggle local state
        setLocalNsfwRevealed((prev) => !prev);
    }, [onNsfwReveal, displayStatus.id]);

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
            target.closest('audio') ||
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
                target.closest('audio') ||
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
                {onAccountClick && accountSession ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAccountClick(account, accountSession.id);
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
                            {onAccountClick && accountSession ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAccountClick(account, accountSession.id);
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
                        {(() => {
                            const createdAtText = formatDate(displayStatus.createdAt);
                            const { label: visibilityLabel, icon: VisibilityIcon } =
                                getVisibilityMeta(displayStatus.visibility);
                            return (
                                <a
                                    href={displayStatus.url ?? '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300 shrink-0"
                                    aria-label={`公開範囲: ${visibilityLabel}、投稿日時: ${createdAtText}`}
                                    title={`公開範囲: ${visibilityLabel}`}
                                >
                                    <VisibilityIcon className="w-4 h-4" aria-hidden="true" />
                                    <span>{createdAtText}</span>
                                </a>
                            );
                        })()}
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
                                dangerouslySetInnerHTML={{ __html: contentWithEmojis }}
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
                                const isSensitive = displayStatus.sensitive ?? false;
                                const imageIndex =
                                    media.type === 'image'
                                        ? imageViewerImages.findIndex(
                                              (img) =>
                                                  img.url ===
                                                  firstNonEmpty(media.url, media.previewUrl)
                                          )
                                        : undefined;
                                const videoIndex =
                                    media.type === 'video' || media.type === 'gifv'
                                        ? videoViewerVideos.findIndex(
                                              (v) => v.url === firstNonEmpty(media.url)
                                          )
                                        : undefined;
                                const audioIndex =
                                    media.type === 'audio'
                                        ? audioViewerTracks.findIndex(
                                              (t) =>
                                                  t.url ===
                                                  firstNonEmpty(media.url, media.remoteUrl)
                                          )
                                        : undefined;

                                return (
                                    <MediaAttachment
                                        key={media.id}
                                        media={media}
                                        variant="card"
                                        isSensitive={isSensitive}
                                        nsfwRevealed={nsfwRevealed}
                                        onNsfwReveal={handleNsfwToggle}
                                        onImageClick={
                                            imageIndex !== undefined && imageIndex !== -1
                                                ? () =>
                                                      onImageClick?.(imageViewerImages, imageIndex)
                                                : undefined
                                        }
                                        imageIndex={
                                            imageIndex !== undefined && imageIndex !== -1
                                                ? imageIndex
                                                : undefined
                                        }
                                        totalImages={imageViewerImages.length}
                                        onVideoClick={
                                            videoIndex !== undefined &&
                                            videoIndex !== -1 &&
                                            onVideoClick
                                                ? () => onVideoClick(videoViewerVideos, videoIndex)
                                                : undefined
                                        }
                                        onAudioClick={
                                            audioIndex !== undefined &&
                                            audioIndex !== -1 &&
                                            onAudioClick
                                                ? () => onAudioClick(audioViewerTracks, audioIndex)
                                                : undefined
                                        }
                                    />
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
                    <div className="flex items-center gap-2 mt-1 text-slate-400">
                        <button
                            type="button"
                            onClick={() => onReply?.(displayStatus)}
                            disabled={!onReply}
                            className={`${actionButtonBase} ${
                                !onReply
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:text-blue-400 hover:bg-blue-400/10'
                            }`}
                            aria-label="返信"
                        >
                            <LuMessageCircle className="w-4 h-4" aria-hidden="true" />
                            {(displayStatus.repliesCount ?? 0) > 0 && (
                                <span className="text-sm">{displayStatus.repliesCount}</span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleReblog}
                            disabled={!accountSession || isLoading.reblog || !canReblog}
                            tabIndex={!canReblog ? -1 : undefined}
                            className={`${actionButtonBase} ${
                                !canReblog
                                    ? 'opacity-50 cursor-not-allowed'
                                    : localReblogged
                                      ? 'text-green-400 hover:text-green-300 hover:bg-green-400/10'
                                      : 'hover:text-green-400 hover:bg-green-400/10'
                            } ${isLoading.reblog ? 'opacity-50' : ''}`}
                            title={!canReblog ? 'この投稿はブーストできません' : undefined}
                            aria-label={localReblogged ? 'ブースト解除' : 'ブースト'}
                            aria-disabled={!canReblog}
                        >
                            <LuRepeat2 className="w-4 h-4" aria-hidden="true" />
                            {(localReblogsCount ?? 0) > 0 && (
                                <span className="text-sm">{localReblogsCount}</span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleFavourite}
                            disabled={!accountSession || isLoading.favourite}
                            className={`${actionButtonBase} ${
                                localFavourited
                                    ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10'
                                    : 'hover:text-amber-400 hover:bg-amber-400/10'
                            } ${isLoading.favourite ? 'opacity-50' : ''}`}
                            aria-label={localFavourited ? 'お気に入り解除' : 'お気に入り'}
                        >
                            <LuStar
                                className={`w-4 h-4 ${localFavourited ? 'fill-current' : ''}`}
                                aria-hidden="true"
                            />
                            {(localFavouritesCount ?? 0) > 0 && (
                                <span className="text-sm">{localFavouritesCount}</span>
                            )}
                        </button>
                        <StatusMenu
                            statusUrl={displayStatus.url ?? displayStatus.uri}
                            canDelete={
                                Boolean(accountSession) &&
                                Boolean(onStatusDelete) &&
                                displayStatus.account.id === accountSession?.account.id
                            }
                            canEdit={
                                Boolean(accountSession) &&
                                Boolean(onStatusEdit) &&
                                displayStatus.account.id === accountSession?.account.id
                            }
                            onDelete={() => onStatusDelete?.(displayStatus)}
                            onEdit={() => onStatusEdit?.(displayStatus)}
                            className="ml-auto"
                        />
                    </div>
                </div>
            </div>
        </article>
    );
});
