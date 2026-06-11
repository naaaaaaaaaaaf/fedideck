import { create } from 'zustand';
import type { mastodon } from 'masto';
import type { ImageViewerImage } from '../types/image';
import type { VideoViewerVideo } from '../types/video';
import type { AudioViewerTrack } from '../types/audio';

// ---------------------------------------------------------------------------
// Navigation Stack Types
// ---------------------------------------------------------------------------

export type StackEntry =
    | {
          id: string;
          type: 'statusDetail';
          status: mastodon.v1.Status;
          accountSessionId: string;
      }
    | {
          id: string;
          type: 'profile';
          account: mastodon.v1.Account;
          accountSessionId: string | undefined;
      };

// ---------------------------------------------------------------------------
// Status Reference (scoped by accountSessionId)
// ---------------------------------------------------------------------------

export interface StatusRef {
    statusId: string;
    accountSessionId: string;
}

export interface DeletedStatusEvent extends StatusRef {
    eventId: string;
}

// ---------------------------------------------------------------------------
// Overlay / Viewer Data Types
// ---------------------------------------------------------------------------

export type ComposeData =
    | { mode: 'new'; accountId?: string }
    | {
          mode: 'reply';
          replyToStatus: {
              id: string;
              acct: string;
              displayName: string;
              content: string;
              avatar: string;
          };
          accountId: string;
      }
    | {
          mode: 'quote';
          quoteToStatus: {
              id: string;
              acct: string;
              displayName: string;
              content: string;
              avatar: string;
          };
          accountId: string;
      }
    | {
          mode: 'edit';
          editTarget: { status: mastodon.v1.Status; accountSessionId: string };
          accountId: string;
      };

export interface ConfirmData {
    status: mastodon.v1.Status;
    accountId: string;
    /** When set, delete confirmation targets this specific stack entry by id */
    originStackEntryId?: string;
}

export interface ImageViewerData {
    images: ImageViewerImage[];
    initialIndex: number;
    key: number;
}

export interface VideoViewerData {
    videos: VideoViewerVideo[];
    initialIndex: number;
    key: number;
}

export interface AudioPlayerData {
    tracks: AudioViewerTrack[];
    initialIndex: number;
    key: number;
}

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface ModalsState {
    // Navigation stack
    stack: StackEntry[];

    // Overlay slots
    compose: ComposeData | null;
    confirm: ConfirmData | null;
    imageViewer: ImageViewerData | null;
    videoViewer: VideoViewerData | null;
    audioPlayer: AudioPlayerData | null;

    // Utility modals
    isLoginOpen: boolean;
    isAddColumnOpen: boolean;

    // Delete confirmation sub-state (moved from App.tsx)
    confirmLoading: boolean;
    confirmError: string | null;
    deletedStatusEvents: DeletedStatusEvent[];

    // Actions – Navigation stack
    pushStatusDetail: (status: mastodon.v1.Status, accountSessionId: string) => void;
    pushProfile: (account: mastodon.v1.Account, accountSessionId: string | undefined) => void;
    goBack: () => void;
    clearStack: () => void;
    updateStackStatus: (ref: StatusRef, status: mastodon.v1.Status) => void;
    updateStackPoll: (ref: StatusRef, poll: mastodon.v1.Poll) => void;
    removeStatusFromStack: (ref: StatusRef) => void;
    removeStackEntryById: (entryId: string) => void;

    // Actions – Overlays
    openCompose: (data: ComposeData) => void;
    closeCompose: () => void;
    openConfirm: (data: ConfirmData) => void;
    closeConfirm: () => void;
    openImageViewer: (images: ImageViewerImage[], index: number) => void;
    closeImageViewer: () => void;
    openVideoViewer: (videos: VideoViewerVideo[], index: number) => void;
    closeVideoViewer: () => void;
    openAudioPlayer: (tracks: AudioViewerTrack[], index: number) => void;
    closeAudioPlayer: () => void;

    // Actions – Utility
    openLogin: () => void;
    closeLogin: () => void;
    openAddColumn: () => void;
    closeAddColumn: () => void;

    // Actions – Confirm sub-state
    setConfirmLoading: (loading: boolean) => void;
    setConfirmError: (error: string | null) => void;
    pushDeletedStatusEvent: (ref: StatusRef) => void;
    pruneDeletedStatusEvents: (eventIds: string[]) => void;
}

/** Auto-incrementing counters for stable ids and viewer keys */
let stackIdCounter = 0;
function nextStackId(): string {
    return `stack-${++stackIdCounter}`;
}

let viewerKeyCounter = 0;
function nextViewerKey(): number {
    return ++viewerKeyCounter;
}

/** Maximum navigation stack depth */
const MAX_STACK_DEPTH = 6;

/** Check if a statusDetail entry matches a StatusRef (direct or reblog) */
function statusDetailMatches(
    entry: StackEntry,
    ref: StatusRef
): entry is StackEntry & { type: 'statusDetail' } {
    return (
        entry.type === 'statusDetail' &&
        entry.accountSessionId === ref.accountSessionId &&
        (entry.status.id === ref.statusId || entry.status.reblog?.id === ref.statusId)
    );
}

/** Shared reset object for overlay mutual exclusion — applied by every open* action. */
const CLEAR_OVERLAYS = {
    compose: null as ComposeData | null,
    confirm: null as ConfirmData | null,
    confirmLoading: false,
    confirmError: null as string | null,
    imageViewer: null as ImageViewerData | null,
    videoViewer: null as VideoViewerData | null,
    audioPlayer: null as AudioPlayerData | null,
    isLoginOpen: false,
    isAddColumnOpen: false,
};

export const useModalsStore = create<ModalsState>()((set) => ({
    // Navigation stack
    stack: [],

    // Overlay slots
    compose: null,
    confirm: null,
    imageViewer: null,
    videoViewer: null,
    audioPlayer: null,

    // Utility
    isLoginOpen: false,
    isAddColumnOpen: false,

    // Confirm sub-state
    confirmLoading: false,
    confirmError: null,
    deletedStatusEvents: [],

    // ── Navigation stack ──────────────────────────────────────────────────

    pushStatusDetail: (status, accountSessionId) => {
        set((state) => {
            const stack = [...state.stack];
            if (stack.length >= MAX_STACK_DEPTH) {
                stack.shift(); // drop oldest
            }
            stack.push({ id: nextStackId(), type: 'statusDetail', status, accountSessionId });
            return { stack };
        });
    },

    pushProfile: (account, accountSessionId) => {
        set((state) => {
            const stack = [...state.stack];
            // If top entry is a profile for the same account + session, replace it
            const top = stack[stack.length - 1];
            if (
                top &&
                top.type === 'profile' &&
                top.account.id === account.id &&
                top.accountSessionId === accountSessionId
            ) {
                stack[stack.length - 1] = {
                    ...top,
                    account,
                    accountSessionId,
                };
            } else {
                if (stack.length >= MAX_STACK_DEPTH) {
                    stack.shift();
                }
                stack.push({ id: nextStackId(), type: 'profile', account, accountSessionId });
            }
            return { stack };
        });
    },

    /** Remove all statusDetail entries matching the given StatusRef (direct or reblog) */
    removeStatusFromStack: (ref: StatusRef) => {
        set((state) => {
            const stack = state.stack.filter((entry) => !statusDetailMatches(entry, ref));
            return {
                stack,
                deletedStatusEvents: stack.length === 0 ? [] : state.deletedStatusEvents,
            };
        });
    },

    /** Remove a specific stack entry by its id */
    removeStackEntryById: (entryId: string) => {
        set((state) => {
            const stack = state.stack.filter((entry) => entry.id !== entryId);
            return {
                stack,
                deletedStatusEvents: stack.length === 0 ? [] : state.deletedStatusEvents,
            };
        });
    },

    goBack: () => {
        set((state) => {
            const stack = [...state.stack];
            stack.pop();
            return {
                stack,
                // Prune events when stack is fully closed
                deletedStatusEvents: stack.length === 0 ? [] : state.deletedStatusEvents,
            };
        });
    },

    clearStack: () => {
        set({ stack: [], deletedStatusEvents: [] });
    },

    /** Update a status inside stack entries (scoped by account to prevent cross-account leaks) */
    updateStackStatus: (ref, status) => {
        set((state) => ({
            stack: state.stack.map((entry) => {
                if (
                    entry.type !== 'statusDetail' ||
                    entry.accountSessionId !== ref.accountSessionId
                ) {
                    return entry;
                }
                // Direct match — replace the entire status
                if (entry.status.id === ref.statusId) {
                    return { ...entry, status };
                }
                // Reblog wrapper match — keep wrapper, update reblog only
                if (entry.status.reblog?.id === ref.statusId) {
                    return { ...entry, status: { ...entry.status, reblog: status } };
                }
                return entry;
            }),
        }));
    },

    /** Update only the poll field in a stack entry status (scoped by account) */
    updateStackPoll: (ref: StatusRef, poll: mastodon.v1.Poll) => {
        set((state) => ({
            stack: state.stack.map((entry) => {
                if (
                    entry.type !== 'statusDetail' ||
                    entry.accountSessionId !== ref.accountSessionId
                ) {
                    return entry;
                }
                if (entry.status.id === ref.statusId) {
                    return { ...entry, status: { ...entry.status, poll } };
                }
                if (entry.status.reblog?.id === ref.statusId) {
                    return {
                        ...entry,
                        status: {
                            ...entry.status,
                            reblog: { ...entry.status.reblog, poll },
                        },
                    };
                }
                return entry;
            }),
        }));
    },

    // ── Overlays (mutually exclusive — opening one closes others) ──────────

    openCompose: (data) => {
        set({ ...CLEAR_OVERLAYS, compose: data });
    },

    closeCompose: () => {
        set({ compose: null });
    },

    openConfirm: (data) => {
        set((state) => {
            if (state.confirmLoading) return state; // don't interrupt in-flight confirm
            return { ...CLEAR_OVERLAYS, confirm: data };
        });
    },

    closeConfirm: () => {
        set((state) => {
            if (state.confirmLoading) return state; // don't close while loading
            return { confirm: null, confirmError: null };
        });
    },

    openImageViewer: (images, index) => {
        if (images.length === 0) return;
        set({
            ...CLEAR_OVERLAYS,
            imageViewer: {
                images,
                initialIndex: Math.max(0, Math.min(index, images.length - 1)),
                key: nextViewerKey(),
            },
        });
    },

    closeImageViewer: () => {
        set({ imageViewer: null });
    },

    openVideoViewer: (videos, index) => {
        if (videos.length === 0) return;
        set({
            ...CLEAR_OVERLAYS,
            videoViewer: {
                videos,
                initialIndex: Math.max(0, Math.min(index, videos.length - 1)),
                key: nextViewerKey(),
            },
        });
    },

    closeVideoViewer: () => {
        set({ videoViewer: null });
    },

    openAudioPlayer: (tracks, index) => {
        if (tracks.length === 0) return;
        set({
            ...CLEAR_OVERLAYS,
            audioPlayer: {
                tracks,
                initialIndex: Math.max(0, Math.min(index, tracks.length - 1)),
                key: nextViewerKey(),
            },
        });
    },

    closeAudioPlayer: () => {
        set({ audioPlayer: null });
    },

    // ── Utility (mutually exclusive with each other) ───────────────────────

    openLogin: () => {
        set({ ...CLEAR_OVERLAYS, isLoginOpen: true });
    },

    closeLogin: () => {
        set({ isLoginOpen: false });
    },

    openAddColumn: () => {
        set({ ...CLEAR_OVERLAYS, isAddColumnOpen: true });
    },

    closeAddColumn: () => {
        set({ isAddColumnOpen: false });
    },

    // ── Confirm sub-state ─────────────────────────────────────────────────

    setConfirmLoading: (loading) => {
        set({ confirmLoading: loading });
    },

    setConfirmError: (error) => {
        set({ confirmError: error });
    },

    pushDeletedStatusEvent: (ref) => {
        set((state) => ({
            deletedStatusEvents: [
                ...state.deletedStatusEvents,
                { ...ref, eventId: crypto.randomUUID() },
            ],
        }));
    },

    pruneDeletedStatusEvents: (eventIds) => {
        const ids = new Set(eventIds);
        set((state) => ({
            deletedStatusEvents: state.deletedStatusEvents.filter((e) => !ids.has(e.eventId)),
        }));
    },
}));
