import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNsfwState } from './useNsfwState';

describe('useNsfwState', () => {
    describe('uncontrolled mode', () => {
        it('should start with nsfwRevealed as false', () => {
            const { result } = renderHook(() => useNsfwState({}));

            expect(result.current.nsfwRevealed).toBe(false);
            expect(result.current.isControlled).toBe(false);
        });

        it('should toggle nsfwRevealed when toggleNsfw is called', () => {
            const { result } = renderHook(() => useNsfwState({}));

            expect(result.current.nsfwRevealed).toBe(false);

            act(() => {
                result.current.toggleNsfw();
            });

            expect(result.current.nsfwRevealed).toBe(true);

            act(() => {
                result.current.toggleNsfw();
            });

            expect(result.current.nsfwRevealed).toBe(false);
        });

        it('should not call onReveal in uncontrolled mode', () => {
            const onReveal = vi.fn();
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: 'status-1',
                    onReveal: undefined, // Explicitly undefined for uncontrolled mode
                })
            );

            act(() => {
                result.current.toggleNsfw();
            });

            expect(onReveal).not.toHaveBeenCalled();
            expect(result.current.nsfwRevealed).toBe(true);
        });
    });

    describe('controlled mode', () => {
        it('should use controlledRevealed from parent', () => {
            const onReveal = vi.fn();
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: 'status-1',
                    controlledRevealed: true,
                    onReveal,
                })
            );

            expect(result.current.nsfwRevealed).toBe(true);
            expect(result.current.isControlled).toBe(true);
        });

        it('should call onReveal when toggling from hidden to revealed', () => {
            const onReveal = vi.fn();
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: 'status-1',
                    controlledRevealed: false,
                    onReveal,
                })
            );

            act(() => {
                result.current.toggleNsfw();
            });

            expect(onReveal).toHaveBeenCalledTimes(1);
            expect(onReveal).toHaveBeenCalledWith('status-1');
        });

        it('should not call onReveal when already revealed', () => {
            const onReveal = vi.fn();
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: 'status-1',
                    controlledRevealed: true,
                    onReveal,
                })
            );

            act(() => {
                result.current.toggleNsfw();
            });

            expect(onReveal).not.toHaveBeenCalled();
        });

        it('should not call onReveal when statusId is undefined', () => {
            const onReveal = vi.fn();
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: undefined,
                    controlledRevealed: false,
                    onReveal,
                })
            );

            act(() => {
                result.current.toggleNsfw();
            });

            expect(onReveal).not.toHaveBeenCalled();
        });

        it('should not modify local state in controlled mode', () => {
            const onReveal = vi.fn();
            const { result, rerender } = renderHook(
                ({ controlledRevealed }: { controlledRevealed: boolean }) =>
                    useNsfwState({
                        statusId: 'status-1',
                        controlledRevealed,
                        onReveal,
                    }),
                { initialProps: { controlledRevealed: false } }
            );

            expect(result.current.nsfwRevealed).toBe(false);

            // Toggle in controlled mode
            act(() => {
                result.current.toggleNsfw();
            });

            // State should still be false because we're in controlled mode
            // Parent needs to update controlledRevealed
            expect(result.current.nsfwRevealed).toBe(false);

            // Simulate parent updating the controlled state
            rerender({ controlledRevealed: true });

            expect(result.current.nsfwRevealed).toBe(true);
        });

        it('should update when controlledRevealed prop changes', () => {
            const onReveal = vi.fn();
            const { result, rerender } = renderHook(
                ({ controlledRevealed }: { controlledRevealed: boolean }) =>
                    useNsfwState({
                        statusId: 'status-1',
                        controlledRevealed,
                        onReveal,
                    }),
                { initialProps: { controlledRevealed: false } }
            );

            expect(result.current.nsfwRevealed).toBe(false);

            rerender({ controlledRevealed: true });

            expect(result.current.nsfwRevealed).toBe(true);

            rerender({ controlledRevealed: false });

            expect(result.current.nsfwRevealed).toBe(false);
        });
    });

    describe('statusId handling', () => {
        it('should work without statusId in uncontrolled mode', () => {
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: undefined,
                })
            );

            expect(result.current.nsfwRevealed).toBe(false);

            act(() => {
                result.current.toggleNsfw();
            });

            expect(result.current.nsfwRevealed).toBe(true);
        });
    });

    describe('isControlled flag', () => {
        it('should return false when onReveal is undefined', () => {
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: 'status-1',
                    onReveal: undefined,
                })
            );

            expect(result.current.isControlled).toBe(false);
        });

        it('should return true when onReveal is provided', () => {
            const onReveal = vi.fn();
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: 'status-1',
                    onReveal,
                })
            );

            expect(result.current.isControlled).toBe(true);
        });
    });
});
