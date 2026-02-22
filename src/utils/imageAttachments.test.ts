import { describe, it, expect } from 'vitest';
import { toImageViewerImages } from './imageAttachments';
import type { mastodon } from 'masto';

describe('toImageViewerImages', () => {
    const createMockMediaAttachment = (
        overrides: Partial<mastodon.v1.MediaAttachment> = {}
    ): mastodon.v1.MediaAttachment =>
        ({
            id: '1',
            type: 'image',
            url: 'https://example.com/image.png',
            previewUrl: 'https://example.com/preview.png',
            remoteUrl: null,
            meta: {},
            description: 'Test image',
            blurhash: null,
            ...overrides,
        }) as mastodon.v1.MediaAttachment;

    describe('filtering', () => {
        it('should filter only image type attachments', () => {
            const attachments = [
                createMockMediaAttachment({ id: '1', type: 'image' }),
                createMockMediaAttachment({ id: '2', type: 'video' }),
                createMockMediaAttachment({ id: '3', type: 'image' }),
                createMockMediaAttachment({ id: '4', type: 'gifv' }),
                createMockMediaAttachment({ id: '5', type: 'audio' }),
            ];

            const result = toImageViewerImages(attachments);

            expect(result).toHaveLength(2);
            expect(result[0].url).toContain('image.png'); // id 1
        });

        it('should return empty array for non-image attachments', () => {
            const attachments = [
                createMockMediaAttachment({ type: 'video' }),
                createMockMediaAttachment({ type: 'audio' }),
                createMockMediaAttachment({ type: 'gifv' }),
            ];

            const result = toImageViewerImages(attachments);

            expect(result).toHaveLength(0);
        });
    });

    describe('max images limit', () => {
        it('should limit to 4 images maximum', () => {
            const attachments = Array.from({ length: 6 }, (_, i) =>
                createMockMediaAttachment({
                    id: `${i}`,
                    url: `https://example.com/image${i}.png`,
                })
            );

            const result = toImageViewerImages(attachments);

            expect(result).toHaveLength(4);
        });

        it('should return all images if less than 4', () => {
            const attachments = [
                createMockMediaAttachment({ id: '1' }),
                createMockMediaAttachment({ id: '2' }),
            ];

            const result = toImageViewerImages(attachments);

            expect(result).toHaveLength(2);
        });
    });

    describe('URL handling', () => {
        it('should use firstNonEmpty for url (prefer url over previewUrl)', () => {
            const attachments = [
                createMockMediaAttachment({
                    url: 'https://example.com/full.png',
                    previewUrl: 'https://example.com/preview.png',
                }),
            ];

            const result = toImageViewerImages(attachments);

            expect(result[0].url).toBe('https://example.com/full.png');
        });

        it('should use previewUrl as fallback when url is empty', () => {
            const attachments = [
                createMockMediaAttachment({
                    url: '',
                    previewUrl: 'https://example.com/preview.png',
                }),
            ];

            const result = toImageViewerImages(attachments);

            expect(result[0].url).toBe('https://example.com/preview.png');
        });

        it('should filter out images with empty urls (both url and previewUrl empty)', () => {
            const attachments = [
                createMockMediaAttachment({
                    id: '1',
                    url: '',
                    previewUrl: undefined,
                }),
                createMockMediaAttachment({
                    id: '2',
                    url: 'https://example.com/valid.png',
                }),
            ];

            const result = toImageViewerImages(attachments);

            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('https://example.com/valid.png');
        });

        it('should filter out images with null urls', () => {
            const attachments = [
                createMockMediaAttachment({
                    id: '1',
                    url: null as unknown as string,
                    previewUrl: null as unknown as string,
                }),
                createMockMediaAttachment({
                    id: '2',
                    url: 'https://example.com/valid.png',
                }),
            ];

            const result = toImageViewerImages(attachments);

            expect(result).toHaveLength(1);
        });
    });

    describe('field mapping', () => {
        it('should map previewUrl correctly', () => {
            const attachments = [
                createMockMediaAttachment({
                    previewUrl: 'https://example.com/preview.png',
                }),
            ];

            const result = toImageViewerImages(attachments);

            expect(result[0].previewUrl).toBe('https://example.com/preview.png');
        });

        it('should set previewUrl to undefined when null', () => {
            const attachments = [
                createMockMediaAttachment({
                    previewUrl: undefined,
                }),
            ];

            const result = toImageViewerImages(attachments);

            expect(result[0].previewUrl).toBeUndefined();
        });

        it('should map description correctly', () => {
            const attachments = [
                createMockMediaAttachment({
                    description: 'A beautiful sunset',
                }),
            ];

            const result = toImageViewerImages(attachments);

            expect(result[0].description).toBe('A beautiful sunset');
        });

        it('should set description to undefined when null', () => {
            const attachments = [
                createMockMediaAttachment({
                    description: null,
                }),
            ];

            const result = toImageViewerImages(attachments);

            expect(result[0].description).toBeUndefined();
        });
    });

    describe('edge cases', () => {
        it('should return empty array for undefined input', () => {
            const result = toImageViewerImages(undefined);

            expect(result).toHaveLength(0);
        });

        it('should return empty array for null input', () => {
            const result = toImageViewerImages(null);

            expect(result).toHaveLength(0);
        });

        it('should return empty array for empty array input', () => {
            const result = toImageViewerImages([]);

            expect(result).toHaveLength(0);
        });
    });
});
