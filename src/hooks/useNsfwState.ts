import { useState, useEffect, useRef, useCallback } from 'react';

interface UseNsfwStateOptions {
    /**
     * Optional status ID for controlled mode callback.
     * If not provided, the onReveal callback will not receive an ID.
     */
    statusId?: string;
    /**
     * External controlled state.
     * If undefined, the hook operates in uncontrolled mode with local state.
     */
    controlledRevealed?: boolean;
    /**
     * Callback when NSFW content is revealed in controlled mode.
     */
    onReveal?: (statusId: string) => void;
}

interface UseNsfwStateReturn {
    /** Current NSFW revealed state */
    nsfwRevealed: boolean;
    /** Toggle NSFW revealed state */
    toggleNsfw: () => void;
    /** Whether the hook is in controlled mode */
    isControlled: boolean;
}

/**
 * Hook for managing NSFW (Not Safe For Work) content reveal state.
 *
 * Supports two modes:
 * - Controlled mode: When onReveal callback is provided, uses controlledRevealed from parent
 * - Uncontrolled mode: When onReveal is not provided, manages local state internally
 *
 * @param options - Configuration options
 * @returns NSFW state and toggle function
 */
export function useNsfwState(options: UseNsfwStateOptions): UseNsfwStateReturn {
    const { statusId, controlledRevealed = false, onReveal } = options;

    // Local state for uncontrolled mode
    const [localRevealed, setLocalRevealed] = useState(false);

    // Determine if we're in controlled mode
    const isControlled = onReveal !== undefined;

    // Use controlled state if provided, otherwise use local state
    const nsfwRevealed = isControlled ? controlledRevealed : localRevealed;

    // Use ref to track nsfwRevealed state without causing callback recreation
    const nsfwRevealedRef = useRef(nsfwRevealed);
    useEffect(() => {
        nsfwRevealedRef.current = nsfwRevealed;
    }, [nsfwRevealed]);

    // Toggle handler
    const toggleNsfw = useCallback(() => {
        // Controlled mode: notify parent
        if (onReveal && statusId && !nsfwRevealedRef.current) {
            onReveal(statusId);
            return;
        }

        // Uncontrolled mode: toggle local state
        if (!isControlled) {
            setLocalRevealed((prev) => !prev);
        }
    }, [onReveal, statusId, isControlled]);

    return {
        nsfwRevealed,
        toggleNsfw,
        isControlled,
    };
}
