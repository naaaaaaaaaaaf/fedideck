import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCardInteraction, DEFAULT_INTERACTIVE_SELECTOR } from './useCardInteraction';

describe('useCardInteraction', () => {
    describe('DEFAULT_INTERACTIVE_SELECTOR', () => {
        it('should include all expected interactive elements', () => {
            expect(DEFAULT_INTERACTIVE_SELECTOR).toContain('a');
            expect(DEFAULT_INTERACTIVE_SELECTOR).toContain('button');
            expect(DEFAULT_INTERACTIVE_SELECTOR).toContain('input');
            expect(DEFAULT_INTERACTIVE_SELECTOR).toContain('label');
            expect(DEFAULT_INTERACTIVE_SELECTOR).toContain('select');
            expect(DEFAULT_INTERACTIVE_SELECTOR).toContain('textarea');
            expect(DEFAULT_INTERACTIVE_SELECTOR).toContain('video');
            expect(DEFAULT_INTERACTIVE_SELECTOR).toContain('audio');
            expect(DEFAULT_INTERACTIVE_SELECTOR).toContain('summary');
            expect(DEFAULT_INTERACTIVE_SELECTOR).toContain('[role="button"]');
        });
    });

    describe('handleClick', () => {
        it('should handle Text node as target without throwing', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            // Simulate click on a Text node (not an Element)
            const textNode = document.createTextNode('some text');
            const event = {
                target: textNode,
            } as unknown as React.MouseEvent;

            // Should not throw and should call onClick
            expect(() => result.current.handleClick(event)).not.toThrow();
            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it('should call onClick when clicking on non-interactive element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            // Simulate click on a div (non-interactive)
            const event = {
                target: document.createElement('div'),
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it('should NOT call onClick when clicking on <a> element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const anchor = document.createElement('a');
            const event = {
                target: anchor,
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when clicking on <button> element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const button = document.createElement('button');
            const event = {
                target: button,
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when clicking on <input> element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const input = document.createElement('input');
            const event = {
                target: input,
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when clicking on <label> element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const label = document.createElement('label');
            const event = {
                target: label,
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when clicking on <select> element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const select = document.createElement('select');
            const event = {
                target: select,
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when clicking on <textarea> element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const textarea = document.createElement('textarea');
            const event = {
                target: textarea,
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when clicking on <video> element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const video = document.createElement('video');
            const event = {
                target: video,
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when clicking on <audio> element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const audio = document.createElement('audio');
            const event = {
                target: audio,
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when clicking on <summary> element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const summary = document.createElement('summary');
            const event = {
                target: summary,
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when clicking on element with role="button"', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const div = document.createElement('div');
            div.setAttribute('role', 'button');
            const event = {
                target: div,
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when clicking on nested interactive element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const container = document.createElement('div');
            const button = document.createElement('button');
            container.appendChild(button);

            const event = {
                target: button,
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when isEnabled is false', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick, isEnabled: false }));

            const event = {
                target: document.createElement('div'),
            } as unknown as React.MouseEvent;

            result.current.handleClick(event);

            expect(onClick).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when onClick is undefined', () => {
            const { result } = renderHook(() => useCardInteraction({}));

            const event = {
                target: document.createElement('div'),
            } as unknown as React.MouseEvent;

            // Should not throw
            expect(() => result.current.handleClick(event)).not.toThrow();
        });
    });

    describe('handleKeyDown', () => {
        it('should handle Text node as target without throwing', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            // Simulate keyboard event on a Text node (not an Element)
            const textNode = document.createTextNode('some text');
            const event = {
                key: 'Enter',
                target: textNode,
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent;

            // Should not throw and should call onClick
            expect(() => result.current.handleKeyDown(event)).not.toThrow();
            expect(onClick).toHaveBeenCalledTimes(1);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should call onClick when pressing Enter on non-interactive element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const event = {
                key: 'Enter',
                target: document.createElement('div'),
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent;

            result.current.handleKeyDown(event);

            expect(onClick).toHaveBeenCalledTimes(1);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should call onClick when pressing Space on non-interactive element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const event = {
                key: ' ',
                target: document.createElement('div'),
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent;

            result.current.handleKeyDown(event);

            expect(onClick).toHaveBeenCalledTimes(1);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should NOT call onClick when pressing other keys', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const event = {
                key: 'Tab',
                target: document.createElement('div'),
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent;

            result.current.handleKeyDown(event);

            expect(onClick).not.toHaveBeenCalled();
            expect(event.preventDefault).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when pressing Enter on interactive element', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick }));

            const button = document.createElement('button');
            const event = {
                key: 'Enter',
                target: button,
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent;

            result.current.handleKeyDown(event);

            expect(onClick).not.toHaveBeenCalled();
            expect(event.preventDefault).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when isEnabled is false', () => {
            const onClick = vi.fn();
            const { result } = renderHook(() => useCardInteraction({ onClick, isEnabled: false }));

            const event = {
                key: 'Enter',
                target: document.createElement('div'),
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent;

            result.current.handleKeyDown(event);

            expect(onClick).not.toHaveBeenCalled();
            expect(event.preventDefault).not.toHaveBeenCalled();
        });

        it('should NOT call onClick when onClick is undefined', () => {
            const { result } = renderHook(() => useCardInteraction({}));

            const event = {
                key: 'Enter',
                target: document.createElement('div'),
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent;

            // Should not throw
            expect(() => result.current.handleKeyDown(event)).not.toThrow();
        });
    });

    describe('custom interactiveSelector', () => {
        it('should use custom selector for filtering', () => {
            const onClick = vi.fn();
            const customSelector = 'button, a'; // Only button and a
            const { result } = renderHook(() =>
                useCardInteraction({ onClick, interactiveSelector: customSelector })
            );

            // Should NOT trigger on button (in custom selector)
            const buttonEvent = {
                target: document.createElement('button'),
            } as unknown as React.MouseEvent;
            result.current.handleClick(buttonEvent);
            expect(onClick).not.toHaveBeenCalled();

            // Should trigger on input (NOT in custom selector)
            const inputEvent = {
                target: document.createElement('input'),
            } as unknown as React.MouseEvent;
            result.current.handleClick(inputEvent);
            expect(onClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('callback stability', () => {
        it('should have stable handleClick and handleKeyDown when dependencies do not change', () => {
            const onClick = vi.fn();
            const { result, rerender } = renderHook(() =>
                useCardInteraction({ onClick, isEnabled: true })
            );

            const firstHandleClick = result.current.handleClick;
            const firstHandleKeyDown = result.current.handleKeyDown;

            rerender();

            const secondHandleClick = result.current.handleClick;
            const secondHandleKeyDown = result.current.handleKeyDown;

            // Callbacks should be stable across rerenders with same deps
            expect(firstHandleClick).toBe(secondHandleClick);
            expect(firstHandleKeyDown).toBe(secondHandleKeyDown);
        });

        it('should recreate callbacks when onClick changes', () => {
            const onClick1 = vi.fn();
            const onClick2 = vi.fn();
            const { result, rerender } = renderHook(
                ({ onClick }) => useCardInteraction({ onClick }),
                { initialProps: { onClick: onClick1 } }
            );

            const firstHandleClick = result.current.handleClick;
            const firstHandleKeyDown = result.current.handleKeyDown;

            rerender({ onClick: onClick2 });

            const secondHandleClick = result.current.handleClick;
            const secondHandleKeyDown = result.current.handleKeyDown;

            // Callbacks should be recreated when onClick changes
            expect(firstHandleClick).not.toBe(secondHandleClick);
            expect(firstHandleKeyDown).not.toBe(secondHandleKeyDown);
        });

        it('should recreate callbacks when isEnabled changes', () => {
            const onClick = vi.fn();
            const { result, rerender } = renderHook(
                ({ isEnabled }) => useCardInteraction({ onClick, isEnabled }),
                { initialProps: { isEnabled: true } }
            );

            const firstHandleClick = result.current.handleClick;
            const firstHandleKeyDown = result.current.handleKeyDown;

            rerender({ isEnabled: false });

            const secondHandleClick = result.current.handleClick;
            const secondHandleKeyDown = result.current.handleKeyDown;

            // Callbacks should be recreated when isEnabled changes
            expect(firstHandleClick).not.toBe(secondHandleClick);
            expect(firstHandleKeyDown).not.toBe(secondHandleKeyDown);
        });

        it('should recreate callbacks when interactiveSelector changes', () => {
            const onClick = vi.fn();
            const { result, rerender } = renderHook(
                ({ interactiveSelector }) => useCardInteraction({ onClick, interactiveSelector }),
                { initialProps: { interactiveSelector: 'button' } }
            );

            const firstHandleClick = result.current.handleClick;
            const firstHandleKeyDown = result.current.handleKeyDown;

            rerender({ interactiveSelector: 'button, a' });

            const secondHandleClick = result.current.handleClick;
            const secondHandleKeyDown = result.current.handleKeyDown;

            // Callbacks should be recreated when interactiveSelector changes
            expect(firstHandleClick).not.toBe(secondHandleClick);
            expect(firstHandleKeyDown).not.toBe(secondHandleKeyDown);
        });
    });
});
