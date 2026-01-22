import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDate } from './dateFormat';

describe('formatDate', () => {
    let mockNow: Date;

    beforeEach(() => {
        // Mock current time to 2024-01-15 12:00:00
        mockNow = new Date('2024-01-15T12:00:00.000Z');
        vi.useFakeTimers();
        vi.setSystemTime(mockNow);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('seconds/minutes ago', () => {
        it('should return "今" for times less than 1 minute ago', () => {
            // 30 seconds ago
            const date = new Date(mockNow.getTime() - 30 * 1000).toISOString();
            expect(formatDate(date)).toBe('今');
        });

        it('should return "今" for times 0 seconds ago', () => {
            const date = mockNow.toISOString();
            expect(formatDate(date)).toBe('今');
        });

        it('should return minutes for times 1-59 minutes ago', () => {
            // 1 minute ago
            const date1 = new Date(mockNow.getTime() - 1 * 60 * 1000).toISOString();
            expect(formatDate(date1)).toBe('1分');

            // 30 minutes ago
            const date30 = new Date(mockNow.getTime() - 30 * 60 * 1000).toISOString();
            expect(formatDate(date30)).toBe('30分');

            // 59 minutes ago
            const date59 = new Date(mockNow.getTime() - 59 * 60 * 1000).toISOString();
            expect(formatDate(date59)).toBe('59分');
        });
    });

    describe('hours ago', () => {
        it('should return hours for times 1-23 hours ago', () => {
            // 1 hour ago
            const date1 = new Date(mockNow.getTime() - 1 * 60 * 60 * 1000).toISOString();
            expect(formatDate(date1)).toBe('1時間');

            // 12 hours ago
            const date12 = new Date(mockNow.getTime() - 12 * 60 * 60 * 1000).toISOString();
            expect(formatDate(date12)).toBe('12時間');

            // 23 hours ago
            const date23 = new Date(mockNow.getTime() - 23 * 60 * 60 * 1000).toISOString();
            expect(formatDate(date23)).toBe('23時間');
        });

        it('should transition from minutes to hours at 60 minutes', () => {
            // 59 minutes 59 seconds ago
            const date59m = new Date(mockNow.getTime() - 59 * 60 * 1000 - 59 * 1000).toISOString();
            expect(formatDate(date59m)).toBe('59分');

            // 60 minutes ago
            const date60m = new Date(mockNow.getTime() - 60 * 60 * 1000).toISOString();
            expect(formatDate(date60m)).toBe('1時間');
        });
    });

    describe('days ago', () => {
        it('should return days for times 1-6 days ago', () => {
            // 1 day ago
            const date1 = new Date(mockNow.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
            expect(formatDate(date1)).toBe('1日');

            // 3 days ago
            const date3 = new Date(mockNow.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
            expect(formatDate(date3)).toBe('3日');

            // 6 days ago
            const date6 = new Date(mockNow.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
            expect(formatDate(date6)).toBe('6日');
        });

        it('should transition from hours to days at 24 hours', () => {
            // 23 hours 59 minutes ago
            const date23h = new Date(mockNow.getTime() - 23 * 60 * 60 * 1000 - 59 * 60 * 1000).toISOString();
            expect(formatDate(date23h)).toBe('23時間');

            // 24 hours ago
            const date24h = new Date(mockNow.getTime() - 24 * 60 * 60 * 1000).toISOString();
            expect(formatDate(date24h)).toBe('1日');
        });
    });

    describe('weeks and beyond', () => {
        it('should return formatted date for times 7+ days ago', () => {
            // 7 days ago
            const date7 = new Date(mockNow.getTime() - 7 * 24 * 60 * 60 * 1000);
            const formatted7 = formatDate(date7.toISOString());
            // Should use toLocaleDateString('ja-JP') format
            expect(formatted7).toBe(date7.toLocaleDateString('ja-JP'));
        });

        it('should transition from days to formatted date at 7 days', () => {
            // 6 days 23 hours ago
            const date6d = new Date(mockNow.getTime() - 6 * 24 * 60 * 60 * 1000 - 23 * 60 * 60 * 1000).toISOString();
            expect(formatDate(date6d)).toBe('6日');

            // 7 days ago
            const date7d = new Date(mockNow.getTime() - 7 * 24 * 60 * 60 * 1000);
            expect(formatDate(date7d.toISOString())).toBe(date7d.toLocaleDateString('ja-JP'));
        });

        it('should return formatted date for times months ago', () => {
            // 30 days ago
            const date30 = new Date(mockNow.getTime() - 30 * 24 * 60 * 60 * 1000);
            expect(formatDate(date30.toISOString())).toBe(date30.toLocaleDateString('ja-JP'));
        });

        it('should return formatted date for times years ago', () => {
            // 365 days ago
            const date365 = new Date(mockNow.getTime() - 365 * 24 * 60 * 60 * 1000);
            expect(formatDate(date365.toISOString())).toBe(date365.toLocaleDateString('ja-JP'));
        });
    });

    describe('edge cases', () => {
        it('should handle ISO date strings', () => {
            const isoDate = '2024-01-15T11:00:00.000Z'; // 1 hour ago
            expect(formatDate(isoDate)).toBe('1時間');
        });

        it('should handle date strings without milliseconds', () => {
            const date = '2024-01-15T11:00:00Z'; // 1 hour ago
            expect(formatDate(date)).toBe('1時間');
        });

        it('should handle dates with timezone offset', () => {
            const date = '2024-01-15T11:00:00+00:00'; // 1 hour ago
            expect(formatDate(date)).toBe('1時間');
        });

        it('should handle boundary between relative and absolute time', () => {
            // Exactly 7 days ago
            const exactly7Days = new Date(mockNow.getTime() - 7 * 24 * 60 * 60 * 1000);
            const result = formatDate(exactly7Days.toISOString());
            expect(result).toBe(exactly7Days.toLocaleDateString('ja-JP'));
        });
    });

    describe('Japanese locale formatting', () => {
        it('should use Japanese date format for dates beyond 7 days', () => {
            // Mock a specific old date to test format consistency
            const oldDate = new Date('2023-12-01T12:00:00.000Z');
            const formatted = formatDate(oldDate.toISOString());
            
            // Verify it returns a date string (not relative time)
            expect(formatted).not.toMatch(/分|時間|日/);
            expect(formatted).toBe(oldDate.toLocaleDateString('ja-JP'));
        });
    });

    describe('rounding behavior', () => {
        it('should floor minutes (not round up)', () => {
            // 1 minute 59 seconds ago
            const date = new Date(mockNow.getTime() - 1 * 60 * 1000 - 59 * 1000).toISOString();
            expect(formatDate(date)).toBe('1分'); // Should be 1, not 2
        });

        it('should floor hours (not round up)', () => {
            // 1 hour 59 minutes ago
            const date = new Date(mockNow.getTime() - 1 * 60 * 60 * 1000 - 59 * 60 * 1000).toISOString();
            expect(formatDate(date)).toBe('1時間'); // Should be 1, not 2
        });

        it('should floor days (not round up)', () => {
            // 1 day 23 hours ago
            const date = new Date(mockNow.getTime() - 1 * 24 * 60 * 60 * 1000 - 23 * 60 * 60 * 1000).toISOString();
            expect(formatDate(date)).toBe('1日'); // Should be 1, not 2
        });
    });
});
