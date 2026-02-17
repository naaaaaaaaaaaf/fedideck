import type { mastodon } from 'masto';
import { firstNonEmpty } from './firstNonEmpty';
import type { AudioViewerTrack } from '../types/audio';

/**
 * Type guard to check if media attachment is an audio file
 */
function isAudio(
    media: mastodon.v1.MediaAttachment
): media is mastodon.v1.MediaAttachment & { type: 'audio' } {
    return media.type === 'audio';
}

/**
 * Convert Mastodon media attachments to AudioViewerTrack format.
 * Filters for audio type only, limits to 4 items, and removes empty URLs.
 *
 * @param mediaAttachments - Array of Mastodon media attachments
 * @returns Array of AudioViewerTrack objects suitable for AudioPlayer component
 */
export function toAudioViewerTracks(
    mediaAttachments: mastodon.v1.MediaAttachment[] | undefined | null
): AudioViewerTrack[] {
    const attachments = mediaAttachments ?? [];
    return attachments
        .filter(isAudio)
        .slice(0, 4)
        .map((media) => {
            const artworkUrl = firstNonEmpty(media.previewUrl, media.previewRemoteUrl);
            return {
                url: firstNonEmpty(media.url, media.remoteUrl),
                artworkUrl: artworkUrl || undefined,
                description: media.description ?? undefined,
            };
        })
        .filter((track) => track.url !== '');
}
