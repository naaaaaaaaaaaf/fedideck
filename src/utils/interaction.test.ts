import { describe, it, expect, vi } from 'vitest';
import { shouldIgnoreClick, shouldIgnoreKeyEvent, INTERACTIVE_SELECTOR } from './interaction';

describe('interaction utilities', () => {
    describe('INTERACTIVE_SELECTOR', () => {
        it('should contain common interactive element selectors', () => {
            expect(INTERACTIVE_SELECTOR).toContain('a');
            expect(INTERACTIVE_SELECTOR).toContain('button');
            expect(INTERACTIVE_SELECTOR).toContain('input');
            expect(INTERACTIVE_SELECTOR).toContain('label');
            expect(INTERACTIVE_SELECTOR).toContain('select');
            expect(INTERACTIVE_SELECTOR).toContain('textarea');
            expect(INTERACTIVE_SELECTOR).toContain('video');
            expect(INTERACTIVE_SELECTOR).toContain('audio');
            expect(INTERACTIVE_SELECTOR).toContain('summary');
            expect(INTERACTIVE_SELECTOR).toContain('[role="button"]');
        });
    });

    describe('shouldIgnoreClick', () => {
        it('should return true when defaultPrevented is true', () => {
            const event = {
                defaultPrevented: true,
                target: document.createElement('div'),
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });

        it('should return true when target is an anchor element', () => {
            const anchor = document.createElement('a');
            const event = {
                defaultPrevented: false,
                target: anchor,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });

        it('should return true when target is inside an anchor element', () => {
            const anchor = document.createElement('a');
            const span = document.createElement('span');
            anchor.appendChild(span);

            const event = {
                defaultPrevented: false,
                target: span,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });

        it('should return true when target is a button element', () => {
            const button = document.createElement('button');
            const event = {
                defaultPrevented: false,
                target: button,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });

        it('should return true when target is an input element', () => {
            const input = document.createElement('input');
            const event = {
                defaultPrevented: false,
                target: input,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });

        it('should return true when target is a label element', () => {
            const label = document.createElement('label');
            const event = {
                defaultPrevented: false,
                target: label,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });

        it('should return true when target is a select element', () => {
            const select = document.createElement('select');
            const event = {
                defaultPrevented: false,
                target: select,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });

        it('should return true when target is a textarea element', () => {
            const textarea = document.createElement('textarea');
            const event = {
                defaultPrevented: false,
                target: textarea,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });

        it('should return true when target has role="button"', () => {
            const div = document.createElement('div');
            div.setAttribute('role', 'button');
            const event = {
                defaultPrevented: false,
                target: div,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });

        it('should return false when target is a non-interactive element', () => {
            const div = document.createElement('div');
            const event = {
                defaultPrevented: false,
                target: div,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(false);
        });

        it('should return false when target is a span not inside interactive element', () => {
            const span = document.createElement('span');
            const event = {
                defaultPrevented: false,
                target: span,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(false);
        });

        it('should return false when target is null', () => {
            const event = {
                defaultPrevented: false,
                target: null,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(false);
        });

        it('should use custom selector when provided', () => {
            const div = document.createElement('div');
            div.className = 'no-click';
            const event = {
                defaultPrevented: false,
                target: div,
            } as unknown as Event;

            // Should not match default selector
            expect(shouldIgnoreClick(event)).toBe(false);

            // Should match custom selector
            expect(shouldIgnoreClick(event, '.no-click')).toBe(true);
        });

        it('should handle video elements', () => {
            const video = document.createElement('video');
            const event = {
                defaultPrevented: false,
                target: video,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });

        it('should handle audio elements', () => {
            const audio = document.createElement('audio');
            const event = {
                defaultPrevented: false,
                target: audio,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });

        it('should handle summary elements (details/summary)', () => {
            const summary = document.createElement('summary');
            const event = {
                defaultPrevented: false,
                target: summary,
            } as unknown as Event;

            expect(shouldIgnoreClick(event)).toBe(true);
        });
    });

    describe('shouldIgnoreKeyEvent', () => {
        it('should return true for non-Enter/Space keys', () => {
            const event = {
                key: 'Tab',
                defaultPrevented: false,
                target: document.createElement('div'),
            } as unknown as React.KeyboardEvent;

            expect(shouldIgnoreKeyEvent(event)).toBe(true);
        });

        it('should return true for Tab key', () => {
            const event = {
                key: 'Tab',
                defaultPrevented: false,
                target: document.createElement('div'),
            } as unknown as React.KeyboardEvent;

            expect(shouldIgnoreKeyEvent(event)).toBe(true);
        });

        it('should return true for Escape key', () => {
            const event = {
                key: 'Escape',
                defaultPrevented: false,
                target: document.createElement('div'),
            } as unknown as React.KeyboardEvent;

            expect(shouldIgnoreKeyEvent(event)).toBe(true);
        });

        it('should return false for Enter key on non-interactive element', () => {
            const div = document.createElement('div');
            const event = {
                key: 'Enter',
                defaultPrevented: false,
                target: div,
            } as unknown as React.KeyboardEvent;

            expect(shouldIgnoreKeyEvent(event)).toBe(false);
        });

        it('should return false for Space key on non-interactive element', () => {
            const div = document.createElement('div');
            const event = {
                key: ' ',
                defaultPrevented: false,
                target: div,
            } as unknown as React.KeyboardEvent;

            expect(shouldIgnoreKeyEvent(event)).toBe(false);
        });

        it('should return true for Enter key on interactive element', () => {
            const button = document.createElement('button');
            const event = {
                key: 'Enter',
                defaultPrevented: false,
                target: button,
            } as unknown as React.KeyboardEvent;

            expect(shouldIgnoreKeyEvent(event)).toBe(true);
        });

        it('should return true for Space key on interactive element', () => {
            const button = document.createElement('button');
            const event = {
                key: ' ',
                defaultPrevented: false,
                target: button,
            } as unknown as React.KeyboardEvent;

            expect(shouldIgnoreKeyEvent(event)).toBe(true);
        });

        it('should use custom selector when provided', () => {
            const div = document.createElement('div');
            div.className = 'no-key';
            const event = {
                key: 'Enter',
                defaultPrevented: false,
                target: div,
            } as unknown as React.KeyboardEvent;

            // Should not match default selector
            expect(shouldIgnoreKeyEvent(event)).toBe(false);

            // Should match custom selector
            expect(shouldIgnoreKeyEvent(event, '.no-key')).toBe(true);
        });
    });
});
