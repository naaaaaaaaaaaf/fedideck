import { describe, it, expect } from 'vitest';
import { toImageViewerImages, MAX_IMAGE_ATTACHMENTS } from './imageAttachments';
import type { mastodon } from 'masto';

// Helper to create mock media attachment
function createMockMedia(
    type: mastodon.v1.MediaAttachment['type'] = 'image',
    overrides: Partial<mastodon.v1.MediaAttachment> = {}
): mastodon.v1.MediaAttachment {
    return {
        id: '1',
        type,
        url: 'https://example.com/media/1',
        previewUrl: 'https://example.com/media/1/preview',
        remoteUrl: null,
        previewRemoteUrl: null,
        meta: {},
        description: 'Test image',
        blurhash: null,
        textUrl: null,
        ...overrides,
    } as mastodon.v1.MediaAttachment;
}

describe('imageAttachments', () => {
    describe('MAX_IMAGE_ATTACHMENTS', () => {
        it('is set to 4', () => {
            expect(MAX_IMAGE_ATTACHMENTS).toBe(4);
        });
    });

    describe('toImageViewerImages', () => {
        it('returns empty array for null input', () => {
            expect(toImageViewerImages(null)).toEqual([]);
        });

        it('returns empty array for undefined input', () => {
            expect(toImageViewerImages(undefined)).toEqual([]);
        });

        it('returns empty array for empty array input', () => {
            expect(toImageViewerImages([])).toEqual([]);
        });

        it('filters to only image types', () => {
            const media = [
                createMockMedia('image', { id: '1', url: 'https://example.com/media/1' }),
                createMockMedia('video', { id: '2', url: 'https://example.com/media/2' }),
                createMockMedia('image', { id: '3', url: 'https://example.com/media/3' }),
                createMockMedia('gifv', { id: '4', url: 'https://example.com/media/4' }),
            ];
            const result = toImageViewerImages(media);
            expect(result).toHaveLength(2);
            expect(result[0].url).toBe('https://example.com/media/1');
            expect(result[1].url).toBe('https://example.com/media/3');
        });

        it('limits to MAX_IMAGE_ATTACHMENTS images', () => {
            const media = Array.from({ length: 6 }, (_, i) =>
                createMockMedia('image', { id: String(i + 1) })
            );
            const result = toImageViewerImages(media);
            expect(result).toHaveLength(MAX_IMAGE_ATTACHMENTS);
        });

        it('filters out images with empty URLs', () => {
            const media = [
                createMockMedia('image', { id: '1', url: '', previewUrl: '' }),
                createMockMedia('image', { id: '2', url: 'https://example.com/2' }),
            ];
            const result = toImageViewerImages(media);
            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('https://example.com/2');
        });

        it('uses firstNonEmpty for url (url over previewUrl)', () => {
            const media = [createMockMedia('image', { id: '1', url: 'https://full.url' })];
            const result = toImageViewerImages(media);
            expect(result[0].url).toBe('https://full.url');
        });

        it('falls back to previewUrl when url is empty', () => {
            const media = [
                createMockMedia('image', { id: '1', url: '', previewUrl: 'https://preview.url' }),
            ];
            const result = toImageViewerImages(media);
            expect(result[0].url).toBe('https://preview.url');
        });

        it('handles missing description', () => {
            const media = [createMockMedia('image', { id: '1', description: undefined })];
            const result = toImageViewerImages(media);
            expect(result[0].description).toBeUndefined();
        });

        it('handles missing previewUrl', () => {
            const media = [createMockMedia('image', { id: '1', previewUrl: undefined })];
            const result = toImageViewerImages(media);
            expect(result[0].previewUrl).toBeUndefined();
        });
    });
});
