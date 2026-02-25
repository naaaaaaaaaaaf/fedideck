import { useState, useEffect } from 'react';
import { formatTimeRemaining } from '../utils/dateFormat';

/**
 * Hook for real-time poll countdown display
 * Updates every 30 seconds
 */
export function usePollCountdown(expiresAt: string | null): string | null {
    const [remaining, setRemaining] = useState(() => formatTimeRemaining(expiresAt));

    useEffect(() => {
        const updateRemaining = () => {
            setRemaining(formatTimeRemaining(expiresAt));
        };

        // Update immediately (formatTimeRemaining returns null for null input)
        updateRemaining();

        // Only set interval if expiresAt is valid
        if (!expiresAt) return;

        const intervalId = setInterval(updateRemaining, 30000);
        return () => clearInterval(intervalId);
    }, [expiresAt]);

    return remaining;
}
