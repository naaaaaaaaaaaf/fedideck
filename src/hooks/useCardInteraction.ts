import { useCallback } from 'react';

const DEFAULT_INTERACTIVE_SELECTOR =
    'a, button, input, label, select, textarea, video, audio, summary, [role="button"]';

interface UseCardInteractionOptions {
    onClick?: () => void;
    isEnabled?: boolean;
    interactiveSelector?: string;
}

interface UseCardInteractionReturn {
    handleClick: (e: React.MouseEvent) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useCardInteraction({
    onClick,
    isEnabled = true,
    interactiveSelector = DEFAULT_INTERACTIVE_SELECTOR,
}: UseCardInteractionOptions): UseCardInteractionReturn {
    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            if (!isEnabled || !onClick) return;

            // Guard: e.target may be a Text node, not an Element
            const target = e.target;
            if (target instanceof Element && target.closest(interactiveSelector)) {
                return;
            }
            onClick();
        },
        [isEnabled, onClick, interactiveSelector]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (!isEnabled || !onClick) return;

            if (e.key === 'Enter' || e.key === ' ') {
                // Guard: e.target may be a Text node, not an Element
                const target = e.target;
                if (target instanceof Element && target.closest(interactiveSelector)) {
                    return;
                }
                e.preventDefault();
                onClick();
            }
        },
        [isEnabled, onClick, interactiveSelector]
    );

    return {
        handleClick,
        handleKeyDown,
    };
}

export { DEFAULT_INTERACTIVE_SELECTOR };
