import { useState, useEffect, useRef, useCallback } from 'react';
import type { mastodon } from 'masto';
import {
    type AccountSession,
    type MastoClient,
    getClient,
    favouriteStatus,
    unfavouriteStatus,
    reblogStatus,
    unreblogStatus,
} from '../api/mastoClient';

interface UseStatusActionsOptions {
    status: mastodon.v1.Status | null;
    accountSession?: AccountSession;
    onStatusUpdate?: (status: mastodon.v1.Status) => void;
}

interface UseStatusActionsReturn {
    favourited: boolean;
    favouritesCount: number;
    reblogged: boolean;
    reblogsCount: number;
    isLoading: { favourite: boolean; reblog: boolean };
    canReblog: boolean;
    handleFavourite: () => Promise<void>;
    handleReblog: () => Promise<void>;
    statusWithLocalState: mastodon.v1.Status | null;
}

export function useStatusActions({
    status,
    accountSession,
    onStatusUpdate,
}: UseStatusActionsOptions): UseStatusActionsReturn {
    // Local state for optimistic UI updates
    const [localFavourited, setLocalFavourited] = useState(status?.favourited ?? false);
    const [localFavouritesCount, setLocalFavouritesCount] = useState(status?.favouritesCount ?? 0);
    const [localReblogged, setLocalReblogged] = useState(status?.reblogged ?? false);
    const [localReblogsCount, setLocalReblogsCount] = useState(status?.reblogsCount ?? 0);
    const [isLoading, setIsLoading] = useState({ favourite: false, reblog: false });

    // Track pending props updates that arrived during loading
    const pendingPropsRef = useRef<{
        favourited: boolean;
        favouritesCount: number;
        reblogged: boolean;
        reblogsCount: number;
    } | null>(null);

    // Race condition control: track current status id
    // Updated synchronously during render to ensure guard is effective immediately
    const activeStatusIdRef = useRef(status?.id);
    activeStatusIdRef.current = status?.id;

    // Sync local state with props when status changes externally
    // (e.g., from streaming updates or parent re-renders with new data)
    useEffect(() => {
        if (!status) return;

        const newProps = {
            favourited: status.favourited ?? false,
            favouritesCount: status.favouritesCount ?? 0,
            reblogged: status.reblogged ?? false,
            reblogsCount: status.reblogsCount ?? 0,
        };

        // If currently loading, store the update to apply after completion
        if (isLoading.favourite || isLoading.reblog) {
            pendingPropsRef.current = newProps;
        } else {
            // Apply immediately when not loading
            setLocalFavourited(newProps.favourited);
            setLocalFavouritesCount(newProps.favouritesCount);
            setLocalReblogged(newProps.reblogged);
            setLocalReblogsCount(newProps.reblogsCount);
            pendingPropsRef.current = null;
        }
        // Note: isLoading is intentionally excluded from deps to avoid re-running on loading changes
        // The second useEffect handles applying pending props when loading completes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        status?.id,
        status?.favourited,
        status?.favouritesCount,
        status?.reblogged,
        status?.reblogsCount,
    ]);

    // Apply pending props when loading completes
    useEffect(() => {
        if (!isLoading.favourite && !isLoading.reblog && pendingPropsRef.current) {
            const pending = pendingPropsRef.current;
            setLocalFavourited(pending.favourited);
            setLocalFavouritesCount(pending.favouritesCount);
            setLocalReblogged(pending.reblogged);
            setLocalReblogsCount(pending.reblogsCount);
            pendingPropsRef.current = null;
        }
    }, [isLoading.favourite, isLoading.reblog]);

    const handleFavourite = useCallback(async () => {
        if (!status || !accountSession || isLoading.favourite) return;

        const currentStatusId = status.id;
        setIsLoading((prev) => ({ ...prev, favourite: true }));

        // Optimistic update
        const wasLocalFavourited = localFavourited;
        setLocalFavourited(!wasLocalFavourited);
        setLocalFavouritesCount((prev) => (wasLocalFavourited ? prev - 1 : prev + 1));

        try {
            const client: MastoClient = getClient(accountSession);
            const updatedStatus = wasLocalFavourited
                ? await unfavouriteStatus(client, currentStatusId)
                : await favouriteStatus(client, currentStatusId);

            // Race condition guard: only apply if status hasn't changed
            if (activeStatusIdRef.current !== currentStatusId) {
                return;
            }

            // Update with server response - this is authoritative, clear any pending stale updates
            setLocalFavourited(updatedStatus.favourited ?? false);
            setLocalFavouritesCount(updatedStatus.favouritesCount ?? 0);
            pendingPropsRef.current = null;
            onStatusUpdate?.(updatedStatus);
        } catch (error) {
            // Race condition guard: only rollback if status hasn't changed
            if (activeStatusIdRef.current !== currentStatusId) {
                return;
            }

            // Revert on error
            setLocalFavourited(wasLocalFavourited);
            setLocalFavouritesCount((prev) => (wasLocalFavourited ? prev + 1 : prev - 1));
            console.error('Failed to toggle favourite:', error);
        } finally {
            // Always clear loading state, even if status has changed
            // This prevents UI from being stuck in loading state after navigation
            setIsLoading((prev) => ({ ...prev, favourite: false }));
        }
    }, [status, accountSession, isLoading.favourite, localFavourited, onStatusUpdate]);

    const handleReblog = useCallback(async () => {
        if (!status || !accountSession || isLoading.reblog) return;

        // Don't allow reblogging private or direct messages
        if (status.visibility === 'private' || status.visibility === 'direct') {
            return;
        }

        const currentStatusId = status.id;
        setIsLoading((prev) => ({ ...prev, reblog: true }));

        // Optimistic update
        const wasLocalReblogged = localReblogged;
        setLocalReblogged(!wasLocalReblogged);
        setLocalReblogsCount((prev) => (wasLocalReblogged ? prev - 1 : prev + 1));

        try {
            const client: MastoClient = getClient(accountSession);
            const updatedStatus = wasLocalReblogged
                ? await unreblogStatus(client, currentStatusId)
                : await reblogStatus(client, currentStatusId);

            // Race condition guard: only apply if status hasn't changed
            if (activeStatusIdRef.current !== currentStatusId) {
                return;
            }

            // For reblog, the API returns the reblog wrapper status
            // We need to extract the actual status
            const actualStatus = updatedStatus.reblog ?? updatedStatus;
            setLocalReblogged(actualStatus.reblogged ?? false);
            setLocalReblogsCount(actualStatus.reblogsCount ?? 0);
            pendingPropsRef.current = null;
            onStatusUpdate?.(actualStatus);
        } catch (error) {
            // Race condition guard: only rollback if status hasn't changed
            if (activeStatusIdRef.current !== currentStatusId) {
                return;
            }

            // Revert on error
            setLocalReblogged(wasLocalReblogged);
            setLocalReblogsCount((prev) => (wasLocalReblogged ? prev + 1 : prev - 1));
            console.error('Failed to toggle reblog:', error);
        } finally {
            // Always clear loading state, even if status has changed
            // This prevents UI from being stuck in loading state after navigation
            setIsLoading((prev) => ({ ...prev, reblog: false }));
        }
    }, [status, accountSession, isLoading.reblog, localReblogged, onStatusUpdate]);

    // Check if reblog is allowed (not for private/direct messages)
    const canReblog = status
        ? status.visibility !== 'private' && status.visibility !== 'direct'
        : false;

    // Merge status with local state for passing to detail views
    const statusWithLocalState: mastodon.v1.Status | null = status
        ? {
              ...status,
              favourited: localFavourited,
              favouritesCount: localFavouritesCount,
              reblogged: localReblogged,
              reblogsCount: localReblogsCount,
          }
        : null;

    return {
        favourited: localFavourited,
        favouritesCount: localFavouritesCount,
        reblogged: localReblogged,
        reblogsCount: localReblogsCount,
        isLoading,
        canReblog,
        handleFavourite,
        handleReblog,
        statusWithLocalState,
    };
}
