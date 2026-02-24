import { useState, useCallback, useEffect, useRef } from 'react';

interface UseNsfwStateOptions {
    isRevealed?: boolean;
    onReveal?: (statusId: string) => void;
    statusId: string;
}

interface UseNsfwStateReturn {
    nsfwRevealed: boolean;
    handleNsfwToggle: () => void;
}

export function useNsfwState({
    isRevealed,
    onReveal,
    statusId,
}: UseNsfwStateOptions): UseNsfwStateReturn {
    // Local state for uncontrolled mode
    // Simple boolean state - resets when statusId changes via useEffect below
    const [localNsfwRevealed, setLocalNsfwRevealed] = useState(false);

    // Track previous statusId to detect changes
    const prevStatusIdRef = useRef(statusId);

    // Reset local state when statusId changes (e.g., navigating to different status in modal)
    // This avoids the memory leak potential of a statusId-keyed dictionary while
    // still ensuring state resets on status changes for components that don't use key={}
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (prevStatusIdRef.current !== statusId) {
            prevStatusIdRef.current = statusId;
            setLocalNsfwRevealed(false);
        }
    }, [statusId]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Controlled mode: isRevealed prop is provided (read-only if no onReveal)
    // Uncontrolled mode: use local state
    const isControlled = isRevealed !== undefined;
    const nsfwRevealed = isControlled ? isRevealed : localNsfwRevealed;

    const handleNsfwToggle = useCallback(() => {
        // Controlled mode: parent provides the state via isRevealed
        if (isControlled) {
            // Only call onReveal if provided (supports read-only controlled mode)
            if (!isRevealed) {
                onReveal?.(statusId);
            }
            return;
        }

        // Uncontrolled mode: toggle local state
        setLocalNsfwRevealed((prev) => {
            const newState = !prev;
            // Also call onReveal if provided (allows parent to track reveals)
            if (newState) {
                onReveal?.(statusId);
            }
            return newState;
        });
    }, [isControlled, isRevealed, onReveal, statusId]);

    return {
        nsfwRevealed,
        handleNsfwToggle,
    };
}
