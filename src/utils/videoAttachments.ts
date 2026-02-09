import type { mastodon } from 'masto';
import { firstNonEmpty } from './firstNonEmpty';
import type { VideoViewerVideo } from '../components/VideoViewer';

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
        .filter((media) => media.type === 'video' || media.type === 'gifv')
        .slice(0, 4)
        .map((media) => ({
            url: firstNonEmpty(media.url),
            previewUrl: media.previewUrl ?? undefined,
            description: media.description ?? undefined,
            type: media.type as 'video' | 'gifv',
        }))
        .filter((video) => video.url !== '');
}
