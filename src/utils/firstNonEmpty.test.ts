import { describe, it, expect } from 'vitest';
import { firstNonEmpty } from './firstNonEmpty';

describe('firstNonEmpty', () => {
    it('should return the first non-empty string', () => {
        expect(firstNonEmpty('first', 'second', 'third')).toBe('first');
    });

    it('should skip empty strings', () => {
        expect(firstNonEmpty('', 'second', 'third')).toBe('second');
    });

    it('should skip null and undefined', () => {
        expect(firstNonEmpty(null, undefined, 'third')).toBe('third');
    });

    it('should handle mixed empty values', () => {
        expect(firstNonEmpty('', null, undefined, 'valid')).toBe('valid');
    });

    it('should return empty string when all values are falsy', () => {
        expect(firstNonEmpty('', null, undefined)).toBe('');
    });

    it('should return empty string when no arguments provided', () => {
        expect(firstNonEmpty()).toBe('');
    });

    // Real-world use case for media URL fallback
    it('should handle media URL fallback chain', () => {
        const media = { url: '', previewUrl: 'https://example.com/preview.jpg' };
        const result = firstNonEmpty(media.url, media.previewUrl);
        expect(result).toBe('https://example.com/preview.jpg');
    });

    it('should treat empty string differently from null/undefined', () => {
        // ?? operator only falls back for null/undefined, not empty strings
        expect(firstNonEmpty('', 'fallback')).toBe('fallback');
        expect(firstNonEmpty(null, 'fallback')).toBe('fallback');
        // ?? would not fall back for empty string, but would for null
        const emptyStr = '';
        const resultNullish = null ?? 'fallback';
        expect(resultNullish).toBe('fallback');
    });
});
