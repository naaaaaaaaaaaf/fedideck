import { create } from 'zustand';
import type { mastodon } from 'masto';
import { mergePollWithFallback } from '../utils/poll';
import { isFullQuote } from '../utils/statusView';

/** Maximum number of statuses to keep per stream (prevents memory bloat) */
export const MAX_STATUSES_PER_STREAM = 200;
/** Maximum number of notifications to keep per stream */
export const MAX_NOTIFICATIONS_PER_STREAM = 100;

/** Clamps array to maximum size by keeping the first `max` items.
 *  Assumes arrays are ordered newest-first (most recent at index 0).
 *  For prepend: new items added to start, slice keeps them.
 *  For append: older items added to end, slice drops them. */
const clampToMax = <T>(items: T[], max: number): T[] =>
    items.length > max ? items.slice(0, max) : items;

interface StreamData {
    statuses: mastodon.v1.Status[];
    notifications: mastodon.v1.Notification[];
    isLoading: boolean;
    hasMore: boolean;
    error: string | null;
}

interface StreamsState {
    // Data keyed by "accountId:streamKey"
    data: Record<string, StreamData>;

    // Actions
    initStream: (key: string) => void;
    setLoading: (key: string, isLoading: boolean) => void;
    setError: (key: string, error: string | null) => void;
    setStatuses: (key: string, statuses: mastodon.v1.Status[], hasMore?: boolean) => void;
    prependStatus: (key: string, status: mastodon.v1.Status) => void;
    appendStatuses: (key: string, statuses: mastodon.v1.Status[]) => void;
    removeStatus: (key: string, statusId: string) => void;
    removeStatusForAccountStreams: (accountId: string, statusId: string) => void;
    updateStatus: (key: string, status: mastodon.v1.Status) => void;
    updateStatusGlobal: (status: mastodon.v1.Status) => void;
    updatePollGlobal: (statusId: string, poll: mastodon.v1.Poll) => void;
    setNotifications: (
        key: string,
        notifications: mastodon.v1.Notification[],
        hasMore?: boolean
    ) => void;
    prependNotification: (key: string, notification: mastodon.v1.Notification) => void;
    appendNotifications: (key: string, notifications: mastodon.v1.Notification[]) => void;
    clearStream: (key: string) => void;
}

const initialStreamData: StreamData = {
    statuses: [],
    notifications: [],
    isLoading: false,
    hasMore: true,
    error: null,
};

export const useStreamsStore = create<StreamsState>()((set, get) => ({
    data: {},

    initStream: (key) => {
        if (!get().data[key]) {
            set((state) => ({
                data: { ...state.data, [key]: { ...initialStreamData } },
            }));
        }
    },

    setLoading: (key, isLoading) => {
        set((state) => ({
            data: {
                ...state.data,
                [key]: { ...(state.data[key] ?? initialStreamData), isLoading },
            },
        }));
    },

    setError: (key, error) => {
        set((state) => ({
            data: {
                ...state.data,
                [key]: { ...(state.data[key] ?? initialStreamData), error, isLoading: false },
            },
        }));
    },

    setStatuses: (key, statuses, hasMore = true) => {
        const clamped = clampToMax(statuses, MAX_STATUSES_PER_STREAM);
        const reachedCap = clamped.length >= MAX_STATUSES_PER_STREAM;
        set((state) => ({
            data: {
                ...state.data,
                [key]: {
                    ...(state.data[key] ?? initialStreamData),
                    statuses: clamped,
                    // hasMore is false if client cap reached to prevent infinite load loops
                    // (lastId wouldn't change when items are dropped)
                    hasMore: reachedCap ? false : hasMore,
                    isLoading: false,
                    error: null,
                },
            },
        }));
    },

    prependStatus: (key, status) => {
        set((state) => {
            const current = state.data[key] ?? initialStreamData;
            // Avoid duplicates
            if (current.statuses.some((s) => s.id === status.id)) {
                return state;
            }
            const newStatuses = clampToMax([status, ...current.statuses], MAX_STATUSES_PER_STREAM);
            const reachedCap = newStatuses.length >= MAX_STATUSES_PER_STREAM;
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...current,
                        statuses: newStatuses,
                        // hasMore is false if client cap reached to prevent infinite load loops
                        hasMore: reachedCap ? false : current.hasMore,
                    },
                },
            };
        });
    },

    appendStatuses: (key, statuses) => {
        set((state) => {
            const current = state.data[key] ?? initialStreamData;
            const existingIds = new Set(current.statuses.map((s) => s.id));
            const incoming = statuses.filter((s) => !existingIds.has(s.id));
            const merged = clampToMax([...current.statuses, ...incoming], MAX_STATUSES_PER_STREAM);
            const reachedCap = merged.length >= MAX_STATUSES_PER_STREAM;
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...current,
                        statuses: merged,
                        // Preserve hasMore when no new items are added, but stop when client cap is reached
                        hasMore: reachedCap
                            ? false
                            : incoming.length === 0
                              ? current.hasMore
                              : true,
                        isLoading: false,
                    },
                },
            };
        });
    },

    removeStatus: (key, statusId) => {
        set((state) => {
            const current = state.data[key];
            if (!current) return state;
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...current,
                        statuses: current.statuses.filter((s) => s.id !== statusId),
                    },
                },
            };
        });
    },

    updateStatus: (key, status) => {
        set((state) => {
            const current = state.data[key];
            if (!current) return state;
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...current,
                        statuses: current.statuses.map((s) => (s.id === status.id ? status : s)),
                    },
                },
            };
        });
    },

    // Update status across all streams (for when status is modified from detail modal or card)
    updateStatusGlobal: (status: mastodon.v1.Status) => {
        set((state) => {
            const newData = { ...state.data };
            let hasAnyChanges = false;

            for (const key of Object.keys(newData)) {
                const current = newData[key];
                let streamHasChanges = false;

                const updatedStatuses = current.statuses.map((s) => {
                    // Direct match
                    if (s.id === status.id) {
                        streamHasChanges = true;
                        return status;
                    }
                    // Check if this is a reblog containing the status
                    if (s.reblog && s.reblog.id === status.id) {
                        streamHasChanges = true;
                        return { ...s, reblog: status };
                    }
                    // Check if this is a quote containing the status
                    // Note: This only updates 1 level of nesting. Deeply nested quotes
                    // (e.g., quote.quotedStatus.quote.quotedStatus) are not updated.
                    // This is acceptable since MAX_QUOTE_DEPTH=2 limits display depth anyway.
                    if (s.quote?.state === 'accepted' && isFullQuote(s.quote)) {
                        const quotedStatus = s.quote.quotedStatus;
                        if (quotedStatus && quotedStatus.id === status.id) {
                            streamHasChanges = true;
                            return { ...s, quote: { ...s.quote, quotedStatus: status } };
                        }
                    }
                    return s;
                });

                if (streamHasChanges) {
                    newData[key] = {
                        ...current,
                        statuses: updatedStatuses,
                    };
                    hasAnyChanges = true;
                }
            }

            return hasAnyChanges ? { data: newData } : state;
        });
    },

    // Update only the poll field across all streams (prevents overwriting concurrent updates)
    updatePollGlobal: (statusId: string, poll: mastodon.v1.Poll) => {
        set((state) => {
            const newData = { ...state.data };
            let hasAnyChanges = false;

            for (const key of Object.keys(newData)) {
                const current = newData[key];
                let streamHasChanges = false;

                const updatedStatuses = current.statuses.map((s) => {
                    // Direct match - merge poll only
                    if (s.id === statusId) {
                        streamHasChanges = true;
                        return {
                            ...s,
                            poll: mergePollWithFallback(s.poll ?? null, poll),
                        };
                    }
                    // Check if this is a reblog containing the status
                    if (s.reblog && s.reblog.id === statusId) {
                        streamHasChanges = true;
                        return {
                            ...s,
                            reblog: {
                                ...s.reblog,
                                poll: mergePollWithFallback(s.reblog.poll ?? null, poll),
                            },
                        };
                    }
                    // Check if this is a quote containing the status
                    if (s.quote?.state === 'accepted' && isFullQuote(s.quote)) {
                        const quotedStatus = s.quote.quotedStatus;
                        if (quotedStatus && quotedStatus.id === statusId) {
                            streamHasChanges = true;
                            return {
                                ...s,
                                quote: {
                                    ...s.quote,
                                    quotedStatus: {
                                        ...quotedStatus,
                                        poll: mergePollWithFallback(
                                            quotedStatus.poll ?? null,
                                            poll
                                        ),
                                    },
                                },
                            };
                        }
                    }
                    return s;
                });

                if (streamHasChanges) {
                    newData[key] = {
                        ...current,
                        statuses: updatedStatuses,
                    };
                    hasAnyChanges = true;
                }
            }

            return hasAnyChanges ? { data: newData } : state;
        });
    },

    // Remove status from all streams belonging to a specific account
    // This handles both direct statuses and reblogs containing the status
    removeStatusForAccountStreams: (accountId: string, statusId: string) => {
        set((state) => {
            const prefix = `${accountId}:`;
            const next = { ...state.data };
            let changed = false;

            for (const key of Object.keys(next)) {
                // Only process streams belonging to this account
                if (!key.startsWith(prefix)) continue;

                const current = next[key];
                // Remove both direct statuses and reblogs containing the status
                const filtered = current.statuses.filter(
                    (s) => s.id !== statusId && s.reblog?.id !== statusId
                );

                if (filtered.length !== current.statuses.length) {
                    next[key] = { ...current, statuses: filtered };
                    changed = true;
                }
            }

            return changed ? { data: next } : state;
        });
    },

    setNotifications: (key, notifications, hasMore = true) => {
        const clamped = clampToMax(notifications, MAX_NOTIFICATIONS_PER_STREAM);
        const reachedCap = clamped.length >= MAX_NOTIFICATIONS_PER_STREAM;
        set((state) => ({
            data: {
                ...state.data,
                [key]: {
                    ...(state.data[key] ?? initialStreamData),
                    notifications: clamped,
                    // hasMore is false if client cap reached to prevent infinite load loops
                    hasMore: reachedCap ? false : hasMore,
                    isLoading: false,
                    error: null,
                },
            },
        }));
    },

    prependNotification: (key, notification) => {
        set((state) => {
            const current = state.data[key] ?? initialStreamData;
            if (current.notifications.some((n) => n.id === notification.id)) {
                return state;
            }
            const newNotifications = clampToMax(
                [notification, ...current.notifications],
                MAX_NOTIFICATIONS_PER_STREAM
            );
            const reachedCap = newNotifications.length >= MAX_NOTIFICATIONS_PER_STREAM;
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...current,
                        notifications: newNotifications,
                        // hasMore is false if client cap reached to prevent infinite load loops
                        hasMore: reachedCap ? false : current.hasMore,
                    },
                },
            };
        });
    },

    appendNotifications: (key, notifications) => {
        set((state) => {
            const current = state.data[key] ?? initialStreamData;
            const existingIds = new Set(current.notifications.map((n) => n.id));
            const incoming = notifications.filter((n) => !existingIds.has(n.id));
            const merged = clampToMax(
                [...current.notifications, ...incoming],
                MAX_NOTIFICATIONS_PER_STREAM
            );
            const reachedCap = merged.length >= MAX_NOTIFICATIONS_PER_STREAM;
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...current,
                        notifications: merged,
                        // Preserve hasMore when no new items are added, but stop when client cap is reached
                        hasMore: reachedCap
                            ? false
                            : incoming.length === 0
                              ? current.hasMore
                              : true,
                        isLoading: false,
                    },
                },
            };
        });
    },

    clearStream: (key) => {
        set((state) => {
            const newData = { ...state.data };
            delete newData[key];
            return { data: newData };
        });
    },
}));

/**
 * Generate stream key from account ID and stream config
 */
export function getStreamKey(
    accountId: string,
    streamType: string,
    params?: { listId?: string; hashtag?: string }
): string {
    if (params?.listId) {
        return `${accountId}:list:${params.listId}`;
    }
    if (params?.hashtag) {
        return `${accountId}:hashtag:${params.hashtag}`;
    }
    return `${accountId}:${streamType}`;
}
