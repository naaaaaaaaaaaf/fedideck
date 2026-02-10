import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTextareaCursor } from './useTextareaCursor';

describe('useTextareaCursor', () => {
    let mockTextarea: HTMLTextAreaElement;

    beforeEach(() => {
        mockTextarea = {
            value: '',
            selectionStart: 0,
            selectionEnd: 0,
            setSelectionRange: vi.fn(),
            focus: vi.fn(),
            dispatchEvent: vi.fn(),
        } as unknown as HTMLTextAreaElement;
    });

    it('should insert text at cursor position', () => {
        mockTextarea.value = 'Hello world';
        mockTextarea.selectionStart = 5;
        mockTextarea.selectionEnd = 5;

        const ref = { current: mockTextarea };
        const { insertAtCursor } = renderHook(() => useTextareaCursor(ref)).result.current;

        insertAtCursor(' BEAUTIFUL');

        expect(mockTextarea.value).toBe('Hello BEAUTIFUL world');
        expect(mockTextarea.setSelectionRange).toHaveBeenCalledWith(15, 15);
        expect(mockTextarea.focus).toHaveBeenCalled();
    });

    it('should replace selected text', () => {
        mockTextarea.value = 'Hello world';
        mockTextarea.selectionStart = 6;
        mockTextarea.selectionEnd = 11;

        const ref = { current: mockTextarea };
        const { insertAtCursor } = renderHook(() => useTextareaCursor(ref)).result.current;

        insertAtCursor('there');

        expect(mockTextarea.value).toBe('Hello there');
        expect(mockTextarea.setSelectionRange).toHaveBeenCalledWith(11, 11);
    });

    it('should insert at beginning when cursor is at start', () => {
        mockTextarea.value = 'Hello world';
        mockTextarea.selectionStart = 0;
        mockTextarea.selectionEnd = 0;

        const ref = { current: mockTextarea };
        const { insertAtCursor } = renderHook(() => useTextareaCursor(ref)).result.current;

        insertAtCursor('Hey! ');

        expect(mockTextarea.value).toBe('Hey! Hello world');
        expect(mockTextarea.setSelectionRange).toHaveBeenCalledWith(5, 5);
    });

    it('should insert at end when cursor is at end', () => {
        mockTextarea.value = 'Hello world';
        mockTextarea.selectionStart = 11;
        mockTextarea.selectionEnd = 11;

        const ref = { current: mockTextarea };
        const { insertAtCursor } = renderHook(() => useTextareaCursor(ref)).result.current;

        insertAtCursor('!!!');

        expect(mockTextarea.value).toBe('Hello world!!!');
        expect(mockTextarea.setSelectionRange).toHaveBeenCalledWith(14, 14);
    });

    it('should insert into empty textarea', () => {
        mockTextarea.value = '';
        mockTextarea.selectionStart = 0;
        mockTextarea.selectionEnd = 0;

        const ref = { current: mockTextarea };
        const { insertAtCursor } = renderHook(() => useTextareaCursor(ref)).result.current;

        insertAtCursor('Hello');

        expect(mockTextarea.value).toBe('Hello');
        expect(mockTextarea.setSelectionRange).toHaveBeenCalledWith(5, 5);
    });

    it('should dispatch input event for React state updates', () => {
        mockTextarea.value = 'Hello';
        mockTextarea.selectionStart = 5;
        mockTextarea.selectionEnd = 5;

        const ref = { current: mockTextarea };
        const { insertAtCursor } = renderHook(() => useTextareaCursor(ref)).result.current;

        insertAtCursor(' world');

        expect(mockTextarea.dispatchEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'input', bubbles: true })
        );
    });

    it('should do nothing when textarea ref is null', () => {
        const ref = { current: null as HTMLTextAreaElement | null };
        const { insertAtCursor } = renderHook(() => useTextareaCursor(ref)).result.current;

        // Should not throw
        expect(() => insertAtCursor('test')).not.toThrow();
    });

    it('should handle emoji shortcode format', () => {
        mockTextarea.value = 'Check this out ';
        mockTextarea.selectionStart = 16;
        mockTextarea.selectionEnd = 16;

        const ref = { current: mockTextarea };
        const { insertAtCursor } = renderHook(() => useTextareaCursor(ref)).result.current;

        insertAtCursor(':custom_emoji:');

        expect(mockTextarea.value).toBe('Check this out :custom_emoji:');
        expect(mockTextarea.setSelectionRange).toHaveBeenCalledWith(30, 30);
    });
});
