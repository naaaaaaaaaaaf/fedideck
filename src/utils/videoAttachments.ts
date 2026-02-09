import type { mastodon } from 'masto';
import { firstNonEmpty } from './firstNonEmpty';
import type { VideoViewerVideo } from '../types/video';

/**
 * Type guard to check if media attachment is a video or gifv
 */
function isVideoOrGifv(
    media: mastodon.v1.MediaAttachment
): media is mastodon.v1.MediaAttachment & { type: 'video' | 'gifv' } {
    return media.type === 'video' || media.type === 'gifv';
}

/**
 * Convert Mastodon media attachments to VideoViewerVideo format.
 * Filters for video/gifv types only, limits to 4 items, and removes empty URLs.
 *
 * @param mediaAttachments - Array of Mastodon media attachments
 * @returns Array of VideoViewerVideo objects suitable for VideoViewer component
 */
export function toVideoViewerVideos(
    mediaAttachments: mastodon.v1.MediaAttachment[] | undefined | null
): VideoViewerVideo[] {
    const attachments = mediaAttachments ?? [];
    return attachments
        .filter(isVideoOrGifv)
        .slice(0, 4)
        .map((media) => ({
            url: firstNonEmpty(media.url),
            previewUrl: firstNonEmpty(media.previewUrl),
            description: media.description ?? undefined,
            type: media.type, // Type is inferred as 'video' | 'gifv' from the type guard
        }))
        .filter((video) => video.url !== '');
}
