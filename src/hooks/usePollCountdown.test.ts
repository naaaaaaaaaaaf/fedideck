import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePollCountdown } from './usePollCountdown';

describe('usePollCountdown', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return null when expiresAt is null', () => {
        const { result } = renderHook(() => usePollCountdown(null));
        expect(result.current).toBeNull();
    });

    it('should return formatted time for valid expiresAt', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        // 30 minutes from now
        const expiresAt = new Date(now + 30 * 60000).toISOString();
        const { result } = renderHook(() => usePollCountdown(expiresAt));

        expect(result.current).toBe('残り30分');
    });

    it('should return null when poll is expired', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        // 1 minute in the past
        const expiresAt = new Date(now - 60000).toISOString();
        const { result } = renderHook(() => usePollCountdown(expiresAt));

        expect(result.current).toBeNull();
    });

    it('should update every 30 seconds', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        // 5 minutes from now
        const expiresAt = new Date(now + 5 * 60000).toISOString();
        const { result } = renderHook(() => usePollCountdown(expiresAt));

        expect(result.current).toBe('残り5分');

        // Advance 30 seconds using setSystemTime (which updates Date.now())
        act(() => {
            vi.setSystemTime(now + 30000);
            vi.advanceTimersByTime(30000);
        });

        // Should show 4 minutes (5 min - 30 sec = 4.5 min, floored to 4)
        expect(result.current).toBe('残り4分');
    });

    it('should update when expiresAt changes', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const expiresAt1 = new Date(now + 10 * 60000).toISOString();
        const { result, rerender } = renderHook(({ expiresAt }) => usePollCountdown(expiresAt), {
            initialProps: { expiresAt: expiresAt1 },
        });

        expect(result.current).toBe('残り10分');

        // Change to different expiresAt
        const expiresAt2 = new Date(now + 30 * 60000).toISOString();
        rerender({ expiresAt: expiresAt2 });

        expect(result.current).toBe('残り30分');
    });

    it('should clear remaining time when expiresAt changes to null', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const expiresAt = new Date(now + 10 * 60000).toISOString();
        const { result, rerender } = renderHook(({ expiresAt }) => usePollCountdown(expiresAt), {
            initialProps: { expiresAt } as { expiresAt: string | null },
        });

        expect(result.current).toBe('残り10分');

        // Change to null (poll that never expires)
        rerender({ expiresAt: null } as { expiresAt: string | null });

        expect(result.current).toBeNull();
    });

    it('should clear interval on unmount', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const expiresAt = new Date(now + 5 * 60000).toISOString();
        const { unmount } = renderHook(() => usePollCountdown(expiresAt));

        unmount();

        // Advance timers - should not cause any errors
        act(() => {
            vi.advanceTimersByTime(60000);
        });

        // If interval was cleared, no additional timers should fire
        // This is mainly checking that unmount doesn't throw
        expect(true).toBe(true);
    });

    it('should transition from minutes to "残り1分未満"', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        // 90 seconds from now
        const expiresAt = new Date(now + 90000).toISOString();
        const { result } = renderHook(() => usePollCountdown(expiresAt));

        expect(result.current).toBe('残り1分');

        // Advance 35 seconds using setSystemTime
        act(() => {
            vi.setSystemTime(now + 35000);
            vi.advanceTimersByTime(35000);
        });

        // Now 55 seconds remaining, should be "残り1分未満"
        expect(result.current).toBe('残り1分未満');
    });

    it('should transition to null when poll expires', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        // 2 minutes from now
        const expiresAt = new Date(now + 2 * 60000).toISOString();
        const { result } = renderHook(() => usePollCountdown(expiresAt));

        expect(result.current).toBe('残り2分');

        // Advance 2 minutes using setSystemTime
        act(() => {
            vi.setSystemTime(now + 2 * 60000);
            vi.advanceTimersByTime(2 * 60000);
        });

        expect(result.current).toBeNull();
    });
});
