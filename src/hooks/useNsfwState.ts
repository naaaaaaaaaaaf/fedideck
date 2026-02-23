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

    // Controlled mode: use isRevealed prop from parent
    // Uncontrolled mode: use local state keyed by statusId
    const isControlled = onReveal !== undefined;
    const nsfwRevealed = isControlled
        ? (isRevealed ?? false)
        : (localNsfwRevealedByKey[statusId] ?? false);

    const handleNsfwToggle = useCallback(() => {
        // Controlled mode: parent provides the state via isRevealed
        if (isControlled) {
            if (!isRevealed) {
                onReveal(statusId);
            }
            return;
        }

        // Uncontrolled mode: toggle local state for this statusId
        setLocalNsfwRevealedByKey((prev) => ({
            ...prev,
            [statusId]: !(prev[statusId] ?? false),
        }));
    }, [isControlled, isRevealed, onReveal, statusId]);

    return {
        nsfwRevealed,
        handleNsfwToggle,
    };
}
