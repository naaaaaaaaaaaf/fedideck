import { useState, useEffect, useRef, useMemo } from 'react';
import type { mastodon } from 'masto';
import {
    LuX,
    LuRepeat2,
    LuMessageCircle,
    LuStar,
    LuLink,
    LuTriangleAlert,
    LuLoader,
} from 'react-icons/lu';
import {
    type AccountSession,
    type MastoClient,
    getClient,
    favouriteStatus,
    unfavouriteStatus,
    reblogStatus,
    unreblogStatus,
    getStatusContext,
    type StatusContext,
} from '../api/mastoClient';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { formatDate } from '../utils/dateFormat';
import { replaceEmojisWithImages } from '../utils/emoji';
import type { ImageViewerImage } from './ImageViewer';
import { DisplayName } from './DisplayName';

interface StatusDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    status: mastodon.v1.Status | null;
    accountSession?: AccountSession;
    onReply?: (status: mastodon.v1.Status) => void;
    onStatusUpdate?: (status: mastodon.v1.Status) => void;
    onImageClick?: (images: ImageViewerImage[], index: number) => void;
    // NSFW blur state from parent (optional - for syncing with StatusCard)
    nsfwRevealedStatusIds?: Set<string>;
    onNsfwReveal?: (statusId: string) => void;
}

function formatFullDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
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
    if (!account) return null;

    const maxDepth = 3; // Maximum indentation level
    const indentLevel = Math.min(depth, maxDepth);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!onClick) return;
        // Guard against e.target not being an Element
        if (!(e.target instanceof Element)) return;
        // Don't trigger if clicking on interactive elements
        if (e.target.closest('a, button, video, summary')) return;
        onClick(status);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
            // Guard against e.target not being an Element
            if (!(e.target instanceof Element)) return;
            // Don't trigger if focus is on interactive elements (same as handleClick)
            if (e.target.closest('a, button, video, summary')) return;

            e.preventDefault();
            onClick(status);
        }
    };

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
                        <span className="text-slate-500 text-sm shrink-0">
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
    onImageClick,
    nsfwRevealedStatusIds,
    onNsfwReveal,
}: StatusDetailModalProps) {
    // Thread navigation state
    const [navigatedStatus, setNavigatedStatus] = useState<mastodon.v1.Status | null>(null);

    // Get the display status (navigated > original reblog > original)
    const displayStatus = navigatedStatus ?? status?.reblog ?? status;

    // NSFW state: controlled from parent or local
    // If parent provides state (nsfwRevealedStatusIds), always use it
    // When onNsfwReveal is missing, operates in read-only mode
    const isControlled = nsfwRevealedStatusIds !== undefined;
    const [localNsfwRevealed, setLocalNsfwRevealed] = useState(false);

    // Check if current status is revealed (controlled) or use local state
    const nsfwRevealed = isControlled
        ? displayStatus
            ? nsfwRevealedStatusIds.has(displayStatus.id)
            : false
        : localNsfwRevealed;

    const [localFavourited, setLocalFavourited] = useState(false);
    const [localFavouritesCount, setLocalFavouritesCount] = useState(0);
    const [localReblogged, setLocalReblogged] = useState(false);
    const [localReblogsCount, setLocalReblogsCount] = useState(0);
    const [isLoading, setIsLoading] = useState({ favourite: false, reblog: false });

    // Thread context state
    const [context, setContext] = useState<StatusContext | null>(null);
    const [isLoadingContext, setIsLoadingContext] = useState(false);
    const [contextError, setContextError] = useState<string | null>(null);

    // Refs for focus management
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const mainStatusRef = useRef<HTMLDivElement>(null);

    const { handleKeyDown } = useModalAccessibility({
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

    // Sync local state when status changes or modal opens
    useEffect(() => {
        if (displayStatus && isOpen) {
            setLocalFavourited(displayStatus.favourited ?? false);
            setLocalFavouritesCount(displayStatus.favouritesCount ?? 0);
            setLocalReblogged(displayStatus.reblogged ?? false);
            setLocalReblogsCount(displayStatus.reblogsCount ?? 0);
            // Only reset NSFW state if not controlled by parent
            if (!isControlled) {
                setLocalNsfwRevealed(false);
            }
        }
    }, [displayStatus, isOpen, isControlled]);

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
    const imageViewerImages = useMemo(() => {
        const mediaAttachments = displayStatus?.mediaAttachments ?? [];
        return mediaAttachments
            .filter((media) => media.type === 'image')
            .slice(0, 4)
            .map((media) => ({
                url: media.url ?? media.previewUrl ?? '',
                previewUrl: media.previewUrl ?? undefined,
                description: media.description ?? undefined,
            }))
            .filter((image) => image.url !== '');
    }, [displayStatus?.mediaAttachments]);

    if (!isOpen || !status || !displayStatus) return null;

    const reblogger = navigatedStatus ? null : status.reblog ? status.account : null;
    const account = displayStatus.account;

    if (!account) return null;

    const mediaAttachments = displayStatus.mediaAttachments ?? [];
    const poll = displayStatus.poll;
    const canReblog =
        displayStatus.visibility !== 'private' && displayStatus.visibility !== 'direct';

    const handleThreadNavigate = (clickedStatus: mastodon.v1.Status) => {
        setContext(null);
        setContextError(null);
        setIsLoadingContext(true);
        setNavigatedStatus(clickedStatus);
    };

    const handleFavourite = async () => {
        if (!accountSession || isLoading.favourite) return;

        setIsLoading((prev) => ({ ...prev, favourite: true }));
        const wasLocalFavourited = localFavourited;
        setLocalFavourited(!wasLocalFavourited);
        setLocalFavouritesCount((prev) => (wasLocalFavourited ? prev - 1 : prev + 1));

        try {
            const client: MastoClient = getClient(accountSession);
            const updatedStatus = wasLocalFavourited
                ? await unfavouriteStatus(client, displayStatus.id)
                : await favouriteStatus(client, displayStatus.id);

            setLocalFavourited(updatedStatus.favourited ?? false);
            setLocalFavouritesCount(updatedStatus.favouritesCount ?? 0);
            onStatusUpdate?.(updatedStatus);
        } catch (error) {
            setLocalFavourited(wasLocalFavourited);
            setLocalFavouritesCount((prev) => (wasLocalFavourited ? prev + 1 : prev - 1));
            console.error('Failed to toggle favourite:', error);
        } finally {
            setIsLoading((prev) => ({ ...prev, favourite: false }));
        }
    };

    const handleReblog = async () => {
        if (!accountSession || isLoading.reblog || !canReblog) return;

        setIsLoading((prev) => ({ ...prev, reblog: true }));
        const wasLocalReblogged = localReblogged;
        setLocalReblogged(!wasLocalReblogged);
        setLocalReblogsCount((prev) => (wasLocalReblogged ? prev - 1 : prev + 1));

        try {
            const client: MastoClient = getClient(accountSession);
            const updatedStatus = wasLocalReblogged
                ? await unreblogStatus(client, displayStatus.id)
                : await reblogStatus(client, displayStatus.id);

            const actualStatus = updatedStatus.reblog ?? updatedStatus;
            setLocalReblogged(actualStatus.reblogged ?? false);
            setLocalReblogsCount(actualStatus.reblogsCount ?? 0);
            onStatusUpdate?.(actualStatus);
        } catch (error) {
            setLocalReblogged(wasLocalReblogged);
            setLocalReblogsCount((prev) => (wasLocalReblogged ? prev + 1 : prev - 1));
            console.error('Failed to toggle reblog:', error);
        } finally {
            setIsLoading((prev) => ({ ...prev, reblog: false }));
        }
    };

    const handleNsfwToggle = () => {
        const newValue = !nsfwRevealed;

        // Controlled mode: use parent state
        if (isControlled) {
            // If callback provided, notify parent (read-only mode if no callback)
            if (newValue && onNsfwReveal && displayStatus) {
                onNsfwReveal(displayStatus.id);
            }
            return;
        }

        // Uncontrolled mode: notify parent if callback provided, then toggle local state
        if (newValue && onNsfwReveal && displayStatus) {
            onNsfwReveal(displayStatus.id);
        }
        setLocalNsfwRevealed(newValue);
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
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative w-full max-w-2xl mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden max-h-[90vh] flex flex-col"
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
                            <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                                <LuRepeat2 className="text-green-400" aria-hidden="true" />
                                <img src={reblogger.avatar} alt="" className="w-5 h-5 rounded" />
                                <span>
                                    <DisplayName account={reblogger} /> がブースト
                                </span>
                            </div>
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
                                    // Check if content is sensitive (applies to all media types)
                                    const isSensitive = displayStatus.sensitive ?? false;
                                    const needsBlur = isSensitive && !nsfwRevealed;

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

                                        const accessibleLabel = needsBlur
                                            ? `閲覧注意の画像を表示 (${imageIndex + 1}/${imageViewerImages.length})`
                                            : media.description ||
                                              `画像を拡大 (${imageIndex + 1}/${imageViewerImages.length})`;

                                        return (
                                            <button
                                                type="button"
                                                key={media.id}
                                                onClick={() => {
                                                    if (isSensitive && !nsfwRevealed) {
                                                        handleNsfwToggle();
                                                    } else {
                                                        onImageClick?.(
                                                            imageViewerImages,
                                                            imageIndex
                                                        );
                                                    }
                                                }}
                                                className="block overflow-hidden rounded-xl text-left nsfw-blur-container"
                                                aria-label={accessibleLabel}
                                            >
                                                <img
                                                    src={media.url ?? media.previewUrl ?? ''}
                                                    alt={media.description ?? ''}
                                                    className={`w-full max-h-96 object-contain bg-slate-800 transition-opacity ${
                                                        needsBlur ? 'nsfw-blur' : 'hover:opacity-90'
                                                    }`}
                                                />
                                                {needsBlur && (
                                                    <div className="nsfw-blur-overlay">
                                                        <span className="text-white text-sm font-medium">
                                                            閲覧注意
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    }

                                    // For non-NSFW videos, use <a> tag to open in new tab
                                    if (media.type === 'video' && !needsBlur) {
                                        return (
                                            <a
                                                key={media.id}
                                                href={media.url ?? '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block overflow-hidden rounded-xl"
                                                aria-label={media.description || '動画'}
                                            >
                                                <video
                                                    src={media.url ?? undefined}
                                                    poster={media.previewUrl ?? undefined}
                                                    className="w-full max-h-96 object-contain bg-slate-800"
                                                />
                                            </a>
                                        );
                                    }

                                    // For NSFW videos, use inline video with blur toggle
                                    if (media.type === 'video' && needsBlur) {
                                        return (
                                            <button
                                                type="button"
                                                key={media.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleNsfwToggle();
                                                }}
                                                className="block overflow-hidden rounded-xl text-left nsfw-blur-container"
                                                aria-label="閲覧注意の動画を表示"
                                            >
                                                <video
                                                    src={media.url ?? undefined}
                                                    poster={media.previewUrl ?? undefined}
                                                    className="w-full max-h-96 object-contain bg-slate-800 nsfw-blur"
                                                    aria-hidden="true"
                                                    tabIndex={-1}
                                                />
                                                <div className="nsfw-blur-overlay">
                                                    <span className="text-white text-sm font-medium">
                                                        閲覧注意
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    }

                                    // gifv: use button wrapper for click handling
                                    if (media.type === 'gifv') {
                                        const gifvAccessibleLabel = needsBlur
                                            ? '閲覧注意のGIFを表示'
                                            : media.description || 'GIFアニメーション';

                                        return (
                                            <button
                                                type="button"
                                                key={media.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isSensitive && !nsfwRevealed) {
                                                        handleNsfwToggle();
                                                    } else if (media.url) {
                                                        // For non-NSFW or revealed content, open in new tab
                                                        window.open(
                                                            media.url,
                                                            '_blank',
                                                            'noopener,noreferrer'
                                                        );
                                                    }
                                                }}
                                                className="block overflow-hidden rounded-xl text-left nsfw-blur-container"
                                                aria-label={gifvAccessibleLabel}
                                            >
                                                <video
                                                    src={media.url ?? undefined}
                                                    poster={media.previewUrl ?? undefined}
                                                    className={`w-full max-h-96 object-contain bg-slate-800 ${
                                                        needsBlur ? 'nsfw-blur' : ''
                                                    }`}
                                                    autoPlay={!needsBlur}
                                                    loop={!needsBlur}
                                                    muted
                                                    playsInline
                                                    aria-hidden="true"
                                                    tabIndex={-1}
                                                />
                                                {needsBlur && (
                                                    <div className="nsfw-blur-overlay">
                                                        <span className="text-white text-sm font-medium">
                                                            閲覧注意
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    }

                                    // Unknown media type - skip rendering
                                    return null;
                                })}
                            </div>
                        )}

                        {/* Poll */}
                        {poll && poll.options && poll.options.length > 0 && (
                            <div className="mb-4 p-4 bg-slate-800/50 rounded-xl">
                                {poll.options.map((option, i) => {
                                    const votesCount = poll.votesCount ?? 0;
                                    const percentage =
                                        votesCount > 0
                                            ? Math.round(
                                                  ((option.votesCount ?? 0) / votesCount) * 100
                                              )
                                            : 0;
                                    return (
                                        <div key={i} className="mb-3 last:mb-0">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-slate-200">
                                                    {option.title}
                                                </span>
                                                <span className="text-slate-400">
                                                    {percentage}%
                                                </span>
                                            </div>
                                            <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 transition-all rounded-full"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="text-sm text-slate-400 mt-3 pt-3 border-t border-slate-700">
                                    {poll.votesCount ?? 0}票{poll.expired && ' · 終了'}
                                </div>
                            </div>
                        )}

                        {/* Timestamp */}
                        <div className="text-slate-400 text-sm mb-4 pb-4 border-b border-slate-700">
                            <a
                                href={displayStatus.url ?? '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                            >
                                {formatFullDate(displayStatus.createdAt)}
                            </a>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-6 text-slate-400 text-sm mb-4 pb-4 border-b border-slate-700">
                            <span>
                                <strong className="text-slate-200">{localReblogsCount}</strong>{' '}
                                ブースト
                            </span>
                            <span>
                                <strong className="text-slate-200">{localFavouritesCount}</strong>{' '}
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

                        {/* Action bar */}
                        <div className="flex items-center justify-around text-slate-400">
                            <button
                                onClick={handleReply}
                                className="flex items-center gap-2 px-4 py-2 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                            >
                                <LuMessageCircle className="w-5 h-5" aria-hidden="true" />
                                <span>返信</span>
                            </button>
                            <button
                                onClick={handleReblog}
                                disabled={!accountSession || isLoading.reblog || !canReblog}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                    !canReblog
                                        ? 'opacity-50 cursor-not-allowed'
                                        : localReblogged
                                          ? 'text-green-400 hover:bg-green-400/10'
                                          : 'hover:text-green-400 hover:bg-green-400/10'
                                } ${isLoading.reblog ? 'opacity-50' : ''}`}
                                title={!canReblog ? 'この投稿はブーストできません' : undefined}
                            >
                                <LuRepeat2 className="w-5 h-5" aria-hidden="true" />
                                <span>ブースト</span>
                            </button>
                            <button
                                onClick={handleFavourite}
                                disabled={!accountSession || isLoading.favourite}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                    localFavourited
                                        ? 'text-amber-400 hover:bg-amber-400/10'
                                        : 'hover:text-amber-400 hover:bg-amber-400/10'
                                } ${isLoading.favourite ? 'opacity-50' : ''}`}
                            >
                                <LuStar
                                    className={`w-5 h-5 ${localFavourited ? 'fill-current' : ''}`}
                                    aria-hidden="true"
                                />
                                <span>お気に入り</span>
                            </button>
                            <a
                                href={displayStatus.url ?? '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                            >
                                <LuLink className="w-5 h-5" aria-hidden="true" />
                                <span>リンク</span>
                            </a>
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
