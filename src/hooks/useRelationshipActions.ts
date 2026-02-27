import { useState, useEffect, useRef, useCallback } from 'react';
import {
    type AccountSession,
    type MastoClient,
    getClient,
    fetchRelationship,
    followAccount,
    unfollowAccount,
} from '../api/mastoClient';

interface UseRelationshipActionsOptions {
    targetAccountId: string | null;
    accountSession?: AccountSession;
}

interface UseRelationshipActionsReturn {
    following: boolean;
    followedBy: boolean;
    requested: boolean;
    isLoading: boolean;
    isFetching: boolean;
    handleFollowToggle: () => Promise<void>;
    isOwnProfile: boolean;
}

/**
 * Hook for managing relationship state (follow/unfollow) with optimistic UI updates.
 * Follows the same patterns as useStatusActions for consistency.
 */
export function useRelationshipActions({
    targetAccountId,
    accountSession,
}: UseRelationshipActionsOptions): UseRelationshipActionsReturn {
    // Local state for relationship data
    const [following, setFollowing] = useState(false);
    const [followedBy, setFollowedBy] = useState(false);
    const [requested, setRequested] = useState(false);

    // Loading states
    const [isFetching, setIsFetching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Race condition control: track current target account id
    const activeTargetIdRef = useRef(targetAccountId);
    activeTargetIdRef.current = targetAccountId;

    // Track previous target id to detect account changes
    const prevTargetIdRef = useRef(targetAccountId);

    // Synchronous in-flight guard (prevent double-clicks)
    const isInFlightRef = useRef(false);

    // Determine if viewing own profile
    const isOwnProfile =
        accountSession?.account?.id !== undefined &&
        targetAccountId !== null &&
        accountSession.account.id === targetAccountId;

    // Fetch relationship when target account changes
    useEffect(() => {
        // Reset state when target changes or modal closes
        if (!targetAccountId) {
            setFollowing(false);
            setFollowedBy(false);
            setRequested(false);
            setIsFetching(false);
            setIsLoading(false);
            isInFlightRef.current = false;
            prevTargetIdRef.current = null;
            return;
        }

        // On navigation (target id changed), always reset
        if (prevTargetIdRef.current !== targetAccountId) {
            prevTargetIdRef.current = targetAccountId;
            setFollowing(false);
            setFollowedBy(false);
            setRequested(false);
            isInFlightRef.current = false;
            setIsLoading(false);
        }

        // Don't fetch for own profile or without session
        if (isOwnProfile || !accountSession) {
            setIsFetching(false);
            return;
        }

        let cancelled = false;

        const fetchRelationshipData = async () => {
            setIsFetching(true);

            try {
                const client: MastoClient = getClient(accountSession);
                const relationship = await fetchRelationship(client, targetAccountId);

                if (!cancelled && activeTargetIdRef.current === targetAccountId) {
                    setFollowing(relationship.following ?? false);
                    setFollowedBy(relationship.followedBy ?? false);
                    setRequested(relationship.requested ?? false);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to fetch relationship:', err);
                }
            } finally {
                if (!cancelled) {
                    setIsFetching(false);
                }
            }
        };

        fetchRelationshipData();

        return () => {
            cancelled = true;
        };
    }, [targetAccountId, accountSession, isOwnProfile]);

    const handleFollowToggle = useCallback(async () => {
        // Guards
        if (!targetAccountId || !accountSession || isLoading || isInFlightRef.current) {
            return;
        }

        // Don't allow following own profile
        if (isOwnProfile) {
            return;
        }

        isInFlightRef.current = true;
        const currentTargetId = targetAccountId;
        setIsLoading(true);

        // Optimistic update
        // Note: For locked accounts, we optimistically set following: true, but the server
        // will return requested: true, following: false. The UI briefly shows "フォロー中"
        // before being corrected to "リクエスト済み" by the server response. This is acceptable
        // because the server response is the authoritative source and arrives quickly.
        const wasFollowing = following;
        const wasRequested = requested;

        if (wasFollowing || wasRequested) {
            // Unfollowing or canceling request
            setFollowing(false);
            setRequested(false);
        } else {
            // Following (may result in following or requested depending on lock status)
            setFollowing(true);
        }

        try {
            const client: MastoClient = getClient(accountSession);
            const relationship =
                wasFollowing || wasRequested
                    ? await unfollowAccount(client, currentTargetId)
                    : await followAccount(client, currentTargetId);

            // Race condition guard
            if (activeTargetIdRef.current !== currentTargetId) {
                return;
            }

            // Update with server response - this is authoritative
            setFollowing(relationship.following ?? false);
            setFollowedBy(relationship.followedBy ?? false);
            setRequested(relationship.requested ?? false);
        } catch (error) {
            // Race condition guard
            if (activeTargetIdRef.current !== currentTargetId) {
                return;
            }

            // Revert on error
            setFollowing(wasFollowing);
            setRequested(wasRequested);
            console.error('Failed to toggle follow:', error);
        } finally {
            isInFlightRef.current = false;
            setIsLoading(false);
        }
    }, [targetAccountId, accountSession, isLoading, following, requested, isOwnProfile]);

    return {
        following,
        followedBy,
        requested,
        isLoading,
        isFetching,
        handleFollowToggle,
        isOwnProfile,
    };
}
