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
    bookmarkStatus,
    unbookmarkStatus,
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
    bookmarked: boolean;
    isLoading: { favourite: boolean; reblog: boolean; bookmark: boolean };
    canReblog: boolean;
    handleFavourite: () => Promise<void>;
    handleReblog: () => Promise<void>;
    handleBookmark: () => Promise<void>;
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
    const [localBookmarked, setLocalBookmarked] = useState(status?.bookmarked ?? false);
    const [isLoading, setIsLoading] = useState({
        favourite: false,
        reblog: false,
        bookmark: false,
    });

    // Track pending props updates that arrived during loading
    const pendingPropsRef = useRef<{
        favourited: boolean;
        favouritesCount: number;
        reblogged: boolean;
        reblogsCount: number;
        bookmarked: boolean;
    } | null>(null);

    // Race condition control: track current status id
    // Updated synchronously during render to ensure guard is effective immediately
    const activeStatusIdRef = useRef(status?.id);
    activeStatusIdRef.current = status?.id;

    // Track previous status id to detect navigation
    const prevStatusIdRef = useRef(status?.id);

    // Synchronous in-flight guards (prevent double-clicks within same tick)
    // isLoading state is async, so useRef is needed for synchronous blocking
    const isFavouriteInFlightRef = useRef(false);
    const isReblogInFlightRef = useRef(false);
    const isBookmarkInFlightRef = useRef(false);

    // Sync local state with props when status changes externally
    // (e.g., from streaming updates or parent re-renders with new data)
    useEffect(() => {
        if (!status) return;

        const newProps = {
            favourited: status.favourited ?? false,
            favouritesCount: status.favouritesCount ?? 0,
            reblogged: status.reblogged ?? false,
            reblogsCount: status.reblogsCount ?? 0,
            bookmarked: status.bookmarked ?? false,
        };

        // On navigation (status.id changed), always apply immediately and clear pending
        // This prevents stale optimistic state from appearing on new status
        if (prevStatusIdRef.current !== status.id) {
            prevStatusIdRef.current = status.id;
            setLocalFavourited(newProps.favourited);
            setLocalFavouritesCount(newProps.favouritesCount);
            setLocalReblogged(newProps.reblogged);
            setLocalReblogsCount(newProps.reblogsCount);
            setLocalBookmarked(newProps.bookmarked);
            pendingPropsRef.current = null;
            // Clear loading state and in-flight guards to prevent UI from being stuck
            isFavouriteInFlightRef.current = false;
            isReblogInFlightRef.current = false;
            isBookmarkInFlightRef.current = false;
            setIsLoading({ favourite: false, reblog: false, bookmark: false });
            return;
        }

        // If currently loading, store the update to apply after completion
        if (isLoading.favourite || isLoading.reblog || isLoading.bookmark) {
            pendingPropsRef.current = newProps;
        } else {
            // Apply immediately when not loading
            setLocalFavourited(newProps.favourited);
            setLocalFavouritesCount(newProps.favouritesCount);
            setLocalReblogged(newProps.reblogged);
            setLocalReblogsCount(newProps.reblogsCount);
            setLocalBookmarked(newProps.bookmarked);
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
        status?.bookmarked,
    ]);

    // Apply pending props when loading completes
    useEffect(() => {
        if (
            !isLoading.favourite &&
            !isLoading.reblog &&
            !isLoading.bookmark &&
            pendingPropsRef.current
        ) {
            const pending = pendingPropsRef.current;
            setLocalFavourited(pending.favourited);
            setLocalFavouritesCount(pending.favouritesCount);
            setLocalReblogged(pending.reblogged);
            setLocalReblogsCount(pending.reblogsCount);
            setLocalBookmarked(pending.bookmarked);
            pendingPropsRef.current = null;
        }
    }, [isLoading.favourite, isLoading.reblog, isLoading.bookmark]);

    const handleFavourite = useCallback(async () => {
        // Use ref for synchronous guard against double-clicks within same tick
        if (!status || !accountSession || isLoading.favourite || isFavouriteInFlightRef.current) {
            return;
        }

        isFavouriteInFlightRef.current = true;
        const currentStatusId = status.id;
        setIsLoading((prev) => ({ ...prev, favourite: true }));

        // Optimistic update
        const wasLocalFavourited = localFavourited;
        setLocalFavourited(!wasLocalFavourited);
        setLocalFavouritesCount((prev) => (wasLocalFavourited ? Math.max(0, prev - 1) : prev + 1));

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
            setLocalFavouritesCount((prev) =>
                wasLocalFavourited ? prev + 1 : Math.max(0, prev - 1)
            );
            console.error('Failed to toggle favourite:', error);
        } finally {
            // Always clear loading state and in-flight flag, even if status has changed
            // This prevents UI from being stuck in loading state after navigation
            isFavouriteInFlightRef.current = false;
            setIsLoading((prev) => ({ ...prev, favourite: false }));
        }
    }, [status, accountSession, isLoading.favourite, localFavourited, onStatusUpdate]);

    const handleReblog = useCallback(async () => {
        // Use ref for synchronous guard against double-clicks within same tick
        if (!status || !accountSession || isLoading.reblog || isReblogInFlightRef.current) {
            return;
        }

        // Don't allow reblogging private or direct messages
        if (status.visibility === 'private' || status.visibility === 'direct') {
            return;
        }

        isReblogInFlightRef.current = true;
        const currentStatusId = status.id;
        setIsLoading((prev) => ({ ...prev, reblog: true }));

        // Optimistic update
        const wasLocalReblogged = localReblogged;
        setLocalReblogged(!wasLocalReblogged);
        setLocalReblogsCount((prev) => (wasLocalReblogged ? Math.max(0, prev - 1) : prev + 1));

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
            setLocalReblogsCount((prev) => (wasLocalReblogged ? prev + 1 : Math.max(0, prev - 1)));
            console.error('Failed to toggle reblog:', error);
        } finally {
            // Always clear loading state and in-flight flag, even if status has changed
            // This prevents UI from being stuck in loading state after navigation
            isReblogInFlightRef.current = false;
            setIsLoading((prev) => ({ ...prev, reblog: false }));
        }
    }, [status, accountSession, isLoading.reblog, localReblogged, onStatusUpdate]);

    const handleBookmark = useCallback(async () => {
        // Use ref for synchronous guard against double-clicks within same tick
        if (!status || !accountSession || isLoading.bookmark || isBookmarkInFlightRef.current) {
            return;
        }

        isBookmarkInFlightRef.current = true;
        const currentStatusId = status.id;
        setIsLoading((prev) => ({ ...prev, bookmark: true }));

        // Optimistic update (no count for bookmarks)
        const wasLocalBookmarked = localBookmarked;
        setLocalBookmarked(!wasLocalBookmarked);

        try {
            const client: MastoClient = getClient(accountSession);
            const updatedStatus = wasLocalBookmarked
                ? await unbookmarkStatus(client, currentStatusId)
                : await bookmarkStatus(client, currentStatusId);

            // Race condition guard: only apply if status hasn't changed
            if (activeStatusIdRef.current !== currentStatusId) {
                return;
            }

            // Update with server response - this is authoritative, clear any pending stale updates
            setLocalBookmarked(updatedStatus.bookmarked ?? false);
            pendingPropsRef.current = null;
            onStatusUpdate?.(updatedStatus);
        } catch (error) {
            // Race condition guard: only rollback if status hasn't changed
            if (activeStatusIdRef.current !== currentStatusId) {
                return;
            }

            // Revert on error
            setLocalBookmarked(wasLocalBookmarked);
            console.error('Failed to toggle bookmark:', error);
        } finally {
            // Always clear loading state and in-flight flag, even if status has changed
            // This prevents UI from being stuck in loading state after navigation
            isBookmarkInFlightRef.current = false;
            setIsLoading((prev) => ({ ...prev, bookmark: false }));
        }
    }, [status, accountSession, isLoading.bookmark, localBookmarked, onStatusUpdate]);

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
              bookmarked: localBookmarked,
          }
        : null;

    return {
        favourited: localFavourited,
        favouritesCount: localFavouritesCount,
        reblogged: localReblogged,
        reblogsCount: localReblogsCount,
        bookmarked: localBookmarked,
        isLoading,
        canReblog,
        handleFavourite,
        handleReblog,
        handleBookmark,
        statusWithLocalState,
    };
}
