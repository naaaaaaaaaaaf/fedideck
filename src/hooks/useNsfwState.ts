import { useState, useEffect, useRef, useCallback } from 'react';

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
    const [localNsfwRevealed, setLocalNsfwRevealed] = useState(false);

    // Track previous statusId to reset local state when status changes
    const prevStatusIdRef = useRef(statusId);
    useEffect(() => {
        if (prevStatusIdRef.current !== statusId) {
            prevStatusIdRef.current = statusId;
            // Reset local state when statusId changes (uncontrolled mode)
            if (onReveal === undefined) {
                setLocalNsfwRevealed(false);
            }
        }
    }, [statusId, onReveal]);

    // Controlled mode: use isRevealed prop from parent
    // Uncontrolled mode: use local state
    const isControlled = onReveal !== undefined;
    const nsfwRevealed = isControlled ? (isRevealed ?? false) : localNsfwRevealed;

    // Use ref to track nsfwRevealed state without causing callback recreation
    const nsfwRevealedRef = useRef(nsfwRevealed);
    useEffect(() => {
        nsfwRevealedRef.current = nsfwRevealed;
    }, [nsfwRevealed]);

    const handleNsfwToggle = useCallback(() => {
        // Controlled mode: parent provides the state via isRevealed
        if (isControlled) {
            if (!nsfwRevealedRef.current) {
                onReveal(statusId);
            }
            return;
        }

        // Uncontrolled mode: toggle local state
        setLocalNsfwRevealed((prev) => !prev);
    }, [isControlled, onReveal, statusId]);

    return {
        nsfwRevealed,
        handleNsfwToggle,
    };
}
