import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { mastodon } from 'masto';
import './index.css';
import { Sidebar } from './components/Sidebar';
import { ColumnContainer } from './deck/ColumnContainer';
import { ModalHost } from './components/ModalHost';
import type { ImageViewerImage } from './types/image';
import type { VideoViewerVideo } from './types/video';
import type { AudioViewerTrack } from './types/audio';
import { useAccountsStore } from './store/accounts';
import { useColumnsStore } from './store/columns';
import { useStreamsStore, getStreamKey } from './store/streams';
import { useModalsStore } from './store/modals';
import { initStreamManager } from './streaming/streamManager';

// NSFW cache size limit for LRU eviction
const MAX_NSFW_CACHE_SIZE = 100;

function App() {
    // NSFW revealed status IDs (for syncing between StatusCard and StatusDetailModal)
    // Use array for LRU cache - most recently revealed at the end
    const [nsfwRevealedStatusIds, setNsfwRevealedStatusIds] = useState<string[]>([]);

    // Memoize Set to avoid unnecessary re-renders
    const nsfwRevealedStatusIdSet = useMemo(
        () => new Set(nsfwRevealedStatusIds),
        [nsfwRevealedStatusIds]
    );

    // Add status ID to NSFW revealed list with LRU eviction
    const addNsfwRevealedStatusId = useCallback((statusId: string) => {
        setNsfwRevealedStatusIds((prev) => {
            // If already exists, move to end (most recently used)
            if (prev.includes(statusId)) {
                return [...prev.filter((id) => id !== statusId), statusId];
            }
            // Add new entry, evict oldest if over limit
            const newIds = [...prev, statusId];
            if (newIds.length > MAX_NSFW_CACHE_SIZE) {
                return newIds.slice(-MAX_NSFW_CACHE_SIZE);
            }
            return newIds;
        });
    }, []);

    const loadFromStorage = useAccountsStore((state) => state.loadFromStorage);
    const accounts = useAccountsStore((state) => state.accounts);
    const columns = useColumnsStore((state) => state.columns);
    const addColumn = useColumnsStore((state) => state.addColumn);
    // Use selectors to prevent cascade re-renders when stream updates occur
    const prependStatus = useStreamsStore((s) => s.prependStatus);
    const removeStatusForAccountStreams = useStreamsStore((s) => s.removeStatusForAccountStreams);
    const updateStatus = useStreamsStore((s) => s.updateStatus);
    const updateStatusGlobal = useStreamsStore((s) => s.updateStatusGlobal);
    const updatePollGlobal = useStreamsStore((s) => s.updatePollGlobal);
    const prependNotification = useStreamsStore((s) => s.prependNotification);

    // Ref to track if default columns have been added
    const hasAddedDefaultColumns = useRef(false);

    // Load accounts from storage on mount
    useEffect(() => {
        loadFromStorage();
    }, [loadFromStorage]);

    // Initialize stream manager with real callbacks
    useEffect(() => {
        initStreamManager({
            onUpdate: (accountId, status) => {
                // Update home timeline for this account
                const homeKey = getStreamKey(accountId, 'home');
                prependStatus(homeKey, status);
            },
            onDelete: (accountId, statusId) => {
                // Remove from all streams for this account
                removeStatusForAccountStreams(accountId, statusId);
                // Atomic: remove from modal stack and only push event if a ProfileModal consumer exists
                useModalsStore.getState().handleStatusDeleted({
                    statusId,
                    accountSessionId: accountId,
                });
            },
            onNotification: (accountId, notification) => {
                const notifKey = getStreamKey(accountId, 'notifications');
                prependNotification(notifKey, notification);
            },
            onStatusUpdate: (accountId, status) => {
                const homeKey = getStreamKey(accountId, 'home');
                updateStatus(homeKey, status);
                // Also update modal stack and push event for local state sync
                const modalsStore = useModalsStore.getState();
                modalsStore.updateStackStatus(
                    { statusId: status.id, accountSessionId: accountId },
                    status
                );
                modalsStore.pushUpdatedStatusEvent(accountId, status);
            },
            onConnect: (accountId) => {
                console.log(`✅ Streaming connected for ${accountId}`);
            },
            onDisconnect: (accountId) => {
                console.log(`❌ Streaming disconnected for ${accountId}`);
            },
            onError: (accountId, error) => {
                console.error(`Streaming error for ${accountId}:`, error);
            },
        });
    }, [prependStatus, removeStatusForAccountStreams, updateStatus, prependNotification]);

    // Mark as initialized if columns already exist (from storage or manual addition)
    useEffect(() => {
        if (columns.length > 0) {
            hasAddedDefaultColumns.current = true;
        }
    }, [columns.length]);

    // Add default columns for new accounts (only if never initialized)
    useEffect(() => {
        if (!hasAddedDefaultColumns.current && accounts.length > 0 && columns.length === 0) {
            hasAddedDefaultColumns.current = true;
            const firstAccount = accounts[0];
            addColumn({ accountId: firstAccount.id, stream: { type: 'home' } });
            addColumn({ accountId: firstAccount.id, stream: { type: 'notifications' } });
        }
    }, [accounts, columns.length, addColumn]);

    // Derive login modal open state - show when no accounts exist or user explicitly opens it
    const isLoginOpen = useModalsStore((s) => s.isLoginOpen);
    const shouldShowLoginModal = isLoginOpen || accounts.length === 0;

    // ── Handlers (shared with ColumnContainer and ModalHost) ─────────────

    const handleReply = useCallback((status: mastodon.v1.Status, accountId: string) => {
        const account = status.account;
        useModalsStore.getState().openCompose({
            mode: 'reply',
            replyToStatus: {
                id: status.id,
                acct: account.acct,
                displayName: account.displayName || account.username,
                content: status.content,
                avatar: account.avatar,
            },
            accountId,
        });
    }, []);

    const handleQuote = useCallback((status: mastodon.v1.Status, accountId: string) => {
        const account = status.account;
        useModalsStore.getState().openCompose({
            mode: 'quote',
            quoteToStatus: {
                id: status.id,
                acct: account.acct,
                displayName: account.displayName || account.username,
                content: status.content,
                avatar: account.avatar,
            },
            accountId,
        });
    }, []);

    const handleStatusClick = useCallback((status: mastodon.v1.Status, accountId: string) => {
        useModalsStore.getState().pushStatusDetail(status, accountId);
    }, []);

    const handleAccountClick = useCallback(
        (account: mastodon.v1.Account, accountSessionId: string | undefined) => {
            useModalsStore.getState().pushProfile(account, accountSessionId);
        },
        []
    );

    // Handle edit request from StatusCard/StatusDetailModal
    const handleStatusEditRequest = useCallback(
        (status: mastodon.v1.Status, accountSessionId: string) => {
            useModalsStore.getState().openCompose({
                mode: 'edit',
                editTarget: { status, accountSessionId },
                accountId: accountSessionId,
            });
        },
        []
    );

    // Handle successful status edit
    const handleStatusEdited = useCallback(
        (updatedStatus: mastodon.v1.Status, accountSessionId?: string) => {
            updateStatusGlobal(updatedStatus);
            if (accountSessionId) {
                const store = useModalsStore.getState();
                store.updateStackStatus(
                    { statusId: updatedStatus.id, accountSessionId },
                    updatedStatus
                );
                store.pushUpdatedStatusEvent(accountSessionId, updatedStatus);
            }
        },
        [updateStatusGlobal]
    );

    const handleImageClick = useCallback((images: ImageViewerImage[], index: number) => {
        useModalsStore.getState().openImageViewer(images, index);
    }, []);

    const handleVideoClick = useCallback((videos: VideoViewerVideo[], index: number) => {
        useModalsStore.getState().openVideoViewer(videos, index);
    }, []);

    const handleAudioClick = useCallback((tracks: AudioViewerTrack[], index: number) => {
        useModalsStore.getState().openAudioPlayer(tracks, index);
    }, []);

    // Handle delete request from StatusCard - show confirmation modal
    const handleStatusDeleteRequest = useCallback(
        (status: mastodon.v1.Status, accountId: string, originStackEntryId?: string) => {
            useModalsStore.getState().openConfirm({ status, accountId, originStackEntryId });
        },
        []
    );

    // Unified status update handler — updates global streams only.
    // Stack updates are scoped by account and done inline in ModalHost.
    const handleStatusUpdateGlobal = useCallback(
        (updatedStatus: mastodon.v1.Status) => {
            updateStatusGlobal(updatedStatus);
        },
        [updateStatusGlobal]
    );

    // Handle poll updates - update global store only.
    // Stack updates are scoped by account and done inline in ModalHost.
    const handlePollUpdateGlobal = useCallback(
        (statusId: string, poll: mastodon.v1.Poll) => {
            updatePollGlobal(statusId, poll);
        },
        [updatePollGlobal]
    );

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar
                onAddAccount={() => useModalsStore.getState().openLogin()}
                onCompose={() => useModalsStore.getState().openCompose({ mode: 'new' })}
            />

            <main className="flex-1 flex overflow-hidden">
                <ColumnContainer
                    onAddColumn={() => useModalsStore.getState().openAddColumn()}
                    onReply={handleReply}
                    onQuote={handleQuote}
                    onStatusClick={handleStatusClick}
                    onImageClick={handleImageClick}
                    onVideoClick={handleVideoClick}
                    onAudioClick={handleAudioClick}
                    onAccountClick={handleAccountClick}
                    onNsfwReveal={addNsfwRevealedStatusId}
                    nsfwRevealedStatusIds={nsfwRevealedStatusIdSet}
                    onStatusDelete={handleStatusDeleteRequest}
                    onStatusEdit={handleStatusEditRequest}
                />
            </main>

            <ModalHost
                onReply={handleReply}
                onQuote={handleQuote}
                onStatusClick={handleStatusClick}
                onImageClick={handleImageClick}
                onVideoClick={handleVideoClick}
                onAudioClick={handleAudioClick}
                onAccountClick={handleAccountClick}
                onStatusDeleteRequest={handleStatusDeleteRequest}
                onStatusEditRequest={handleStatusEditRequest}
                onStatusUpdateGlobal={handleStatusUpdateGlobal}
                onPollUpdateGlobal={handlePollUpdateGlobal}
                onStatusEdited={handleStatusEdited}
                nsfwRevealedStatusIdSet={nsfwRevealedStatusIdSet}
                addNsfwRevealedStatusId={addNsfwRevealedStatusId}
                shouldShowLoginModal={shouldShowLoginModal}
            />
        </div>
    );
}

export default App;
