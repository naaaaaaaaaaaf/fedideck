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
 * Checks if an element is visible and focusable.
 * Filters out hidden inputs, elements with display:none or visibility:hidden,
 * and elements within hidden containers.
 */
function isElementVisible(element: HTMLElement): boolean {
    // Check if element is hidden input
    if (element.tagName === 'INPUT' && (element as HTMLInputElement).type === 'hidden') {
        return false;
    }

    // Check computed styles
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
    }

    // Check if any parent has display:none or visibility:hidden
    let parent = element.parentElement;
    while (parent) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
            return false;
        }
        parent = parent.parentElement;
    }

    return true;
}

/**
 * Gets all focusable elements within a container that are actually visible and interactive.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    const elements = container.querySelectorAll<HTMLElement>(selector);
    return Array.from(elements).filter(isElementVisible);
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
            
            // Move focus to close button if it exists, otherwise focus first focusable element
            if (closeButtonRef.current) {
                closeButtonRef.current.focus();
            } else if (modalRef.current) {
                // Find first focusable element as fallback
                const focusableElements = getFocusableElements(modalRef.current);
                focusableElements[0]?.focus();
            }
        } else {
            // Restore focus to previously focused element
            previouslyFocusedRef.current?.focus();
            previouslyFocusedRef.current = null;
        }
    }, [isOpen, closeButtonRef, modalRef]);

    // Monitor focus and restore to safe element if lost
    useEffect(() => {
        if (!isOpen || !modalRef.current) return;

        const checkFocus = () => {
            const activeElement = document.activeElement;
            
            // Check if focus is lost or outside the modal
            if (!activeElement || !modalRef.current?.contains(activeElement)) {
                // Find a safe element to focus on
                if (closeButtonRef.current) {
                    closeButtonRef.current.focus();
                } else if (modalRef.current) {
                    const focusableElements = getFocusableElements(modalRef.current);
                    if (focusableElements.length > 0) {
                        focusableElements[0].focus();
                    }
                }
            }
        };

        // Use MutationObserver to detect DOM changes that might remove focused element
        const observer = new MutationObserver(() => {
            // Small delay to allow React to complete DOM updates
            requestAnimationFrame(checkFocus);
        });

        observer.observe(modalRef.current, {
            childList: true,
            subtree: true,
        });

        return () => observer.disconnect();
    }, [isOpen, modalRef, closeButtonRef]);

    // Handle keyboard events for focus trap and ESC to close
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Escape' && canClose) {
                e.preventDefault();
                onClose();
                return;
            }

            if (e.key === 'Tab' && modalRef.current) {
                const focusableElements = getFocusableElements(modalRef.current);

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
