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
 * Checks if an element is still in the document and can be focused.
 */
function canElementBeFocused(element: HTMLElement | null): boolean {
    if (!element || !document.contains(element)) {
        return false;
    }

    // Check if element is disabled
    if ('disabled' in element && (element as HTMLButtonElement | HTMLInputElement).disabled) {
        return false;
    }

    // Check if element or its parents are hidden
    let current: HTMLElement | null = element;
    while (current) {
        const style = window.getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        // Check hidden attribute
        if (current.hasAttribute('hidden')) {
            return false;
        }
        current = current.parentElement;
    }

    return true;
}

/**
 * Checks if an element is visible and focusable.
 * Optimized version that stops traversing at the modal container boundary.
 */
function isElementVisible(element: HTMLElement, modalContainer?: HTMLElement): boolean {
    // Check if element is hidden input
    if (element.tagName === 'INPUT' && (element as HTMLInputElement).type === 'hidden') {
        return false;
    }

    // Check element's own styles and hidden attribute
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || element.hasAttribute('hidden')) {
        return false;
    }

    // Check parent elements up to modal container (optimization: don't traverse beyond modal)
    let parent = element.parentElement;
    while (parent && parent !== modalContainer) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parent.hasAttribute('hidden')) {
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
    // More specific selector to exclude hidden elements upfront
    // Note: :not([tabindex="-1"]) is added to all selectors to exclude elements
    // that are programmatically focusable but not part of the tab sequence
    const selector = [
        'button:not([disabled]):not([hidden]):not([tabindex="-1"])',
        '[href]:not([hidden]):not([tabindex="-1"])',
        'input:not([disabled]):not([type="hidden"]):not([hidden]):not([tabindex="-1"])',
        'select:not([disabled]):not([hidden]):not([tabindex="-1"])',
        'textarea:not([disabled]):not([hidden]):not([tabindex="-1"])',
        '[tabindex]:not([tabindex="-1"]):not([hidden])'
    ].join(', ');

    const elements = container.querySelectorAll<HTMLElement>(selector);
    // Pass modalContainer to optimize visibility check
    // Filter out elements with negative tabindex (other than -1 which is already excluded in selector)
    return Array.from(elements).filter(el => {
        const tabindex = el.getAttribute('tabindex');
        const tabindexValue = tabindex ? parseInt(tabindex, 10) : null;
        // Exclude elements with negative tabindex values other than -1
        if (tabindexValue !== null && tabindexValue < 0) {
            return false;
        }
        return isElementVisible(el, container);
    });
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
            
            // Move focus to close button if it exists and is focusable, otherwise focus first focusable element
            if (closeButtonRef.current && canElementBeFocused(closeButtonRef.current)) {
                closeButtonRef.current.focus();
            } else if (modalRef.current) {
                // Find first focusable element as fallback
                const focusableElements = getFocusableElements(modalRef.current);
                focusableElements[0]?.focus();
            }
        } else {
            // Restore focus to previously focused element if it's still focusable
            const previousElement = previouslyFocusedRef.current;
            if (previousElement && canElementBeFocused(previousElement)) {
                previousElement.focus();
            } else if (previousElement) {
                // Fallback: focus body if previous element is no longer focusable
                document.body.focus();
            }
            previouslyFocusedRef.current = null;
        }
    }, [isOpen, closeButtonRef, modalRef]);

    // Monitor focus and restore to safe element if lost
    useEffect(() => {
        if (!isOpen || !modalRef.current) return;

        const handleFocusOut = () => {
            // Capture stable references before setTimeout to avoid stale closure issues
            const modal = modalRef.current;
            const closeButton = closeButtonRef.current;

            // Use setTimeout to allow the new focus target to be set
            setTimeout(() => {
                // Check if modal still exists (could have been unmounted)
                if (!modal) return;

                const activeElement = document.activeElement;
                
                // Check if focus is lost or moved outside the modal
                if (!activeElement || activeElement === document.body || !modal.contains(activeElement)) {
                    // Find a safe element to focus on
                    if (closeButton && canElementBeFocused(closeButton)) {
                        closeButton.focus();
                    } else {
                        const focusableElements = getFocusableElements(modal);
                        if (focusableElements.length > 0) {
                            focusableElements[0].focus();
                        }
                    }
                }
            }, 0);
        };

        // Listen for focusout events on the modal
        const currentModal = modalRef.current;
        currentModal.addEventListener('focusout', handleFocusOut);

        return () => {
            currentModal.removeEventListener('focusout', handleFocusOut);
        };
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
