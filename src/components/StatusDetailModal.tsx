import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { mastodon } from 'masto';
import { LuX, LuTriangleAlert, LuLoader, LuRefreshCw } from 'react-icons/lu';
import {
    type AccountSession,
    getClient,
    getStatusContext,
    type StatusContext,
} from '../api/mastoClient';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { useStatusActions } from '../hooks/useStatusActions';
import { useCardInteraction } from '../hooks/useCardInteraction';
import { useNsfwState } from '../hooks/useNsfwState';
import { usePollState } from '../hooks/usePollState';
import { usePollCountdown } from '../hooks/usePollCountdown';
import { formatDate, formatFullDate } from '../utils/dateFormat';
import { getVisibilityMeta } from '../utils/statusVisibility';
import { replaceEmojisWithImages } from '../utils/emoji';
import { firstNonEmpty } from '../utils/firstNonEmpty';
import { getPollVotesDenominator } from '../utils/poll';
import { toVideoViewerVideos } from '../utils/videoAttachments';
import { toAudioViewerTracks } from '../utils/audioAttachments';
import { toImageViewerImages } from '../utils/imageAttachments';
import type { ImageViewerImage } from './ImageViewer';
import type { VideoViewerVideo } from '../types/video';
import type { AudioViewerTrack } from '../types/audio';
import { DisplayName } from './DisplayName';
import { MediaAttachment } from './MediaAttachment';
import { StatusReblogIndicator, StatusActions } from './status';

interface StatusDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    status: mastodon.v1.Status | null;
    accountSession?: AccountSession;
    onReply?: (status: mastodon.v1.Status) => void;
    onStatusUpdate?: (status: mastodon.v1.Status) => void;
    onPollUpdate?: (statusId: string, poll: mastodon.v1.Poll) => void;
    onStatusDelete?: (status: mastodon.v1.Status, accountId: string) => void;
    onStatusEdit?: (status: mastodon.v1.Status, accountSessionId: string) => void;
    onImageClick?: (images: ImageViewerImage[], index: number) => void;
    onVideoClick?: (videos: VideoViewerVideo[], index: number) => void;
    onAudioClick?: (tracks: AudioViewerTrack[], index: number) => void;
    // NSFW blur state from parent (optional - for syncing with StatusCard)
    nsfwRevealedStatusIds?: Set<string>;
    onNsfwReveal?: (statusId: string) => void;
}

// Compact status display for thread ancestors/descendants
interface ThreadItemProps {
    status: mastodon.v1.Status;
    type: 'ancestor' | 'descendant';
    depth?: number;
    onClick?: (status: mastodon.v1.Status) => void;
}

function ThreadItem({ status, type, depth = 0, onClick }: ThreadItemProps) {
    const account = status.account;

    const maxDepth = 3; // Maximum indentation level
    const indentLevel = Math.min(depth, maxDepth);

    // Custom selector for ThreadItem (excludes [role="button"] to allow thread item to be clickable)
    const threadInteractiveSelector =
        'a, button, input, label, select, textarea, video, audio, summary';

    // Card interaction handlers - must be called before early return
    const { handleClick, handleKeyDown } = useCardInteraction({
        onClick: onClick ? () => onClick(status) : undefined,
        isEnabled: !!onClick,
        interactiveSelector: threadInteractiveSelector,
    });

    if (!account) return null;

    // Shared content JSX to avoid duplication
    const sharedContent = (
        <>
            <div className="flex gap-3">
                {/* Thread connector line for descendants */}
                {type === 'descendant' && depth > 0 && (
                    <div
                        className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-700/50"
                        style={{ marginLeft: `${(indentLevel - 1) * 16 + 18}px` }}
                    />
                )}

                {/* Avatar */}
                <a
                    href={account.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                >
                    <img
                        src={account.avatar}
                        alt={account.displayName || account.username}
                        className="w-10 h-10 rounded-lg hover:opacity-80 transition-opacity"
                    />
                </a>

                {/* Content */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <a
                            href={account.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline truncate"
                        >
                            <DisplayName account={account} className="font-medium text-slate-200" />
                            <span className="text-slate-500 ml-1">@{account.acct}</span>
                        </a>
                        <span className="inline-flex items-center gap-1 text-slate-500 text-sm shrink-0">
                            {(() => {
                                const { label: visibilityLabel, icon: VisibilityIcon } =
                                    getVisibilityMeta(status.visibility);
                                return (
                                    <>
                                        <VisibilityIcon
                                            className="w-4 h-4"
                                            aria-hidden="true"
                                            title={visibilityLabel}
                                        />
                                        <span className="sr-only">公開範囲: {visibilityLabel}</span>
                                    </>
                                );
                            })()}
                            {formatDate(status.createdAt)}
                        </span>
                    </div>

                    {/* Content warning */}
                    {status.spoilerText ? (
                        <details className="text-sm">
                            <summary className="cursor-pointer text-amber-400 text-xs">
                                CW: {status.spoilerText}
                            </summary>
                            <div
                                className="text-slate-300 mt-1 status-content text-sm"
                                dangerouslySetInnerHTML={{
                                    __html: replaceEmojisWithImages(status.content, status.emojis),
                                }}
                            />
                        </details>
                    ) : (
                        <div
                            className="text-slate-300 status-content text-sm line-clamp-3"
                            dangerouslySetInnerHTML={{
                                __html: replaceEmojisWithImages(status.content, status.emojis),
                            }}
                        />
                    )}

                    {/* Media indicator */}
                    {status.mediaAttachments && status.mediaAttachments.length > 0 && (
                        <div className="text-slate-500 text-xs mt-1">
                            📎 {status.mediaAttachments.length}件のメディア
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    const baseClassName = `relative py-3 ${type === 'descendant' ? 'border-t border-slate-700/30' : 'border-b border-slate-700/30'}`;
    const baseStyle = { marginLeft: type === 'descendant' ? `${indentLevel * 16}px` : 0 };

    // Use div with role="button" to avoid nesting interactive elements
    // (button cannot contain <a>, <details>, etc. per HTML spec)
    if (onClick) {
        return (
            <div
                className={`${baseClassName} cursor-pointer hover:bg-slate-700/20`}
                style={baseStyle}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={0}
                aria-label={`${account.displayName || account.username}の投稿を表示`}
            >
                {sharedContent}
            </div>
        );
    }

    // Render as div when not clickable
    return (
        <div className={baseClassName} style={baseStyle}>
            {sharedContent}
        </div>
    );
}

export function StatusDetailModal({
    isOpen,
    onClose,
    status,
    accountSession,
    onReply,
    onStatusUpdate,
    onPollUpdate,
    onStatusDelete,
    onStatusEdit,
    onImageClick,
    onVideoClick,
    onAudioClick,
    nsfwRevealedStatusIds,
    onNsfwReveal,
}: StatusDetailModalProps) {
    // Thread navigation state
    const [navigatedStatus, setNavigatedStatus] = useState<mastodon.v1.Status | null>(null);

    // Get the display status (navigated > original reblog > original)
    const displayStatus = navigatedStatus ?? status?.reblog ?? status;

    // Status actions (favourite/reblog) with optimistic UI
    const {
        favourited,
        favouritesCount,
        reblogged,
        reblogsCount,
        isLoading,
        canReblog,
        handleFavourite,
        handleReblog,
    } = useStatusActions({
        status: displayStatus,
        accountSession,
        onStatusUpdate,
    });

    // NSFW state with controlled/uncontrolled mode
    // For controlled mode, check if current status id is in the revealed set
    const { nsfwRevealed, handleNsfwToggle } = useNsfwState({
        isRevealed: nsfwRevealedStatusIds?.has(displayStatus?.id ?? ''),
        onReveal: onNsfwReveal,
        statusId: displayStatus?.id ?? '',
    });

    // Poll state using usePollState hook (with auto-refresh on expiry for modal)
    const {
        localPoll,
        selectedOptions: selectedPollOptions,
        pollLoading,
        pollRefreshing,
        canVote,
        canRefresh,
        handleOptionToggle: handlePollOptionToggle,
        handleVote: handlePollVote,
        handleRefresh: handlePollRefresh,
    } = usePollState({
        poll: displayStatus?.poll ?? null,
        statusId: displayStatus?.id ?? '',
        accountSession: accountSession ?? null,
        onPollUpdate,
        autoRefreshOnExpiry: true,
    });

    // Poll countdown display
    const pollCountdown = usePollCountdown(localPoll?.expiresAt ?? null);

    // Thread context state
    const [context, setContext] = useState<StatusContext | null>(null);
    const [isLoadingContext, setIsLoadingContext] = useState(false);
    const [contextError, setContextError] = useState<string | null>(null);

    // Refs for focus management
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const mainStatusRef = useRef<HTMLDivElement>(null);

    const { handleKeyDown, handleBackdropClick } = useModalAccessibility({
        isOpen,
        onClose,
        closeButtonRef,
        modalRef,
    });

    // Reset navigation and context state when modal closes or the base status changes
    useEffect(() => {
        setNavigatedStatus(null);
        setContext(null);
        setContextError(null);
        setIsLoadingContext(false);
    }, [status?.id, isOpen]);

    // Extract status ID for dependency array
    const statusId = displayStatus?.id;

    // Fetch thread context when modal opens
    useEffect(() => {
        if (!isOpen || !statusId || !accountSession) {
            setContext(null);
            setContextError(null);
            setIsLoadingContext(false);
            return;
        }

        let cancelled = false;

        const fetchContext = async () => {
            setIsLoadingContext(true);
            setContextError(null);

            try {
                const client = getClient(accountSession);
                const ctx = await getStatusContext(client, statusId);
                if (!cancelled) {
                    setContext(ctx);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to fetch thread context:', error);
                    setContextError('スレッドの読み込みに失敗しました');
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingContext(false);
                }
            }
        };

        fetchContext();

        return () => {
            cancelled = true;
        };
    }, [isOpen, statusId, accountSession]);

    // Scroll to main status after context loads (only when there's thread UI)
    useEffect(() => {
        // Only scroll if there are ancestors or descendants to show
        const hasThreadUI =
            context && (context.ancestors.length > 0 || context.descendants.length > 0);

        if (hasThreadUI && mainStatusRef.current) {
            // Small delay to ensure DOM is updated
            const timeoutId = setTimeout(() => {
                // Check if scrollIntoView is available (may be undefined in test environments)
                if (typeof mainStatusRef.current?.scrollIntoView !== 'function') {
                    return;
                }

                // Respect user's motion preferences (with feature detection for test environments)
                const prefersReducedMotion =
                    typeof window !== 'undefined' &&
                    typeof window.matchMedia === 'function' &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

                mainStatusRef.current.scrollIntoView({
                    behavior: prefersReducedMotion ? 'auto' : 'smooth',
                    block: 'center',
                });
            }, 100);

            return () => {
                clearTimeout(timeoutId);
            };
        }
    }, [context]);

    // Convert image attachments to ImageViewerImage format (memoized)
    // Must be before early return to maintain hooks order
    // Filter out images without valid URLs to prevent broken image rendering
    const imageViewerImages = useMemo(
        () => toImageViewerImages(displayStatus?.mediaAttachments),
        [displayStatus?.mediaAttachments]
    );

    // Convert video/gifv attachments to VideoViewerVideo format (memoized)
    const videoViewerVideos = useMemo(
        () => toVideoViewerVideos(displayStatus?.mediaAttachments),
        [displayStatus?.mediaAttachments]
    );

    // Convert audio attachments to AudioViewerTrack format (memoized)
    const audioViewerTracks = useMemo(
        () => toAudioViewerTracks(displayStatus?.mediaAttachments),
        [displayStatus?.mediaAttachments]
    );

    // Check if current user can delete this status (must be before early return)
    const canDelete =
        accountSession && displayStatus && accountSession.account.id === displayStatus.account.id;

    // Check if current user can edit this status (must be before early return)
    const canEdit =
        accountSession && displayStatus && accountSession.account.id === displayStatus.account.id;

    // Handle status delete (must be before early return due to useCallback)
    const handleStatusDelete = useCallback(() => {
        if (!displayStatus || !accountSession || !canDelete) return;
        onStatusDelete?.(displayStatus, accountSession.id);
        onClose();
    }, [displayStatus, accountSession, canDelete, onStatusDelete, onClose]);

    // Handle status edit (must be before early return due to useCallback)
    const handleStatusEdit = useCallback(() => {
        if (!displayStatus || !accountSession || !canEdit) return;
        onStatusEdit?.(displayStatus, accountSession.id);
        onClose();
    }, [displayStatus, accountSession, canEdit, onStatusEdit, onClose]);

    if (!isOpen || !status || !displayStatus) return null;

    const reblogger = navigatedStatus ? null : status.reblog ? status.account : null;
    const account = displayStatus.account;

    if (!account) return null;

    const mediaAttachments = displayStatus.mediaAttachments ?? [];

    const handleThreadNavigate = (clickedStatus: mastodon.v1.Status) => {
        setContext(null);
        setContextError(null);
        setIsLoadingContext(true);
        setNavigatedStatus(clickedStatus);
    };

    const handleReply = () => {
        onReply?.(displayStatus);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-detail-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleBackdropClick}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative w-full max-w-2xl mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-visible max-h-[90vh] flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
                    <h2 id="status-detail-title" className="text-lg font-semibold text-slate-100">
                        投稿の詳細
                    </h2>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                        aria-label="閉じる"
                    >
                        <LuX className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {/* Loading indicator for thread context */}
                    {isLoadingContext && (
                        <div className="flex items-center justify-center py-4 text-slate-400">
                            <LuLoader className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />
                            <span>スレッドを読み込み中...</span>
                        </div>
                    )}

                    {/* Error message */}
                    {contextError && (
                        <div className="text-center py-2 text-slate-500 text-sm mb-4">
                            {contextError}
                        </div>
                    )}

                    {/* Ancestors (parent posts) */}
                    {context && context.ancestors.length > 0 && (
                        <div className="mb-4 pb-2">
                            <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                                このスレッドの上の投稿
                            </div>
                            {context.ancestors.map((ancestor) => (
                                <ThreadItem
                                    key={ancestor.id}
                                    status={ancestor}
                                    type="ancestor"
                                    onClick={handleThreadNavigate}
                                />
                            ))}
                        </div>
                    )}

                    {/* Main status - highlighted */}
                    <div
                        ref={mainStatusRef}
                        className={`${context && (context.ancestors.length > 0 || context.descendants.length > 0) ? 'bg-slate-800/50 rounded-xl p-4 -mx-2 ring-2 ring-indigo-500/30' : ''}`}
                    >
                        {/* Reblog indicator */}
                        {reblogger && (
                            <StatusReblogIndicator reblogger={reblogger} variant="detail" />
                        )}

                        {/* Author info */}
                        <div className="flex items-start gap-3 mb-4">
                            <a
                                href={account.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0"
                            >
                                <img
                                    src={account.avatar}
                                    alt={account.displayName || account.username}
                                    className="w-14 h-14 rounded-xl hover:opacity-80 transition-opacity"
                                />
                            </a>
                            <div className="min-w-0 flex-1">
                                <a
                                    href={account.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                >
                                    <DisplayName
                                        account={account}
                                        className="font-semibold text-lg text-slate-100 block"
                                    />
                                    <span className="text-slate-400 block">@{account.acct}</span>
                                </a>
                            </div>
                        </div>

                        {/* Content Warning */}
                        {displayStatus.spoilerText && (
                            <details className="mb-4" open>
                                <summary className="cursor-pointer text-amber-400 mb-2">
                                    <LuTriangleAlert className="inline mr-1" aria-hidden="true" />{' '}
                                    {displayStatus.spoilerText}
                                </summary>
                                <div
                                    className="text-slate-200 text-lg leading-relaxed status-content"
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
                                className="text-slate-200 text-lg leading-relaxed mb-4 status-content"
                                dangerouslySetInnerHTML={{
                                    __html: replaceEmojisWithImages(
                                        displayStatus.content,
                                        displayStatus.emojis
                                    ),
                                }}
                            />
                        )}

                        {/* Media attachments - larger display */}
                        {mediaAttachments.length > 0 && (
                            <div
                                className={`mb-4 grid gap-2 ${mediaAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
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
                                            variant="detail"
                                            isSensitive={isSensitive}
                                            nsfwRevealed={nsfwRevealed}
                                            onNsfwReveal={handleNsfwToggle}
                                            onImageClick={
                                                imageIndex !== undefined && imageIndex !== -1
                                                    ? () =>
                                                          onImageClick?.(
                                                              imageViewerImages,
                                                              imageIndex
                                                          )
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
                                                    ? () =>
                                                          onVideoClick(
                                                              videoViewerVideos,
                                                              videoIndex
                                                          )
                                                    : undefined
                                            }
                                            onAudioClick={
                                                audioIndex !== undefined &&
                                                audioIndex !== -1 &&
                                                onAudioClick
                                                    ? () =>
                                                          onAudioClick(
                                                              audioViewerTracks,
                                                              audioIndex
                                                          )
                                                    : undefined
                                            }
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {/* Poll */}
                        {localPoll &&
                            localPoll.options &&
                            localPoll.options.length > 0 &&
                            (() => {
                                return (
                                    <fieldset className="mb-4 p-4 bg-slate-800/50 rounded-xl">
                                        <legend className="sr-only">投票</legend>
                                        {canVote ? (
                                            // Voting UI
                                            <>
                                                {localPoll.options.map((option, i) => (
                                                    <label
                                                        key={`${localPoll.id}-${i}`}
                                                        className="flex items-center gap-3 mb-3 last:mb-0 cursor-pointer hover:bg-slate-700/30 p-2 rounded-lg"
                                                    >
                                                        <input
                                                            type={
                                                                localPoll.multiple
                                                                    ? 'checkbox'
                                                                    : 'radio'
                                                            }
                                                            name={`poll-${localPoll.id}`}
                                                            checked={selectedPollOptions.has(i)}
                                                            onChange={() =>
                                                                handlePollOptionToggle(i)
                                                            }
                                                            disabled={pollLoading}
                                                            className="w-4 h-4 accent-indigo-500"
                                                        />
                                                        <span className="text-slate-200">
                                                            {option.title}
                                                        </span>
                                                    </label>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={handlePollVote}
                                                    disabled={
                                                        selectedPollOptions.size === 0 ||
                                                        pollLoading
                                                    }
                                                    aria-busy={pollLoading}
                                                    className={`mt-3 px-4 py-2 text-sm rounded-lg transition-colors ${
                                                        selectedPollOptions.size === 0 ||
                                                        pollLoading
                                                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                                    }`}
                                                >
                                                    {pollLoading ? '投票中...' : '投票'}
                                                </button>
                                            </>
                                        ) : (
                                            // Results UI
                                            <>
                                                {localPoll.options.map((option, i) => {
                                                    const votesCount =
                                                        getPollVotesDenominator(localPoll);
                                                    const percentage =
                                                        votesCount > 0
                                                            ? Math.round(
                                                                  ((option.votesCount ?? 0) /
                                                                      votesCount) *
                                                                      100
                                                              )
                                                            : 0;
                                                    const isOwnVote =
                                                        localPoll.ownVotes?.includes(i) ?? false;
                                                    return (
                                                        <div
                                                            key={`${localPoll.id}-${i}`}
                                                            className="mb-3 last:mb-0"
                                                        >
                                                            <div className="flex justify-between text-sm mb-1">
                                                                <span className="text-slate-200">
                                                                    {isOwnVote && (
                                                                        <span className="text-indigo-400 mr-1">
                                                                            ✓
                                                                        </span>
                                                                    )}
                                                                    {option.title}
                                                                </span>
                                                                <span className="text-slate-400">
                                                                    {percentage}%
                                                                </span>
                                                            </div>
                                                            <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full transition-all rounded-full ${
                                                                        isOwnVote
                                                                            ? 'bg-indigo-400'
                                                                            : 'bg-indigo-500'
                                                                    }`}
                                                                    style={{
                                                                        width: `${percentage}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div className="text-sm text-slate-400 mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
                                                    <span>
                                                        {getPollVotesDenominator(localPoll)}票
                                                        {localPoll.expired
                                                            ? ' · 終了'
                                                            : pollCountdown && (
                                                                  <span> · {pollCountdown}</span>
                                                              )}
                                                    </span>
                                                    {!localPoll.expired && (
                                                        <button
                                                            type="button"
                                                            onClick={handlePollRefresh}
                                                            disabled={!canRefresh || pollRefreshing}
                                                            className="text-indigo-400 hover:text-indigo-300 disabled:opacity-50 inline-flex items-center gap-1"
                                                            aria-label="投票結果を更新"
                                                        >
                                                            <LuRefreshCw
                                                                className={`w-3.5 h-3.5 ${pollRefreshing ? 'animate-spin' : ''}`}
                                                                aria-hidden="true"
                                                            />
                                                            {pollRefreshing ? '更新中...' : '更新'}
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </fieldset>
                                );
                            })()}

                        {/* Timestamp and visibility */}
                        <div className="text-slate-400 text-sm mb-4 pb-4 border-b border-slate-700">
                            {(() => {
                                const fullDateText = formatFullDate(displayStatus.createdAt);
                                const { label: visibilityLabel, icon: VisibilityIcon } =
                                    getVisibilityMeta(displayStatus.visibility);
                                return (
                                    <a
                                        href={displayStatus.url ?? '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 hover:underline"
                                        aria-label={`公開範囲: ${visibilityLabel}、投稿日時: ${fullDateText}`}
                                        title={`公開範囲: ${visibilityLabel}`}
                                    >
                                        <VisibilityIcon className="w-4 h-4" aria-hidden="true" />
                                        <span>{fullDateText}</span>
                                    </a>
                                );
                            })()}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-6 text-slate-400 text-sm mb-4 pb-4 border-b border-slate-700">
                            <span>
                                <strong className="text-slate-200">{reblogsCount}</strong> ブースト
                            </span>
                            <span>
                                <strong className="text-slate-200">{favouritesCount}</strong>{' '}
                                お気に入り
                            </span>
                            {displayStatus.repliesCount > 0 && (
                                <span>
                                    <strong className="text-slate-200">
                                        {displayStatus.repliesCount}
                                    </strong>{' '}
                                    返信
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Descendants (replies) */}
                    {context && context.descendants.length > 0 && (
                        <DescendantsThread
                            descendants={context.descendants}
                            onThreadNavigate={handleThreadNavigate}
                        />
                    )}
                </div>

                {/* Action bar - outside scroll container to allow menu overflow */}
                {displayStatus && (
                    <StatusActions
                        repliesCount={displayStatus.repliesCount ?? 0}
                        reblogsCount={reblogsCount ?? 0}
                        favouritesCount={favouritesCount ?? 0}
                        favourited={favourited}
                        reblogged={reblogged}
                        canReblog={canReblog}
                        isLoading={isLoading}
                        onReply={handleReply}
                        onReblog={handleReblog}
                        onFavourite={handleFavourite}
                        variant="detail"
                        statusUrl={displayStatus.url ?? displayStatus.uri}
                        canDelete={canDelete ?? false}
                        canEdit={canEdit ?? false}
                        onDelete={handleStatusDelete}
                        onEdit={handleStatusEdit}
                    />
                )}
            </div>
        </div>
    );
}

// Memoized component for rendering descendant replies with computed depths
interface DescendantsThreadProps {
    descendants: mastodon.v1.Status[];
    onThreadNavigate: (status: mastodon.v1.Status) => void;
}

function DescendantsThread({ descendants, onThreadNavigate }: DescendantsThreadProps) {
    // Memoize depth calculation to avoid recalculating on every render
    const threadItems = useMemo(() => calculateThreadDepths(descendants), [descendants]);

    return (
        <div className="mt-4 pt-2">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                返信 ({descendants.length})
            </div>
            {threadItems.map((item) => (
                <ThreadItem
                    key={item.status.id}
                    status={item.status}
                    type="descendant"
                    depth={item.depth}
                    onClick={onThreadNavigate}
                />
            ))}
        </div>
    );
}

// Calculate nesting depth for each descendant reply in a flat array.
// Uses memoization and iterative lookup to handle replies in any order.
interface ThreadDepthItem {
    status: mastodon.v1.Status;
    depth: number;
}

function calculateThreadDepths(descendants: mastodon.v1.Status[]): ThreadDepthItem[] {
    // Build id -> status map for O(1) lookup
    const statusMap = new Map<string, mastodon.v1.Status>();
    for (const status of descendants) {
        statusMap.set(status.id, status);
    }

    // Maximum depth to prevent excessive nesting
    const MAX_DEPTH = 10;

    // Memoized depth calculation using iterative approach (no recursion)
    const depthCache = new Map<string, number>();

    function calculateDepth(statusId: string): number {
        if (depthCache.has(statusId)) {
            return depthCache.get(statusId)!;
        }

        // Track visited nodes to detect circular references
        const visited = new Set<string>();
        let currentId: string | null = statusId;
        let depth = 0;

        // Walk up the parent chain iteratively (no recursion)
        while (currentId && depth < MAX_DEPTH) {
            // Circular reference detected
            if (visited.has(currentId)) {
                depthCache.set(statusId, 0);
                return 0;
            }

            // Check if we already computed this node's depth
            if (depthCache.has(currentId)) {
                const cachedDepth = depthCache.get(currentId)!;
                const finalDepth = Math.min(cachedDepth + depth, MAX_DEPTH);
                depthCache.set(statusId, finalDepth);
                return finalDepth;
            }

            visited.add(currentId);
            const status = statusMap.get(currentId);

            if (!status || !status.inReplyToId) {
                // Reached root level
                const finalDepth = Math.min(depth, MAX_DEPTH);
                depthCache.set(statusId, finalDepth);
                return finalDepth;
            }

            // Parent not in descendants (e.g., it's the main status)
            if (!statusMap.has(status.inReplyToId)) {
                const finalDepth = Math.min(depth, MAX_DEPTH);
                depthCache.set(statusId, finalDepth);
                return finalDepth;
            }

            // Move to parent and increment depth
            currentId = status.inReplyToId;
            depth++;
        }

        // Reached max depth
        depthCache.set(statusId, MAX_DEPTH);
        return MAX_DEPTH;
    }

    // Calculate depth for all statuses and build result
    const result: ThreadDepthItem[] = descendants.map((status) => ({
        status,
        depth: calculateDepth(status.id),
    }));

    return result;
}
