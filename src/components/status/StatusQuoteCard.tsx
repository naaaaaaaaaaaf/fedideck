import React, { useEffect, useMemo, useState } from 'react';
import type { mastodon } from 'masto';
import { LuChartBar } from 'react-icons/lu';
import { formatDate } from '../../utils/dateFormat';
import { DisplayName } from '../DisplayName';
import { StatusBody } from './StatusBody';
import { toImageViewerImages } from '../../utils/imageAttachments';
import { toVideoViewerVideos } from '../../utils/videoAttachments';
import { toAudioViewerTracks } from '../../utils/audioAttachments';
import type { ImageViewerImage } from '../ImageViewer';
import type { VideoViewerVideo } from '../../types/video';
import type { AudioViewerTrack } from '../../types/audio';
import { hasQuote, getQuotedStatus, isFullQuote } from '../../utils/statusView';
import { StatusQuotePlaceholder } from './StatusQuotePlaceholder';
import { type AccountSession, fetchStatus, getClient } from '../../api/mastoClient';

interface StatusQuoteCardProps {
    /** The quoted status to display */
    status: mastodon.v1.Status;
    /** Size variant for styling */
    variant?: 'card' | 'detail';
    /** Click handler for navigating to quoted status */
    onClick?: (status: mastodon.v1.Status) => void;
    /** Image click handler */
    onImageClick?: (images: ImageViewerImage[], index: number) => void;
    /** Video click handler */
    onVideoClick?: (videos: VideoViewerVideo[], index: number) => void;
    /** Audio click handler */
    onAudioClick?: (tracks: AudioViewerTrack[], index: number) => void;
    /** Nesting depth for recursive quote display (default: 0, max: 2) */
    depth?: number;
    /** Account session for resolving shallow quote chains */
    accountSession?: AccountSession;
    /** Set of visited status IDs to prevent circular reference rendering */
    visitedIds?: Set<string>;
}

/** Maximum nesting depth for quote cards to prevent infinite recursion */
const MAX_QUOTE_DEPTH = 2;

/**
 * Displays a quoted status within a status card.
 * Used for quote posts (引用投稿) to show the original status.
 */
export const StatusQuoteCard = React.memo(function StatusQuoteCard({
    status,
    variant = 'card',
    onClick,
    onImageClick,
    onVideoClick,
    onAudioClick,
    depth = 0,
    accountSession,
    visitedIds: externalVisitedIds,
}: StatusQuoteCardProps) {
    // Create a new Set for this branch if not provided, including current status
    // Clone the external Set to avoid mutating props during render
    const visitedIds = useMemo(() => {
        const set = externalVisitedIds ? new Set(externalVisitedIds) : new Set<string>();
        set.add(status.id);
        return set;
    }, [externalVisitedIds, status.id]);
    const account = status.account;
    const isDetail = variant === 'detail';
    const [resolvedNestedQuoteStatus, setResolvedNestedQuoteStatus] =
        useState<mastodon.v1.Status | null>(null);

    const shallowNestedQuoteId = useMemo(() => {
        const quote = status.quote;
        if (!quote) return null;
        if (quote.state !== 'accepted') return null;
        if (isFullQuote(quote)) return null;
        return quote.quotedStatusId ?? null;
    }, [status.quote]);

    // Resolve accepted ShallowQuote so nested root quote can be opened
    useEffect(() => {
        if (!accountSession || !shallowNestedQuoteId) return;

        let cancelled = false;

        const resolveNestedQuote = async () => {
            try {
                const client = getClient(accountSession);
                const quotedStatus = await fetchStatus(client, shallowNestedQuoteId);
                if (!cancelled) {
                    setResolvedNestedQuoteStatus(quotedStatus);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to fetch nested quoted status:', error);
                }
            }
        };

        resolveNestedQuote();

        return () => {
            cancelled = true;
        };
    }, [accountSession, shallowNestedQuoteId]);

    const resolvedNestedQuoteForCurrentStatus =
        shallowNestedQuoteId && resolvedNestedQuoteStatus?.id === shallowNestedQuoteId
            ? resolvedNestedQuoteStatus
            : null;

    // Convert media attachments to viewer formats
    const mediaAttachments = useMemo(
        () => status.mediaAttachments ?? [],
        [status.mediaAttachments]
    );
    const imageViewerImages = useMemo(
        () => toImageViewerImages(mediaAttachments),
        [mediaAttachments]
    );
    const videoViewerVideos = useMemo(
        () => toVideoViewerVideos(mediaAttachments),
        [mediaAttachments]
    );
    const audioViewerTracks = useMemo(
        () => toAudioViewerTracks(mediaAttachments),
        [mediaAttachments]
    );

    // Get first image for compact preview
    const firstImage = imageViewerImages[0];
    const hasMultipleImages = imageViewerImages.length > 1;
    const hasVideo = videoViewerVideos.length > 0;
    const hasAudio = audioViewerTracks.length > 0;
    const hasMedia = firstImage || hasVideo || hasAudio;
    const hasPoll = status.poll && status.poll.options && status.poll.options.length > 0;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent parent card click
        onClick?.(status);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onClick?.(status);
        }
    };

    const handleMediaClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent quote card click
        if (firstImage && onImageClick) {
            onImageClick(imageViewerImages, 0);
        } else if (hasVideo && onVideoClick) {
            onVideoClick(videoViewerVideos, 0);
        } else if (hasAudio && onAudioClick) {
            onAudioClick(audioViewerTracks, 0);
        }
    };

    // Variant-specific styles
    const isInteractive = Boolean(onClick);
    const baseContainerClass = isDetail
        ? 'mt-4 bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 transition-colors'
        : 'mt-3 bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 transition-colors';
    const containerClass = isInteractive
        ? `${baseContainerClass} cursor-pointer hover:bg-slate-800/50`
        : baseContainerClass;

    const avatarClass = isDetail ? 'w-10 h-10 rounded-lg' : 'w-8 h-8 rounded';
    const textClass = isDetail ? 'text-sm' : 'text-xs';

    return (
        <div
            className={containerClass}
            onClick={isInteractive ? handleClick : undefined}
            onKeyDown={isInteractive ? handleKeyDown : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            role={isInteractive ? 'button' : undefined}
            aria-label={
                isInteractive
                    ? `${account.displayName || account.username}の引用投稿を表示`
                    : undefined
            }
        >
            {/* Header: Avatar + Name + Time */}
            <div className="flex items-center gap-2 mb-2">
                <img src={account.avatar} alt="" className={avatarClass} loading="lazy" />
                <div className="min-w-0 flex-1">
                    <span className={`font-medium text-slate-100 ${textClass}`}>
                        <DisplayName account={account} />
                    </span>
                    <span className={`text-slate-500 ml-1 ${textClass}`}>@{account.acct}</span>
                </div>
                <span className={`text-slate-500 shrink-0 ${textClass}`}>
                    {formatDate(status.createdAt)}
                </span>
            </div>

            {/* Content */}
            <StatusBody
                content={status.content}
                emojis={status.emojis}
                spoilerText={status.spoilerText || undefined}
                variant="card"
                className="line-clamp-3"
                hasQuote={hasQuote(status)}
            />

            {/* Compact media preview */}
            {hasMedia && (
                <div className="mt-2">
                    {firstImage && (
                        <button
                            type="button"
                            onClick={handleMediaClick}
                            className="relative rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label={`画像を表示${hasMultipleImages ? `（他${imageViewerImages.length - 1}枚）` : ''}`}
                        >
                            <img
                                src={firstImage.previewUrl || firstImage.url}
                                alt=""
                                className="h-20 w-auto object-cover rounded"
                                loading="lazy"
                            />
                            {hasMultipleImages && (
                                <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                                    +{imageViewerImages.length - 1}
                                </span>
                            )}
                        </button>
                    )}
                    {(hasVideo || hasAudio) && (
                        <button
                            type="button"
                            className="flex items-center gap-2 bg-slate-700/50 rounded px-2 py-1.5 text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onClick={handleMediaClick}
                            aria-label={`${hasVideo ? '動画' : '音声'}を表示${hasVideo && videoViewerVideos.length > 1 ? `（他${videoViewerVideos.length - 1}件）` : ''}${hasAudio && audioViewerTracks.length > 1 ? `（他${audioViewerTracks.length - 1}件）` : ''}`}
                        >
                            <span className="text-sm" aria-hidden="true">
                                📹
                            </span>
                            <span className={textClass}>
                                {hasVideo ? '動画' : '音声'}
                                {hasVideo &&
                                    videoViewerVideos.length > 1 &&
                                    ` (${videoViewerVideos.length})`}
                                {hasAudio &&
                                    audioViewerTracks.length > 1 &&
                                    ` (${audioViewerTracks.length})`}
                            </span>
                        </button>
                    )}
                </div>
            )}

            {/* Poll indicator */}
            {hasPoll && (
                <div className="flex items-center gap-1 mt-2 text-slate-400">
                    <LuChartBar className={textClass} aria-hidden="true" />
                    <span className={textClass}>投票</span>
                </div>
            )}

            {/* Nested quote card - only render if depth allows and not circular */}
            {hasQuote(status) &&
                depth < MAX_QUOTE_DEPTH &&
                (() => {
                    const nestedQuotedStatus =
                        getQuotedStatus(status) ?? resolvedNestedQuoteForCurrentStatus;
                    const nestedQuote = status.quote;

                    if (nestedQuotedStatus) {
                        // Skip if already visited (circular reference)
                        if (visitedIds.has(nestedQuotedStatus.id)) {
                            return null;
                        }
                        return (
                            <StatusQuoteCard
                                status={nestedQuotedStatus}
                                variant="card"
                                depth={depth + 1}
                                onClick={onClick}
                                onImageClick={onImageClick}
                                onVideoClick={onVideoClick}
                                onAudioClick={onAudioClick}
                                accountSession={accountSession}
                                visitedIds={visitedIds}
                            />
                        );
                    }

                    if (nestedQuote) {
                        const isShallow =
                            nestedQuote.state === 'accepted' && !isFullQuote(nestedQuote);
                        return (
                            <StatusQuotePlaceholder
                                state={nestedQuote.state}
                                variant="card"
                                isShallow={isShallow}
                            />
                        );
                    }

                    return null;
                })()}
        </div>
    );
});
