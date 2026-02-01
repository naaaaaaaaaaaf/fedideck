import { useRef, useCallback } from 'react';

/**
 * Hook for inserting text at cursor position in a textarea
 * @param textareaRef - Reference to the textarea element
 * @returns Object with insertAtCursor function
 */
export function useTextareaCursor(textareaRef: React.RefObject<HTMLTextAreaElement>) {
    // Track cursor position to restore after re-renders
    const cursorPositionRef = useRef<number>(0);

    /**
     * Insert text at the current cursor position
     * If text is selected, it will be replaced
     * @param text - Text to insert
     */
    const insertAtCursor = useCallback(
        (text: string) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const currentValue = textarea.value;

            // Insert the text at cursor position
            const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);

            // Create and dispatch input event to trigger React state updates
            const inputEvent = new Event('input', { bubbles: true });
            textarea.value = newValue;
            textarea.dispatchEvent(inputEvent);

            // Move cursor to end of inserted text
            const newCursorPos = start + text.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            cursorPositionRef.current = newCursorPos;

            // Focus the textarea
            textarea.focus();
        },
        [textareaRef]
    );

    return { insertAtCursor };
}
