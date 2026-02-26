import { useState, useEffect, useRef } from 'react';
import { getClient, type AccountSession } from '../api/mastoClient';
import { getInstanceConfig, getDefaultConfig, type InstanceConfig } from '../api/instanceConfig';

interface UseInstanceConfigOptions {
    accountSession: AccountSession | null | undefined;
    isOpen?: boolean; // Optional: if omitted, fetches when accountSession is available
}

interface UseInstanceConfigReturn {
    instanceConfig: InstanceConfig | null;
    isLoading: boolean;
}

/**
 * Hook for fetching and managing instance configuration
 * Uses race condition handling pattern from usePollState
 */
export function useInstanceConfig({
    accountSession,
    isOpen = true, // Default to true for backward compatibility
}: UseInstanceConfigOptions): UseInstanceConfigReturn {
    const [instanceConfig, setInstanceConfig] = useState<InstanceConfig | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Race condition control: track request sequence
    const requestSeqRef = useRef(0);
    const activeContextRef = useRef<{
        accountId: string | null;
        instanceUrl: string | null;
    }>({
        accountId: null,
        instanceUrl: null,
    });

    useEffect(() => {
        // Don't fetch if modal is closed or no account selected
        if (!accountSession || !isOpen) {
            setInstanceConfig(null);
            setIsLoading(false);
            return;
        }

        const instanceUrl = accountSession.instanceUrl;
        const accountId = accountSession.id;

        // Check if context changed
        const contextChanged =
            activeContextRef.current.accountId !== accountId ||
            activeContextRef.current.instanceUrl !== instanceUrl;

        // Update active context
        activeContextRef.current = { accountId, instanceUrl };

        // Reset config when account changes
        if (contextChanged) {
            setInstanceConfig(null);
        }

        // Increment request generation for this effect run
        const requestSeq = ++requestSeqRef.current;

        setIsLoading(true);

        const client = getClient(accountSession);
        getInstanceConfig(client, instanceUrl)
            .then((config) => {
                // Race condition guard: only apply if context hasn't changed
                if (
                    requestSeq !== requestSeqRef.current ||
                    activeContextRef.current.accountId !== accountId ||
                    activeContextRef.current.instanceUrl !== instanceUrl
                ) {
                    return;
                }

                setInstanceConfig(config);
            })
            .catch((err) => {
                // Ignore errors from stale requests
                if (
                    requestSeq !== requestSeqRef.current ||
                    activeContextRef.current.accountId !== accountId ||
                    activeContextRef.current.instanceUrl !== instanceUrl
                ) {
                    return;
                }

                console.error('Failed to fetch instance config:', err);
                // Use default config as fallback
                setInstanceConfig(getDefaultConfig());
            })
            .finally(() => {
                // Only update loading state if this is still the current request
                if (
                    requestSeq === requestSeqRef.current &&
                    activeContextRef.current.accountId === accountId &&
                    activeContextRef.current.instanceUrl === instanceUrl
                ) {
                    setIsLoading(false);
                }
            });

        // Cleanup: invalidate pending requests on unmount or dependency change
        return () => {
            // Intentionally increment ref to invalidate stale requests
            // eslint-disable-next-line react-hooks/exhaustive-deps
            requestSeqRef.current++;
        };
    }, [accountSession, isOpen]);

    return {
        instanceConfig,
        isLoading,
    };
}
