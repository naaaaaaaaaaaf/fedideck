import { useState, useEffect } from 'react';
import { formatTimeRemaining } from '../utils/dateFormat';

/**
 * Hook for real-time poll countdown display
 * Updates every 30 seconds
 */
export function usePollCountdown(expiresAt: string | null): string | null {
    const [remaining, setRemaining] = useState(() => formatTimeRemaining(expiresAt));

    useEffect(() => {
        if (!expiresAt) {
            // Clear remaining time when expiresAt becomes null
            // This is a valid pattern for responding to prop changes
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRemaining(null);
            return;
        }

        const updateRemaining = () => {
            setRemaining(formatTimeRemaining(expiresAt));
        };

        // Update immediately
        updateRemaining();

        // Update every 30 seconds
        const intervalId = setInterval(updateRemaining, 30000);

        return () => clearInterval(intervalId);
    }, [expiresAt]);

    return remaining;
}
