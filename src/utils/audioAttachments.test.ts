import { describe, it, expect } from 'vitest';
import { toAudioViewerTracks } from './audioAttachments';
import type { mastodon } from 'masto';

describe('toAudioViewerTracks', () => {
    // Helper to create a mock audio attachment
    const createAudioAttachment = (
        overrides: Partial<mastodon.v1.MediaAttachment> = {}
    ): mastodon.v1.MediaAttachment => {
        return {
            id: '1',
            type: 'audio',
            url: 'https://example.com/audio.mp3',
            previewUrl: 'https://example.com/audio-preview.jpg',
            remoteUrl: null,
            previewRemoteUrl: null,
            textUrl: null,
            meta: {},
            description: 'Test audio',
            blurhash: null,
            ...overrides,
        } as mastodon.v1.MediaAttachment;
    };

    const createImageAttachment = (): mastodon.v1.MediaAttachment => {
        return {
            id: '2',
            type: 'image',
            url: 'https://example.com/image.jpg',
            previewUrl: 'https://example.com/image-preview.jpg',
            remoteUrl: null,
            previewRemoteUrl: null,
            textUrl: null,
            meta: {},
            description: null,
            blurhash: null,
        } as mastodon.v1.MediaAttachment;
    };

    describe('null/undefined handling', () => {
        it('returns empty array for null input', () => {
            expect(toAudioViewerTracks(null)).toEqual([]);
        });

        it('returns empty array for undefined input', () => {
            expect(toAudioViewerTracks(undefined)).toEqual([]);
        });

        it('returns empty array for empty array input', () => {
            expect(toAudioViewerTracks([])).toEqual([]);
        });
    });

    describe('type filtering', () => {
        it('filters to only audio attachments', () => {
            const attachments = [
                createAudioAttachment({ id: '1' }),
                createImageAttachment(),
                createAudioAttachment({ id: '3' }),
            ];

            const result = toAudioViewerTracks(attachments);

            expect(result).toHaveLength(2);
            expect(result[0].url).toBe('https://example.com/audio.mp3');
            expect(result[1].url).toBe('https://example.com/audio.mp3');
        });

        it('returns empty array when no audio attachments present', () => {
            const attachments = [createImageAttachment()];

            const result = toAudioViewerTracks(attachments);

            expect(result).toEqual([]);
        });
    });

    describe('4-item limit', () => {
        it('limits output to maximum 4 audio tracks', () => {
            const attachments = [
                createAudioAttachment({ id: '1' }),
                createAudioAttachment({ id: '2' }),
                createAudioAttachment({ id: '3' }),
                createAudioAttachment({ id: '4' }),
                createAudioAttachment({ id: '5' }),
                createAudioAttachment({ id: '6' }),
            ];

            const result = toAudioViewerTracks(attachments);

            expect(result).toHaveLength(4);
        });
    });

    describe('URL fallback logic', () => {
        it('uses url as primary source', () => {
            const attachment = createAudioAttachment({
                url: 'https://example.com/primary.mp3',
                remoteUrl: 'https://fallback.com/audio.mp3',
            });

            const result = toAudioViewerTracks([attachment]);

            expect(result[0].url).toBe('https://example.com/primary.mp3');
        });

        it('falls back to remoteUrl when url is empty', () => {
            const attachment = createAudioAttachment({
                url: '',
                remoteUrl: 'https://fallback.com/audio.mp3',
            });

            const result = toAudioViewerTracks([attachment]);

            expect(result[0].url).toBe('https://fallback.com/audio.mp3');
        });

        it('falls back to remoteUrl when url is null', () => {
            const attachment = createAudioAttachment({
                url: null,
                remoteUrl: 'https://fallback.com/audio.mp3',
            });

            const result = toAudioViewerTracks([attachment]);

            expect(result[0].url).toBe('https://fallback.com/audio.mp3');
        });
    });

    describe('artwork URL fallback logic', () => {
        it('uses previewUrl as primary source for artwork', () => {
            const attachment = createAudioAttachment({
                previewUrl: 'https://example.com/preview.jpg',
                previewRemoteUrl: 'https://fallback.com/preview.jpg',
            });

            const result = toAudioViewerTracks([attachment]);

            expect(result[0].artworkUrl).toBe('https://example.com/preview.jpg');
        });

        it('falls back to previewRemoteUrl for artwork when previewUrl is empty', () => {
            const attachment = createAudioAttachment({
                previewUrl: '',
                previewRemoteUrl: 'https://fallback.com/preview.jpg',
            });

            const result = toAudioViewerTracks([attachment]);

            expect(result[0].artworkUrl).toBe('https://fallback.com/preview.jpg');
        });

        it('returns undefined for artworkUrl when both preview URLs are empty', () => {
            const attachment = createAudioAttachment({
                previewUrl: '',
                previewRemoteUrl: null,
            });

            const result = toAudioViewerTracks([attachment]);

            expect(result[0].artworkUrl).toBeUndefined();
        });
    });

    describe('empty URL filtering', () => {
        it('filters out tracks with empty URLs after fallback', () => {
            const attachments = [
                createAudioAttachment({ url: '', remoteUrl: null }),
                createAudioAttachment({
                    id: '2',
                    url: 'https://example.com/valid.mp3',
                }),
            ];

            const result = toAudioViewerTracks(attachments);

            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('https://example.com/valid.mp3');
        });
    });

    describe('description handling', () => {
        it('includes description when present', () => {
            const attachment = createAudioAttachment({
                description: 'My podcast episode',
            });

            const result = toAudioViewerTracks([attachment]);

            expect(result[0].description).toBe('My podcast episode');
        });

        it('sets description to undefined when null', () => {
            const attachment = createAudioAttachment({
                description: null,
            });

            const result = toAudioViewerTracks([attachment]);

            expect(result[0].description).toBeUndefined();
        });

        it('keeps empty string as empty string (?? only handles null/undefined)', () => {
            const attachment = createAudioAttachment({
                description: '',
            });

            const result = toAudioViewerTracks([attachment]);

            // ?? only handles null/undefined, not empty strings
            // This is consistent with videoAttachments.ts behavior
            expect(result[0].description).toBe('');
        });
    });

    describe('complete output format', () => {
        it('returns correctly formatted AudioViewerTrack objects', () => {
            const attachment = createAudioAttachment({
                url: 'https://example.com/audio.mp3',
                previewUrl: 'https://example.com/artwork.jpg',
                description: 'Track description',
            });

            const result = toAudioViewerTracks([attachment]);

            expect(result).toEqual([
                {
                    url: 'https://example.com/audio.mp3',
                    artworkUrl: 'https://example.com/artwork.jpg',
                    description: 'Track description',
                },
            ]);
        });
    });
});
