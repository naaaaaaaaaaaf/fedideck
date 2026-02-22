import type React from 'react';

/**
 * CSS selector for interactive elements that should block card click events.
 * These elements have their own click handlers and should not trigger the card's
 * onClick handler.
 */
export const INTERACTIVE_SELECTOR =
    'a, button, input, label, select, textarea, video, audio, summary, [role="button"]';

function getTarget(event: Event | React.SyntheticEvent): Element | null {
    const target = event.target;
    return target instanceof Element ? target : null;
}

/**
 * Determines whether a click event should be ignored (not propagated to card click handler).
 * Returns true if:
 * - The event's default action has been prevented
 * - The click target is an interactive element (or contained within one)
 *
 * @param event - The click event to check
 * @param selector - CSS selector for interactive elements (defaults to INTERACTIVE_SELECTOR)
 * @returns true if the click should be ignored, false otherwise
 */
export function shouldIgnoreClick(
    event: Event | React.SyntheticEvent,
    selector: string = INTERACTIVE_SELECTOR
): boolean {
    if ('defaultPrevented' in event && event.defaultPrevented) return true;
    const target = getTarget(event);
    return target ? target.closest(selector) !== null : false;
}

/**
 * Determines whether a keyboard event (Enter/Space) should be ignored.
 * Returns true if:
 * - The key is not Enter or Space
 * - The event target is an interactive element
 *
 * @param event - The keyboard event to check
 * @param selector - CSS selector for interactive elements (defaults to INTERACTIVE_SELECTOR)
 * @returns true if the key event should be ignored, false otherwise
 */
export function shouldIgnoreKeyEvent(
    event: React.KeyboardEvent,
    selector: string = INTERACTIVE_SELECTOR
): boolean {
    if (event.key !== 'Enter' && event.key !== ' ') return true;
    return shouldIgnoreClick(event, selector);
}
