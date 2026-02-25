import type { mastodon } from 'masto';
import { firstNonEmpty } from './firstNonEmpty';
import type { ImageViewerImage } from '../components/ImageViewer';

/**
 * Maximum number of images to display in a status
 */
export const MAX_IMAGE_ATTACHMENTS = 4;

/**
 * Type guard to check if media attachment is an image
 */
function isImage(
    media: mastodon.v1.MediaAttachment
): media is mastodon.v1.MediaAttachment & { type: 'image' } {
    return media.type === 'image';
}

/**
 * Convert Mastodon media attachments to ImageViewerImage format.
 * Filters for image types only, limits to MAX_IMAGE_ATTACHMENTS items, and removes empty URLs.
 *
 * @param mediaAttachments - Array of Mastodon media attachments
 * @returns Array of ImageViewerImage objects suitable for ImageViewer component
 */
export function toImageViewerImages(
    mediaAttachments: mastodon.v1.MediaAttachment[] | undefined | null
): ImageViewerImage[] {
    const attachments = mediaAttachments ?? [];
    return attachments
        .filter(isImage)
        .slice(0, MAX_IMAGE_ATTACHMENTS)
        .map((media) => ({
            url: firstNonEmpty(media.url, media.previewUrl),
            previewUrl: media.previewUrl ?? undefined,
            description: media.description ?? undefined,
        }))
        .filter((image) => image.url !== '');
}
