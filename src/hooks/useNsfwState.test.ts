import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNsfwState } from './useNsfwState';

describe('useNsfwState', () => {
    describe('uncontrolled mode', () => {
        it('should start with nsfwRevealed as false', () => {
            const { result } = renderHook(() => useNsfwState({ statusId: 'status-1' }));

            expect(result.current.nsfwRevealed).toBe(false);
        });

        it('should toggle local state when handleNsfwToggle is called', () => {
            const { result } = renderHook(() => useNsfwState({ statusId: 'status-1' }));

            expect(result.current.nsfwRevealed).toBe(false);

            act(() => {
                result.current.handleNsfwToggle();
            });

            expect(result.current.nsfwRevealed).toBe(true);

            act(() => {
                result.current.handleNsfwToggle();
            });

            expect(result.current.nsfwRevealed).toBe(false);
        });

        it('uncontrolled with callback: should toggle local state and call onReveal when only onReveal is provided', () => {
            // When isRevealed is undefined, the hook is uncontrolled
            // but still calls onReveal callback if provided
            const onReveal = vi.fn();
            const { result } = renderHook(() => useNsfwState({ statusId: 'status-1', onReveal }));

            expect(result.current.nsfwRevealed).toBe(false);

            act(() => {
                result.current.handleNsfwToggle();
            });

            // Should toggle local state (uncontrolled mode)
            expect(result.current.nsfwRevealed).toBe(true);
            // onReveal should be called when revealing
            expect(onReveal).toHaveBeenCalledWith('status-1');
            expect(onReveal).toHaveBeenCalledTimes(1);
        });
    });

    describe('controlled mode', () => {
        describe('read-only mode (isRevealed only)', () => {
            it('should use isRevealed prop when only isRevealed is provided', () => {
                const { result } = renderHook(() =>
                    useNsfwState({
                        statusId: 'status-1',
                        isRevealed: true,
                    })
                );

                expect(result.current.nsfwRevealed).toBe(true);
            });

            it('should NOT toggle local state when only isRevealed is provided', () => {
                const { result } = renderHook(() =>
                    useNsfwState({
                        statusId: 'status-1',
                        isRevealed: false,
                    })
                );

                expect(result.current.nsfwRevealed).toBe(false);

                // Toggle should be ignored (read-only controlled)
                act(() => {
                    result.current.handleNsfwToggle();
                });

                // Should still be false because isRevealed prop controls the state
                expect(result.current.nsfwRevealed).toBe(false);
            });

            it('should update nsfwRevealed when isRevealed prop changes (read-only)', () => {
                const { result, rerender } = renderHook(
                    ({ isRevealed }) =>
                        useNsfwState({
                            statusId: 'status-1',
                            isRevealed,
                        }),
                    { initialProps: { isRevealed: false } }
                );

                expect(result.current.nsfwRevealed).toBe(false);

                rerender({ isRevealed: true });

                expect(result.current.nsfwRevealed).toBe(true);
            });
        });

        it('should use isRevealed prop when onReveal is provided', () => {
            const onReveal = vi.fn();
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: 'status-1',
                    isRevealed: true,
                    onReveal,
                })
            );

            expect(result.current.nsfwRevealed).toBe(true);
        });

        it('should call onReveal callback when revealing', () => {
            const onReveal = vi.fn();
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: 'status-1',
                    isRevealed: false,
                    onReveal,
                })
            );

            act(() => {
                result.current.handleNsfwToggle();
            });

            expect(onReveal).toHaveBeenCalledWith('status-1');
            expect(onReveal).toHaveBeenCalledTimes(1);
        });

        it('should NOT call onReveal when already revealed', () => {
            const onReveal = vi.fn();
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: 'status-1',
                    isRevealed: true,
                    onReveal,
                })
            );

            act(() => {
                result.current.handleNsfwToggle();
            });

            expect(onReveal).not.toHaveBeenCalled();
        });

        it('should update nsfwRevealed when isRevealed prop changes', () => {
            const onReveal = vi.fn();
            const { result, rerender } = renderHook(
                ({ isRevealed }) =>
                    useNsfwState({
                        statusId: 'status-1',
                        isRevealed,
                        onReveal,
                    }),
                { initialProps: { isRevealed: false } }
            );

            expect(result.current.nsfwRevealed).toBe(false);

            rerender({ isRevealed: true });

            expect(result.current.nsfwRevealed).toBe(true);

            rerender({ isRevealed: false });

            expect(result.current.nsfwRevealed).toBe(false);
        });
    });

    describe('callback stability', () => {
        it('should have stable handleNsfwToggle reference', () => {
            const onReveal = vi.fn();
            const { result, rerender } = renderHook(() =>
                useNsfwState({
                    statusId: 'status-1',
                    isRevealed: false,
                    onReveal,
                })
            );

            const firstToggle = result.current.handleNsfwToggle;

            rerender();

            const secondToggle = result.current.handleNsfwToggle;

            // Callback should be stable across rerenders
            expect(firstToggle).toBe(secondToggle);
        });

        it('should have stable handleNsfwToggle in uncontrolled mode', () => {
            const { result, rerender } = renderHook(() => useNsfwState({ statusId: 'status-1' }));

            const firstToggle = result.current.handleNsfwToggle;

            rerender();

            const secondToggle = result.current.handleNsfwToggle;

            // Callback should be stable across rerenders
            expect(firstToggle).toBe(secondToggle);
        });
    });

    describe('statusId handling', () => {
        it('should use correct statusId in onReveal callback', () => {
            const onReveal = vi.fn();
            const { result } = renderHook(() =>
                useNsfwState({
                    statusId: 'custom-status-id',
                    isRevealed: false,
                    onReveal,
                })
            );

            act(() => {
                result.current.handleNsfwToggle();
            });

            expect(onReveal).toHaveBeenCalledWith('custom-status-id');
        });

        it('should update statusId when prop changes', () => {
            const onReveal = vi.fn();
            const { result, rerender } = renderHook(
                ({ statusId }) =>
                    useNsfwState({
                        statusId,
                        isRevealed: false,
                        onReveal,
                    }),
                { initialProps: { statusId: 'status-1' } }
            );

            rerender({ statusId: 'status-2' });

            act(() => {
                result.current.handleNsfwToggle();
            });

            expect(onReveal).toHaveBeenCalledWith('status-2');
        });
    });
});
