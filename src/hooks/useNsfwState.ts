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
    /**
     * Override controlled mode detection.
     * By default, controlled mode is determined by presence of onReveal callback.
     * Set to true to force controlled mode even without onReveal (e.g., read-only mode).
     */
    isControlled?: boolean;
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
    const {
        statusId,
        controlledRevealed = false,
        onReveal,
        isControlled: isControlledOverride,
    } = options;

    // Local state for uncontrolled mode
    const [localRevealed, setLocalRevealed] = useState(false);

    // Determine if we're in controlled mode (use override if provided, otherwise detect from onReveal)
    const isControlled = isControlledOverride ?? onReveal !== undefined;

    // Reset local state when statusId changes (in uncontrolled mode)
    // This is a valid use case for setState in useEffect - we need to reset
    // the local revealed state when viewing a different status
    useEffect(() => {
        if (!isControlled) {
            setLocalRevealed(false); // eslint-disable-line react-hooks/set-state-in-effect
        }
    }, [statusId, isControlled]);

    // Use controlled state if provided, otherwise use local state
    const nsfwRevealed = isControlled ? controlledRevealed : localRevealed;

    // Use ref to track nsfwRevealed state without causing callback recreation
    const nsfwRevealedRef = useRef(nsfwRevealed);
    useEffect(() => {
        nsfwRevealedRef.current = nsfwRevealed;
    }, [nsfwRevealed]);

    // Toggle handler
    const toggleNsfw = useCallback(() => {
        // Notify parent if callback provided and not yet revealed
        if (onReveal && statusId && !nsfwRevealedRef.current) {
            onReveal(statusId);
        }

        // Toggle local state in uncontrolled mode
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
