import { create } from 'zustand';
import type { mastodon } from 'masto';
import type { ImageViewerImage } from '../components/ImageViewer';
import type { VideoViewerVideo } from '../types/video';
import type { AudioViewerTrack } from '../types/audio';

// ---------------------------------------------------------------------------
// Navigation Stack Types
// ---------------------------------------------------------------------------

export type StackEntry =
    | { type: 'statusDetail'; status: mastodon.v1.Status; accountSessionId: string }
    | { type: 'profile'; account: mastodon.v1.Account; accountSessionId: string | undefined };

// ---------------------------------------------------------------------------
// Overlay / Viewer Data Types
// ---------------------------------------------------------------------------

export interface ComposeData {
    replyToStatus?: {
        id: string;
        acct: string;
        displayName: string;
        content: string;
        avatar: string;
    };
    quoteToStatus?: {
        id: string;
        acct: string;
        displayName: string;
        content: string;
        avatar: string;
    };
    editTarget?: { status: mastodon.v1.Status; accountSessionId: string };
    accountId?: string;
}

export interface ConfirmData {
    status: mastodon.v1.Status;
    accountId: string;
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
    deletedStatusId: string | undefined;

    // Actions – Navigation stack
    pushStatusDetail: (status: mastodon.v1.Status, accountSessionId: string) => void;
    pushProfile: (account: mastodon.v1.Account, accountSessionId: string | undefined) => void;
    goBack: () => void;
    clearStack: () => void;
    updateStackStatus: (statusId: string, status: mastodon.v1.Status) => void;
    updateStackPoll: (statusId: string, poll: mastodon.v1.Poll) => void;

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
    setDeletedStatusId: (id: string | undefined) => void;
}

/** Auto-incrementing key counter for viewer remounts */
let viewerKeyCounter = 0;
function nextViewerKey(): number {
    return ++viewerKeyCounter;
}

/** Maximum navigation stack depth */
const MAX_STACK_DEPTH = 6;

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
    deletedStatusId: undefined,

    // ── Navigation stack ──────────────────────────────────────────────────

    pushStatusDetail: (status, accountSessionId) => {
        set((state) => {
            const stack = [...state.stack];
            if (stack.length >= MAX_STACK_DEPTH) {
                stack.shift(); // drop oldest
            }
            stack.push({ type: 'statusDetail', status, accountSessionId });
            return { stack };
        });
    },

    pushProfile: (account, accountSessionId) => {
        set((state) => {
            const stack = [...state.stack];
            // If top entry is a profile for the same account id, replace it
            const top = stack[stack.length - 1];
            if (top && top.type === 'profile' && top.account.id === account.id) {
                stack[stack.length - 1] = { type: 'profile', account, accountSessionId };
            } else {
                if (stack.length >= MAX_STACK_DEPTH) {
                    stack.shift();
                }
                stack.push({ type: 'profile', account, accountSessionId });
            }
            return { stack };
        });
    },

    goBack: () => {
        set((state) => {
            const stack = [...state.stack];
            stack.pop();
            return { stack };
        });
    },

    clearStack: () => {
        set({ stack: [] });
    },

    /** Update a status inside stack entries (used after edit) */
    updateStackStatus: (statusId, status) => {
        set((state) => ({
            stack: state.stack.map((entry) => {
                if (entry.type === 'statusDetail') {
                    // Direct match or reblog wrapper match
                    if (entry.status.id === statusId || entry.status.reblog?.id === statusId) {
                        return { ...entry, status };
                    }
                }
                return entry;
            }),
        }));
    },

    /** Update only the poll field in a stack entry status (preserves concurrent edits) */
    updateStackPoll: (statusId: string, poll: mastodon.v1.Poll) => {
        set((state) => ({
            stack: state.stack.map((entry) => {
                if (entry.type === 'statusDetail') {
                    if (entry.status.id === statusId) {
                        return { ...entry, status: { ...entry.status, poll } };
                    }
                    if (entry.status.reblog?.id === statusId) {
                        return {
                            ...entry,
                            status: {
                                ...entry.status,
                                reblog: { ...entry.status.reblog, poll },
                            },
                        };
                    }
                }
                return entry;
            }),
        }));
    },

    // ── Overlays ──────────────────────────────────────────────────────────

    openCompose: (data) => {
        set({ compose: data });
    },

    closeCompose: () => {
        set({ compose: null });
    },

    openConfirm: (data) => {
        set({ confirm: data, confirmLoading: false, confirmError: null });
    },

    closeConfirm: () => {
        set((state) => {
            if (state.confirmLoading) return state; // don't close while loading
            return { confirm: null, confirmError: null };
        });
    },

    openImageViewer: (images, index) => {
        set({ imageViewer: { images, initialIndex: index, key: nextViewerKey() } });
    },

    closeImageViewer: () => {
        set({ imageViewer: null });
    },

    openVideoViewer: (videos, index) => {
        set({ videoViewer: { videos, initialIndex: index, key: nextViewerKey() } });
    },

    closeVideoViewer: () => {
        set({ videoViewer: null });
    },

    openAudioPlayer: (tracks, index) => {
        set({ audioPlayer: { tracks, initialIndex: index, key: nextViewerKey() } });
    },

    closeAudioPlayer: () => {
        set({ audioPlayer: null });
    },

    // ── Utility ───────────────────────────────────────────────────────────

    openLogin: () => {
        set({ isLoginOpen: true });
    },

    closeLogin: () => {
        set({ isLoginOpen: false });
    },

    openAddColumn: () => {
        set({ isAddColumnOpen: true });
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

    setDeletedStatusId: (id) => {
        set({ deletedStatusId: id });
    },
}));
