import { useState, useEffect, useMemo } from 'react';
import type { mastodon } from 'masto';
import { type AccountSession, getClient, fetchStatus } from '../api/mastoClient';
import { isFullQuote } from '../utils/statusView';

interface UseResolveShallowQuoteResult {
    /** The resolved status, or null if not yet resolved or not a shallow quote */
    resolvedStatus: mastodon.v1.Status | null;
    /** Whether the resolution is currently in progress */
    isLoading: boolean;
}

/**
 * Hook to resolve a ShallowQuote (quote with only quotedStatusId, no quotedStatus).
 * Automatically fetches the quoted status from the API when needed.
 *
 * @param status - The status containing the quote
 * @param accountSession - The account session for API calls
 * @returns The resolved status and loading state
 */
export function useResolveShallowQuote(
    status: mastodon.v1.Status | null | undefined,
    accountSession?: AccountSession
): UseResolveShallowQuoteResult {
    const [resolvedStatus, setResolvedStatus] = useState<mastodon.v1.Status | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Extract the shallow quote ID if this is a ShallowQuote
    const shallowQuoteId = useMemo(() => {
        const quote = status?.quote;
        if (!quote) return null;
        if (quote.state !== 'accepted') return null;
        if (isFullQuote(quote)) return null;
        return quote.quotedStatusId ?? null;
    }, [status?.quote]);

    useEffect(() => {
        if (!accountSession || !shallowQuoteId) {
            setResolvedStatus(null);
            return;
        }

        let cancelled = false;

        const resolveShallowQuote = async () => {
            setIsLoading(true);
            try {
                const client = getClient(accountSession);
                const quotedStatus = await fetchStatus(client, shallowQuoteId, accountSession);
                if (!cancelled) {
                    setResolvedStatus(quotedStatus);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to fetch shallow quoted status:', error);
                    setResolvedStatus(null);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        resolveShallowQuote();

        return () => {
            cancelled = true;
        };
    }, [accountSession, shallowQuoteId]);

    return { resolvedStatus, isLoading };
}
