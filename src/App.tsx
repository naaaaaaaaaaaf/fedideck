import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { mastodon } from 'masto';
import './index.css';
import { Sidebar } from './components/Sidebar';
import { ColumnContainer } from './deck/ColumnContainer';
import { LoginModal } from './components/LoginModal';
import { AddColumnModal } from './components/AddColumnModal';
import { ComposeModal } from './components/ComposeModal';
import { StatusDetailModal } from './components/StatusDetailModal';
import { ProfileModal } from './components/ProfileModal';
import { ImageViewer } from './components/ImageViewer';
import { VideoViewer } from './components/VideoViewer';
import { AudioPlayer } from './components/AudioPlayer';
import { ConfirmModal } from './components/ConfirmModal';
import type { ImageViewerImage } from './components/ImageViewer';
import type { VideoViewerVideo } from './types/video';
import type { AudioViewerTrack } from './types/audio';
import { useAccountsStore } from './store/accounts';
import { getClient, deleteStatus } from './api/mastoClient';
import { useColumnsStore } from './store/columns';
import { useStreamsStore, getStreamKey } from './store/streams';
import { useModalsStore, type StackEntry } from './store/modals';
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

    // Modal store — data selectors only (actions via getState() to avoid full-store subscription)
    const stack = useModalsStore((s) => s.stack);
    const compose = useModalsStore((s) => s.compose);
    const confirm = useModalsStore((s) => s.confirm);
    const imageViewer = useModalsStore((s) => s.imageViewer);
    const videoViewer = useModalsStore((s) => s.videoViewer);
    const audioPlayer = useModalsStore((s) => s.audioPlayer);
    const isLoginOpen = useModalsStore((s) => s.isLoginOpen);
    const isAddColumnOpen = useModalsStore((s) => s.isAddColumnOpen);
    const confirmLoading = useModalsStore((s) => s.confirmLoading);
    const confirmError = useModalsStore((s) => s.confirmError);
    const deletedStatusId = useModalsStore((s) => s.deletedStatusId);

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
            },
            onNotification: (accountId, notification) => {
                const notifKey = getStreamKey(accountId, 'notifications');
                prependNotification(notifKey, notification);
            },
            onStatusUpdate: (accountId, status) => {
                const homeKey = getStreamKey(accountId, 'home');
                updateStatus(homeKey, status);
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
    const shouldShowLoginModal = isLoginOpen || accounts.length === 0;

    // ── Handlers ──────────────────────────────────────────────────────────

    const handleReply = useCallback((status: mastodon.v1.Status, accountId: string) => {
        const account = status.account;
        useModalsStore.getState().openCompose({
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
                editTarget: { status, accountSessionId },
                accountId: accountSessionId,
            });
        },
        []
    );

    // Handle successful status edit
    const handleStatusEdited = useCallback(
        (updatedStatus: mastodon.v1.Status) => {
            updateStatusGlobal(updatedStatus);
            useModalsStore.getState().updateStackStatus(updatedStatus.id, updatedStatus);
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
        (status: mastodon.v1.Status, accountId: string) => {
            useModalsStore.getState().openConfirm({ status, accountId });
        },
        []
    );

    // Handle confirmed delete
    const handleStatusDeleteConfirm = async () => {
        if (!confirm) return;

        const session = accounts.find((a) => a.id === confirm.accountId);
        if (!session) {
            useModalsStore
                .getState()
                .setConfirmError(
                    'アカウントセッションが見つかりません。再度ログインしてください。'
                );
            return;
        }

        const store = useModalsStore.getState();
        store.setConfirmLoading(true);
        store.setConfirmError(null);

        try {
            const client = getClient(session);
            await deleteStatus(client, confirm.status.id);
            removeStatusForAccountStreams(confirm.accountId, confirm.status.id);

            // Notify ProfileModal to remove deleted status from local list
            store.setDeletedStatusId(confirm.status.id);

            // Close detail modal if viewing the deleted status
            const deletedId = confirm.status.id;
            const currentStack = useModalsStore.getState().stack;
            const topEntry = currentStack[currentStack.length - 1];
            if (
                topEntry?.type === 'statusDetail' &&
                (topEntry.status.id === deletedId || topEntry.status.reblog?.id === deletedId)
            ) {
                store.goBack();
            }
        } catch (err) {
            store.setConfirmError((err as Error).message);
        } finally {
            // Must reset loading BEFORE closing — closeConfirm is a no-op while loading
            useModalsStore.getState().setConfirmLoading(false);
            if (!useModalsStore.getState().confirmError) {
                useModalsStore.getState().closeConfirm();
            }
        }
    };

    // Handle poll updates - update global store and stack entries
    const handlePollUpdate = useCallback(
        (statusId: string, poll: mastodon.v1.Poll) => {
            updatePollGlobal(statusId, poll);
            useModalsStore.getState().updateStackPoll(statusId, poll);
        },
        [updatePollGlobal]
    );

    // ── Render helpers ────────────────────────────────────────────────────

    const renderStackEntry = (entry: StackEntry, index: number) => {
        const zIndex = 50 + index;
        const isStackTop = index === stack.length - 1;

        if (entry.type === 'statusDetail') {
            const accountSession = accounts.find((a) => a.id === entry.accountSessionId);
            return (
                <StatusDetailModal
                    key={`stack-${index}-detail-${entry.status.id}`}
                    isOpen={isStackTop}
                    onClose={useModalsStore.getState().goBack}
                    status={entry.status}
                    accountSession={accountSession}
                    onReply={(status) => {
                        if (accountSession) handleReply(status, accountSession.id);
                    }}
                    onQuote={(status) => {
                        if (accountSession) handleQuote(status, accountSession.id);
                    }}
                    onStatusUpdate={updateStatusGlobal}
                    onPollUpdate={handlePollUpdate}
                    onStatusDelete={handleStatusDeleteRequest}
                    onStatusEdit={handleStatusEditRequest}
                    onImageClick={handleImageClick}
                    onVideoClick={handleVideoClick}
                    onAudioClick={handleAudioClick}
                    onAccountClick={handleAccountClick}
                    nsfwRevealedStatusIds={nsfwRevealedStatusIdSet}
                    onNsfwReveal={addNsfwRevealedStatusId}
                    zIndex={zIndex}
                    stackDepth={stack.length}
                />
            );
        }

        if (entry.type === 'profile') {
            const accountSession = accounts.find((a) => a.id === entry.accountSessionId);
            return (
                <ProfileModal
                    key={`stack-${index}-profile-${entry.account.id}`}
                    isOpen={isStackTop}
                    onClose={useModalsStore.getState().goBack}
                    account={entry.account}
                    accountSession={accountSession}
                    onReply={handleReply}
                    onQuote={handleQuote}
                    onStatusClick={handleStatusClick}
                    onImageClick={handleImageClick}
                    onVideoClick={handleVideoClick}
                    onAudioClick={handleAudioClick}
                    onAccountClick={handleAccountClick}
                    onNsfwReveal={addNsfwRevealedStatusId}
                    nsfwRevealedStatusIds={nsfwRevealedStatusIdSet}
                    onStatusUpdate={updateStatusGlobal}
                    onStatusDelete={handleStatusDeleteRequest}
                    onStatusEdit={handleStatusEditRequest}
                    deletedStatusId={deletedStatusId}
                    zIndex={zIndex}
                    stackDepth={stack.length}
                />
            );
        }

        return null;
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar
                onAddAccount={() => useModalsStore.getState().openLogin()}
                onCompose={() => useModalsStore.getState().openCompose({})}
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

            {/* Navigation stack */}
            {stack.map(renderStackEntry)}

            {/* Overlay: Compose */}
            <ComposeModal
                isOpen={!!compose}
                onClose={() => useModalsStore.getState().closeCompose()}
                replyToStatus={compose?.replyToStatus}
                quoteToStatus={compose?.quoteToStatus}
                accountId={compose?.accountId}
                editTarget={compose?.editTarget}
                onStatusEdited={handleStatusEdited}
                zIndex={70}
            />

            {/* Overlay: Confirm */}
            <ConfirmModal
                isOpen={!!confirm}
                onClose={() => useModalsStore.getState().closeConfirm()}
                onConfirm={handleStatusDeleteConfirm}
                title="投稿を削除"
                message="この投稿を削除してもよろしいですか？この操作は取り消せません。"
                confirmLabel="削除"
                variant="danger"
                isLoading={confirmLoading}
                error={confirmError}
                zIndex={75}
            />

            {/* Viewers */}
            {imageViewer && (
                <ImageViewer
                    key={`image-viewer-${imageViewer.key}`}
                    isOpen={true}
                    onClose={() => useModalsStore.getState().closeImageViewer()}
                    images={imageViewer.images}
                    initialIndex={imageViewer.initialIndex}
                    zIndex={70}
                />
            )}
            {videoViewer && (
                <VideoViewer
                    key={`video-viewer-${videoViewer.key}`}
                    isOpen={true}
                    onClose={() => useModalsStore.getState().closeVideoViewer()}
                    videos={videoViewer.videos}
                    initialIndex={videoViewer.initialIndex}
                    zIndex={70}
                />
            )}
            {audioPlayer && (
                <AudioPlayer
                    key={`audio-player-${audioPlayer.key}`}
                    isOpen={true}
                    onClose={() => useModalsStore.getState().closeAudioPlayer()}
                    tracks={audioPlayer.tracks}
                    initialIndex={audioPlayer.initialIndex}
                    zIndex={70}
                />
            )}

            {/* Utility modals */}
            <LoginModal
                isOpen={shouldShowLoginModal}
                onClose={() => useModalsStore.getState().closeLogin()}
                canClose={accounts.length > 0}
                zIndex={80}
            />
            <AddColumnModal
                key={isAddColumnOpen ? 'open' : 'closed'}
                isOpen={isAddColumnOpen}
                onClose={() => useModalsStore.getState().closeAddColumn()}
                zIndex={80}
            />
        </div>
    );
}

export default App;
