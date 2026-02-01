import { create } from 'zustand';
import type { mastodon } from 'masto';

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
    updateStatus: (key: string, status: mastodon.v1.Status) => void;
    updateStatusGlobal: (status: mastodon.v1.Status) => void;
    setNotifications: (key: string, notifications: mastodon.v1.Notification[], hasMore?: boolean) => void;
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
        set((state) => ({
            data: {
                ...state.data,
                [key]: {
                    ...(state.data[key] ?? initialStreamData),
                    statuses,
                    hasMore,
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
            if (current.statuses.some(s => s.id === status.id)) {
                return state;
            }
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...current,
                        statuses: [status, ...current.statuses],
                    },
                },
            };
        });
    },

    appendStatuses: (key, statuses) => {
        set((state) => {
            const current = state.data[key] ?? initialStreamData;
            const existingIds = new Set(current.statuses.map(s => s.id));
            const newStatuses = statuses.filter(s => !existingIds.has(s.id));
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...current,
                        statuses: [...current.statuses, ...newStatuses],
                        hasMore: newStatuses.length > 0,
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
                        statuses: current.statuses.filter(s => s.id !== statusId),
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
                        statuses: current.statuses.map(s => s.id === status.id ? status : s),
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

                const updatedStatuses = current.statuses.map(s => {
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

    setNotifications: (key, notifications, hasMore = true) => {
        set((state) => ({
            data: {
                ...state.data,
                [key]: {
                    ...(state.data[key] ?? initialStreamData),
                    notifications,
                    hasMore,
                    isLoading: false,
                    error: null,
                },
            },
        }));
    },

    prependNotification: (key, notification) => {
        set((state) => {
            const current = state.data[key] ?? initialStreamData;
            if (current.notifications.some(n => n.id === notification.id)) {
                return state;
            }
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...current,
                        notifications: [notification, ...current.notifications],
                    },
                },
            };
        });
    },

    appendNotifications: (key, notifications) => {
        set((state) => {
            const current = state.data[key] ?? initialStreamData;
            const existingIds = new Set(current.notifications.map(n => n.id));
            const newNotifications = notifications.filter(n => !existingIds.has(n.id));
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...current,
                        notifications: [...current.notifications, ...newNotifications],
                        hasMore: newNotifications.length > 0,
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
export function getStreamKey(accountId: string, streamType: string, params?: { listId?: string; hashtag?: string }): string {
    if (params?.listId) {
        return `${accountId}:list:${params.listId}`;
    }
    if (params?.hashtag) {
        return `${accountId}:hashtag:${params.hashtag}`;
    }
    return `${accountId}:${streamType}`;
}
