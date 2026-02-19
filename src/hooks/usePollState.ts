import { useState, useEffect, useRef, useCallback } from 'react';
import type { mastodon } from 'masto';
import { getClient, fetchPoll, votePoll, type AccountSession } from '../api/mastoClient';

interface UsePollStateOptions {
    poll: mastodon.v1.Poll | null;
    statusId: string;
    accountSession: AccountSession | null;
    onPollUpdate?: (statusId: string, poll: mastodon.v1.Poll) => void;
    autoRefreshOnExpiry?: boolean;
}

interface UsePollStateReturn {
    localPoll: mastodon.v1.Poll | null;
    selectedOptions: Set<number>;
    pollLoading: boolean;
    pollRefreshing: boolean;
    canVote: boolean;
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

    // Sync with props - use full poll object as dependency (not just id)
    useEffect(() => {
        const nextPoll = poll ?? null;
        setLocalPoll(nextPoll);

        const prev = prevPollRef.current;
        const pollChanged = prev?.id !== nextPoll?.id;
        const becameNonVotable =
            !!nextPoll &&
            (nextPoll.expired || nextPoll.voted === true || (nextPoll.ownVotes?.length ?? 0) > 0);

        if (pollChanged || becameNonVotable) {
            setSelectedOptions(new Set());
        }

        prevPollRef.current = nextPoll;
    }, [poll]); // Use full poll object, not just poll?.id

    const hasVoted = localPoll?.voted === true || (localPoll?.ownVotes?.length ?? 0) > 0;
    const canVote = !!accountSession && !localPoll?.expired && !hasVoted;

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

        setPollLoading(true);
        try {
            const client = getClient(accountSession);
            const updatedPoll = await votePoll(client, localPoll.id, Array.from(selectedOptions));
            setLocalPoll(updatedPoll);
            onPollUpdate?.(statusId, updatedPoll);
        } catch (error) {
            console.error('Failed to vote on poll:', error);
        } finally {
            setPollLoading(false);
        }
    }, [accountSession, localPoll, selectedOptions, pollLoading, statusId, onPollUpdate]);

    const handleRefresh = useCallback(async () => {
        if (!accountSession || !localPoll || pollRefreshing) return;

        setPollRefreshing(true);
        try {
            const client = getClient(accountSession);
            const updatedPoll = await fetchPoll(client, localPoll.id);
            setLocalPoll(updatedPoll);
            onPollUpdate?.(statusId, updatedPoll);
        } catch (error) {
            console.error('Failed to refresh poll:', error);
        } finally {
            setPollRefreshing(false);
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
        selectedOptions,
        pollLoading,
        pollRefreshing,
        canVote,
        hasVoted,
        handleOptionToggle,
        handleVote,
        handleRefresh,
    };
}
