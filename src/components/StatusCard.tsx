import React, { useMemo, useState, useEffect } from 'react';
import type { mastodon } from 'masto';
import { type AccountSession, fetchStatus, getClient } from '../api/mastoClient';
import { getDisplayStatus, getReblogger } from '../utils/statusView';
import { toVideoViewerVideos } from '../utils/videoAttachments';
import { toAudioViewerTracks } from '../utils/audioAttachments';
import { toImageViewerImages } from '../utils/imageAttachments';
import { useStatusActions } from '../hooks/useStatusActions';
import { useCardInteraction } from '../hooks/useCardInteraction';
import { useNsfwState } from '../hooks/useNsfwState';
import { usePollState } from '../hooks/usePollState';
import { usePollCountdown } from '../hooks/usePollCountdown';
import type { ImageViewerImage } from './ImageViewer';
import type { VideoViewerVideo } from '../types/video';
import type { AudioViewerTrack } from '../types/audio';
import {
    StatusReblogIndicator,
    StatusHeader,
    StatusBody,
    StatusMedia,
    StatusPoll,
    StatusActions,
    StatusReplyIndicator,
    StatusQuoteCard,
    StatusQuotePlaceholder,
} from './status';
import { hasQuote, getQuotedStatus, isFullQuote } from '../utils/statusView';

interface StatusCardProps {
    status: mastodon.v1.Status;
    isReblog?: boolean;
    accountSession?: AccountSession; // Required for boost/favorite - uses column's account
    onStatusUpdate?: (updatedStatus: mastodon.v1.Status) => void;
    onPollUpdate?: (statusId: string, poll: mastodon.v1.Poll) => void;
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
    onPollUpdate,
    onReply,
    onStatusClick,
    onImageClick,
    onVideoClick,
    onAudioClick,
    onAccountClick,
    onNsfwReveal,
    isNsfwRevealed,
    onStatusDelete,
    onStatusEdit,
}: StatusCardProps) {
    // If it's a reblog, show the original status with reblog indicator
    const displayStatus = getDisplayStatus(status);
    const reblogger = getReblogger(status);

    // Status actions (favourite/reblog/bookmark) with optimistic UI
    const {
        favourited,
        favouritesCount,
        reblogged,
        reblogsCount,
        bookmarked,
        isLoading,
        canReblog,
        handleFavourite,
        handleReblog,
        handleBookmark,
        statusWithLocalState,
    } = useStatusActions({
        status: displayStatus,
        accountSession,
        onStatusUpdate,
    });

    // Poll state using usePollState hook
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
        poll: displayStatus.poll ?? null,
        statusId: displayStatus.id,
        accountSession: accountSession ?? null,
        onPollUpdate,
    });

    // Poll countdown display
    const pollCountdown = usePollCountdown(localPoll?.expiresAt ?? null);

    // Resolve ShallowQuote (accepted with quotedStatusId but no quotedStatus)
    const [resolvedShallowQuoteStatus, setResolvedShallowQuoteStatus] =
        useState<mastodon.v1.Status | null>(null);

    const shallowQuoteId = useMemo(() => {
        const quote = displayStatus.quote;
        if (!quote) return null;
        if (quote.state !== 'accepted') return null;
        if (isFullQuote(quote)) return null;
        return quote.quotedStatusId ?? null;
    }, [displayStatus.quote]);

    useEffect(() => {
        if (!accountSession || !shallowQuoteId) return;

        let cancelled = false;

        const resolveShallowQuote = async () => {
            try {
                const client = getClient(accountSession);
                const quotedStatus = await fetchStatus(client, shallowQuoteId, accountSession);
                if (!cancelled) {
                    setResolvedShallowQuoteStatus(quotedStatus);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to fetch shallow quoted status:', error);
                }
            }
        };

        resolveShallowQuote();

        return () => {
            cancelled = true;
        };
    }, [accountSession, shallowQuoteId]);

    // NSFW state with controlled/uncontrolled mode
    const { nsfwRevealed, handleNsfwToggle } = useNsfwState({
        isRevealed: isNsfwRevealed,
        onReveal: onNsfwReveal,
        statusId: displayStatus.id,
    });

    // Note: nsfwRevealed state is automatically reset when status changes
    // because StatusCard is rendered with key={status.id} in parent

    // Safely access arrays with fallbacks
    /* eslint-disable react-hooks/exhaustive-deps */
    const mediaAttachments = displayStatus.mediaAttachments ?? [];

    // Convert media attachments to viewer formats
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
    /* eslint-enable react-hooks/exhaustive-deps */

    // Safely access account
    const account = displayStatus.account;

    // Card interaction handlers - must be called before early return
    const { handleClick: handleCardClick, handleKeyDown: handleCardKeyDown } = useCardInteraction({
        onClick: onStatusClick
            ? () => statusWithLocalState && onStatusClick(statusWithLocalState)
            : undefined,
        isEnabled: !!onStatusClick,
    });

    if (!account) {
        return null; // Cannot render without account
    }

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
            {reblogger && <StatusReblogIndicator reblogger={reblogger} variant="card" />}

            {/* Reply indicator */}
            <StatusReplyIndicator
                inReplyToId={displayStatus.inReplyToId ?? null}
                inReplyToAccountId={displayStatus.inReplyToAccountId ?? null}
                mentions={displayStatus.mentions}
                onClick={
                    onStatusClick && statusWithLocalState
                        ? () => onStatusClick(statusWithLocalState)
                        : undefined
                }
            />

            <div className="flex gap-3 items-start">
                {/* Content */}
                <div className="min-w-0 flex-1">
                    {/* Header */}
                    <StatusHeader
                        account={account}
                        createdAt={displayStatus.createdAt}
                        visibility={displayStatus.visibility}
                        statusUrl={displayStatus.url ?? displayStatus.uri}
                        variant="card"
                        onAccountClick={onAccountClick}
                        accountSessionId={accountSession?.id}
                    />

                    {/* Body */}
                    <StatusBody
                        content={displayStatus.content}
                        emojis={displayStatus.emojis}
                        spoilerText={displayStatus.spoilerText}
                        variant="card"
                        hasQuote={hasQuote(displayStatus)}
                    />

                    {/* Media attachments */}
                    <StatusMedia
                        mediaAttachments={mediaAttachments}
                        isSensitive={displayStatus.sensitive ?? false}
                        nsfwRevealed={nsfwRevealed}
                        onNsfwReveal={handleNsfwToggle}
                        variant="card"
                        imageViewerImages={imageViewerImages}
                        videoViewerVideos={videoViewerVideos}
                        audioViewerTracks={audioViewerTracks}
                        onImageClick={onImageClick}
                        onVideoClick={onVideoClick}
                        onAudioClick={onAudioClick}
                    />

                    {/* Poll */}
                    {localPoll && localPoll.options && localPoll.options.length > 0 && (
                        <StatusPoll
                            poll={localPoll}
                            selectedOptions={selectedPollOptions}
                            pollLoading={pollLoading}
                            pollRefreshing={pollRefreshing}
                            canVote={canVote}
                            canRefresh={canRefresh}
                            pollCountdown={pollCountdown}
                            onOptionToggle={handlePollOptionToggle}
                            onVote={handlePollVote}
                            onRefresh={handlePollRefresh}
                            variant="card"
                        />
                    )}

                    {/* Quote Card */}
                    {hasQuote(displayStatus) &&
                        (() => {
                            const quotedStatus =
                                getQuotedStatus(displayStatus) ??
                                (shallowQuoteId && resolvedShallowQuoteStatus?.id === shallowQuoteId
                                    ? resolvedShallowQuoteStatus
                                    : null);
                            const quote = displayStatus.quote;

                            // If we have the full quoted status, show the card
                            if (quotedStatus) {
                                return (
                                    <StatusQuoteCard
                                        status={quotedStatus}
                                        variant="card"
                                        onClick={onStatusClick}
                                        onImageClick={onImageClick}
                                        onVideoClick={onVideoClick}
                                        onAudioClick={onAudioClick}
                                        accountSession={accountSession}
                                    />
                                );
                            }

                            // If quote exists but no quotedStatus, show placeholder
                            if (quote) {
                                // Check if this is a ShallowQuote (accepted but no status)
                                const isShallow = quote.state === 'accepted' && !isFullQuote(quote);
                                return (
                                    <StatusQuotePlaceholder
                                        state={quote.state}
                                        variant="card"
                                        isShallow={isShallow}
                                    />
                                );
                            }

                            return null;
                        })()}

                    {/* Action bar */}
                    <StatusActions
                        repliesCount={displayStatus.repliesCount ?? 0}
                        reblogsCount={reblogsCount ?? 0}
                        favouritesCount={favouritesCount ?? 0}
                        favourited={favourited}
                        reblogged={reblogged}
                        bookmarked={bookmarked}
                        canReblog={canReblog}
                        isAuthenticated={Boolean(accountSession)}
                        isLoading={isLoading}
                        onReply={onReply ? () => onReply(displayStatus) : undefined}
                        onReblog={handleReblog}
                        onFavourite={handleFavourite}
                        onBookmark={handleBookmark}
                        variant="card"
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
                        replyDisabled={!onReply}
                    />
                </div>
            </div>
        </article>
    );
});
