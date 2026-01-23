import { useCallback, useEffect, useRef } from 'react';

export interface UseModalAccessibilityOptions {
    isOpen: boolean;
    onClose: () => void;
    closeButtonRef: React.RefObject<HTMLButtonElement | null>;
    modalRef: React.RefObject<HTMLDivElement | null>;
    canClose?: boolean;
}

export interface UseModalAccessibilityReturn {
    handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Custom hook for modal accessibility features.
 * Provides:
 * - Focus management (save previous focus, restore on close)
 * - Focus trap (Tab/Shift+Tab cycles within modal)
 * - ESC key to close (when canClose is true)
 */
export function useModalAccessibility({
    isOpen,
    onClose,
    closeButtonRef,
    modalRef,
    canClose = true,
}: UseModalAccessibilityOptions): UseModalAccessibilityReturn {
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);

    // Focus management: save previous focus, move to close button, restore on close
    useEffect(() => {
        if (isOpen) {
            // Save currently focused element
            previouslyFocusedRef.current = document.activeElement as HTMLElement;
            // Move focus to close button
            closeButtonRef.current?.focus();
        } else {
            // Restore focus to previously focused element
            previouslyFocusedRef.current?.focus();
            previouslyFocusedRef.current = null;
        }
    }, [isOpen, closeButtonRef]);

    // Handle keyboard events for focus trap and ESC to close
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Escape' && canClose) {
                e.preventDefault();
                onClose();
                return;
            }

            if (e.key === 'Tab' && modalRef.current) {
                const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );

                if (focusableElements.length === 0) return;

                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    // Shift+Tab: if on first element, move to last
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement?.focus();
                    }
                } else {
                    // Tab: if on last element, move to first
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement?.focus();
                    }
                }
            }
        },
        [onClose, canClose, modalRef]
    );

    return { handleKeyDown };
}
