import { useState, useEffect, useRef, useCallback } from 'react';
import type { mastodon } from 'masto';
import { getClient, fetchPoll, votePoll, type AccountSession } from '../api/mastoClient';
import { mergePollWithFallback } from '../utils/poll';

interface UsePollStateOptions {
    poll: mastodon.v1.Poll | null;
    statusId: string;
    accountSession: AccountSession | null;
    onPollUpdate?: (statusId: string, poll: mastodon.v1.Poll) => void;
    autoRefreshOnExpiry?: boolean;
}

interface UsePollStateReturn {
    localPoll: mastodon.v1.Poll | null;
    selectedOptions: ReadonlySet<number>;
    pollLoading: boolean;
    pollRefreshing: boolean;
    canVote: boolean;
    canRefresh: boolean;
    hasVoted: boolean;
    handleOptionToggle: (index: number) => void;
    handleVote: () => Promise<void>;
    handleRefresh: () => Promise<void>;
}

export function usePollState({
    poll,
    statusId,
    accountSession,
    onPollUpdate,
    autoRefreshOnExpiry = false,
}: UsePollStateOptions): UsePollStateReturn {
    const [localPoll, setLocalPoll] = useState<mastodon.v1.Poll | null>(null);
    const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set());
    const [pollLoading, setPollLoading] = useState(false);
    const [pollRefreshing, setPollRefreshing] = useState(false);

    const prevPollRef = useRef<mastodon.v1.Poll | null>(null);

    // Race condition control: track current context and request sequence
    const requestSeqRef = useRef(0);
    const activeContextRef = useRef<{ statusId: string; pollId: string | null }>({
        statusId,
        pollId: poll?.id ?? null,
    });

    // Sync with props - use full poll object as dependency (not just id)
    useEffect(() => {
        const nextPoll = poll ?? null;
        setLocalPoll((prevPoll) => (nextPoll ? mergePollWithFallback(prevPoll, nextPoll) : null));

        const prev = prevPollRef.current;
        const pollChanged = prev?.id !== nextPoll?.id;
        const becameNonVotable =
            !!nextPoll &&
            (nextPoll.expired || nextPoll.voted === true || (nextPoll.ownVotes?.length ?? 0) > 0);

        if (pollChanged || becameNonVotable) {
            setSelectedOptions(new Set());
        }

        // Update active context and invalidate in-flight requests on poll/status change
        if (pollChanged || activeContextRef.current.statusId !== statusId) {
            activeContextRef.current = { statusId, pollId: nextPoll?.id ?? null };
            requestSeqRef.current += 1;
        }

        prevPollRef.current = nextPoll;
    }, [poll, statusId]); // Use full poll object, not just poll?.id

    const hasVoted = localPoll?.voted === true || (localPoll?.ownVotes?.length ?? 0) > 0;
    const canVote = !!accountSession && !localPoll?.expired && !hasVoted;
    const canRefresh = !!accountSession && !!localPoll;

    const handleOptionToggle = useCallback(
        (index: number) => {
            if (!localPoll) return;

            if (localPoll.multiple) {
                setSelectedOptions((prev) => {
                    const next = new Set(prev);
                    if (next.has(index)) {
                        next.delete(index);
                    } else {
                        next.add(index);
                    }
                    return next;
                });
            } else {
                setSelectedOptions(new Set([index]));
            }
        },
        [localPoll]
    );

    const handleVote = useCallback(async () => {
        if (!accountSession || !localPoll || selectedOptions.size === 0 || pollLoading) return;

        const requestSeq = ++requestSeqRef.current;
        const requestedPollId = localPoll.id;
        const requestedStatusId = statusId;

        setPollLoading(true);
        try {
            const client = getClient(accountSession);
            const updatedPoll = await votePoll(
                client,
                requestedPollId,
                Array.from(selectedOptions)
            );

            // Race condition guard: only apply if context hasn't changed
            if (
                requestSeq !== requestSeqRef.current ||
                activeContextRef.current.pollId !== requestedPollId ||
                activeContextRef.current.statusId !== requestedStatusId
            ) {
                return;
            }

            const mergedPoll = mergePollWithFallback(localPoll, updatedPoll);
            setLocalPoll(mergedPoll);
            onPollUpdate?.(requestedStatusId, mergedPoll);
        } catch (error) {
            console.error('Failed to vote on poll:', error);
        } finally {
            if (requestSeq === requestSeqRef.current) {
                setPollLoading(false);
            }
        }
    }, [accountSession, localPoll, selectedOptions, pollLoading, statusId, onPollUpdate]);

    const handleRefresh = useCallback(async () => {
        if (!accountSession || !localPoll || pollRefreshing) return;

        const requestSeq = ++requestSeqRef.current;
        const requestedPollId = localPoll.id;
        const requestedStatusId = statusId;

        setPollRefreshing(true);
        try {
            const client = getClient(accountSession);
            const updatedPoll = await fetchPoll(client, requestedPollId);

            // Race condition guard: only apply if context hasn't changed
            if (
                requestSeq !== requestSeqRef.current ||
                activeContextRef.current.pollId !== requestedPollId ||
                activeContextRef.current.statusId !== requestedStatusId
            ) {
                return;
            }

            const mergedPoll = mergePollWithFallback(localPoll, updatedPoll);
            setLocalPoll(mergedPoll);
            onPollUpdate?.(requestedStatusId, mergedPoll);
        } catch (error) {
            console.error('Failed to refresh poll:', error);
        } finally {
            if (requestSeq === requestSeqRef.current) {
                setPollRefreshing(false);
            }
        }
    }, [accountSession, localPoll, pollRefreshing, statusId, onPollUpdate]);

    // Auto-refresh on expiry (for modal view)
    useEffect(() => {
        if (!autoRefreshOnExpiry || !localPoll?.expiresAt || localPoll.expired || !accountSession)
            return;

        const timeUntilExpiry = new Date(localPoll.expiresAt).getTime() - Date.now();
        if (timeUntilExpiry <= 0) return;

        const timeoutId = setTimeout(() => {
            handleRefresh();
        }, timeUntilExpiry);

        return () => clearTimeout(timeoutId);
    }, [
        autoRefreshOnExpiry,
        localPoll?.expiresAt,
        localPoll?.expired,
        accountSession,
        handleRefresh,
    ]);

    return {
        localPoll,
        selectedOptions: selectedOptions as ReadonlySet<number>,
        pollLoading,
        pollRefreshing,
        canVote,
        canRefresh,
        hasVoted,
        handleOptionToggle,
        handleVote,
        handleRefresh,
    };
}
