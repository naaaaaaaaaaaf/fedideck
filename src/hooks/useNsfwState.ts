import { useState, useCallback } from 'react';

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
    // Keyed by statusId to reset when status changes
    const [localNsfwRevealedByKey, setLocalNsfwRevealedByKey] = useState<Record<string, boolean>>(
        {}
    );

    // Controlled mode: isRevealed prop is provided (read-only if no onReveal)
    // Uncontrolled mode: use local state keyed by statusId
    const isControlled = isRevealed !== undefined;
    const nsfwRevealed = isControlled ? isRevealed : (localNsfwRevealedByKey[statusId] ?? false);

    const handleNsfwToggle = useCallback(() => {
        // Controlled mode: parent provides the state via isRevealed
        if (isControlled) {
            // Only call onReveal if provided (supports read-only controlled mode)
            if (!isRevealed) {
                onReveal?.(statusId);
            }
            return;
        }

        // Uncontrolled mode: toggle local state for this statusId
        const newRevealedState = !(localNsfwRevealedByKey[statusId] ?? false);
        setLocalNsfwRevealedByKey((prev) => ({
            ...prev,
            [statusId]: newRevealedState,
        }));

        // Also call onReveal if provided (allows parent to track reveals)
        if (newRevealedState) {
            onReveal?.(statusId);
        }
    }, [isControlled, isRevealed, onReveal, statusId, localNsfwRevealedByKey]);

    return {
        nsfwRevealed,
        handleNsfwToggle,
    };
}
