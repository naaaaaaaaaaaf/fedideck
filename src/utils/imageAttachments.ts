import type { mastodon } from 'masto';
import { firstNonEmpty } from './firstNonEmpty';
import type { ImageViewerImage } from '../types/imageViewer';

/**
 * Maximum number of images to display in a status card
 */
const MAX_IMAGES = 4;

/**
 * Convert media attachments to ImageViewerImage format.
 * Filters for image type only, limits to MAX_IMAGES, and ensures valid URLs.
 *
 * @param mediaAttachments - Array of media attachments from a status
 * @returns Array of ImageViewerImage objects for use with ImageViewer component
 */
export function toImageViewerImages(
    mediaAttachments: mastodon.v1.MediaAttachment[] | undefined | null
): ImageViewerImage[] {
    const attachments = mediaAttachments ?? [];
    return attachments
        .filter((media) => media.type === 'image')
        .slice(0, MAX_IMAGES)
        .map((media) => ({
            url: firstNonEmpty(media.url, media.previewUrl),
            previewUrl: media.previewUrl ?? undefined,
            description: media.description ?? undefined,
        }))
        .filter((image) => image.url !== '');
}
