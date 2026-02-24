import React from 'react';
import type { mastodon } from 'masto';
import { MediaAttachment } from '../MediaAttachment';
import { firstNonEmpty } from '../../utils/firstNonEmpty';
import type { ImageViewerImage } from '../ImageViewer';
import type { VideoViewerVideo } from '../../types/video';
import type { AudioViewerTrack } from '../../types/audio';

interface StatusMediaProps {
    /** Media attachments to display */
    mediaAttachments: mastodon.v1.MediaAttachment[];
    /** Whether the status is marked as sensitive */
    isSensitive: boolean;
    /** Whether NSFW content is revealed */
    nsfwRevealed: boolean;
    /** Callback when NSFW content is revealed */
    onNsfwReveal?: () => void;
    /** Size variant for styling */
    variant?: 'card' | 'detail';
    /** Pre-computed image viewer images */
    imageViewerImages: ImageViewerImage[];
    /** Pre-computed video viewer videos */
    videoViewerVideos: VideoViewerVideo[];
    /** Pre-computed audio viewer tracks */
    audioViewerTracks: AudioViewerTrack[];
    /** Callback when image is clicked */
    onImageClick?: (images: ImageViewerImage[], index: number) => void;
    /** Callback when video is clicked */
    onVideoClick?: (videos: VideoViewerVideo[], index: number) => void;
    /** Callback when audio is clicked */
    onAudioClick?: (tracks: AudioViewerTrack[], index: number) => void;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays media attachments with grid layout.
 * Handles image, video, and audio attachments with NSFW blur support.
 */
export const StatusMedia = React.memo(function StatusMedia({
    mediaAttachments,
    isSensitive,
    nsfwRevealed,
    onNsfwReveal,
    variant = 'card',
    imageViewerImages,
    videoViewerVideos,
    audioViewerTracks,
    onImageClick,
    onVideoClick,
    onAudioClick,
    className = '',
}: StatusMediaProps) {
    if (mediaAttachments.length === 0) {
        return null;
    }

    const isDetail = variant === 'detail';
    const marginClass = isDetail ? 'mb-4' : 'mt-3';
    const gapClass = isDetail ? 'gap-2' : 'gap-1';

    return (
        <div
            className={`${marginClass} grid ${gapClass} ${
                mediaAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            } ${className}`}
        >
            {mediaAttachments.slice(0, 4).map((media) => {
                const imageIndex =
                    media.type === 'image'
                        ? imageViewerImages.findIndex(
                              (img) => img.url === firstNonEmpty(media.url, media.previewUrl)
                          )
                        : undefined;
                const videoIndex =
                    media.type === 'video' || media.type === 'gifv'
                        ? videoViewerVideos.findIndex((v) => v.url === firstNonEmpty(media.url))
                        : undefined;
                const audioIndex =
                    media.type === 'audio'
                        ? audioViewerTracks.findIndex(
                              (t) => t.url === firstNonEmpty(media.url, media.remoteUrl)
                          )
                        : undefined;

                return (
                    <MediaAttachment
                        key={media.id}
                        media={media}
                        variant={variant}
                        isSensitive={isSensitive}
                        nsfwRevealed={nsfwRevealed}
                        onNsfwReveal={onNsfwReveal}
                        onImageClick={
                            imageIndex !== undefined && imageIndex !== -1
                                ? () => onImageClick?.(imageViewerImages, imageIndex)
                                : undefined
                        }
                        imageIndex={
                            imageIndex !== undefined && imageIndex !== -1 ? imageIndex : undefined
                        }
                        totalImages={imageViewerImages.length}
                        onVideoClick={
                            videoIndex !== undefined && videoIndex !== -1 && onVideoClick
                                ? () => onVideoClick(videoViewerVideos, videoIndex)
                                : undefined
                        }
                        onAudioClick={
                            audioIndex !== undefined && audioIndex !== -1 && onAudioClick
                                ? () => onAudioClick(audioViewerTracks, audioIndex)
                                : undefined
                        }
                    />
                );
            })}
        </div>
    );
});
