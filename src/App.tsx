import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { mastodon } from 'masto';
import './index.css';
import { Sidebar } from './components/Sidebar';
import { ColumnContainer } from './deck/ColumnContainer';
import { LoginModal } from './components/LoginModal';
import { AddColumnModal } from './components/AddColumnModal';
import {
    ComposeModal,
    type ReplyToStatus,
    type EditTarget,
    type QuoteToStatus,
} from './components/ComposeModal';
import { StatusDetailModal } from './components/StatusDetailModal';
import { ProfileModal } from './components/ProfileModal';
import { ImageViewer, type ImageViewerImage } from './components/ImageViewer';
import { VideoViewer } from './components/VideoViewer';
import { AudioPlayer } from './components/AudioPlayer';
import { ConfirmModal } from './components/ConfirmModal';
import type { VideoViewerVideo } from './types/video';
import type { AudioViewerTrack } from './types/audio';
import { useAccountsStore } from './store/accounts';
import type { AccountSession } from './api/mastoClient';
import { getClient, deleteStatus } from './api/mastoClient';
import { useColumnsStore } from './store/columns';
import { useStreamsStore, getStreamKey } from './store/streams';
import { initStreamManager } from './streaming/streamManager';
import { useInstanceConfig } from './hooks/useInstanceConfig';

// NSFW cache size limit for LRU eviction
const MAX_NSFW_CACHE_SIZE = 100;

function App() {
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
    const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
    const [replyToStatus, setReplyToStatus] = useState<ReplyToStatus | undefined>(undefined);
    const [replyAccountId, setReplyAccountId] = useState<string | undefined>(undefined);
    const [quoteToStatus, setQuoteToStatus] = useState<QuoteToStatus | undefined>(undefined);
    const [quoteAccountId, setQuoteAccountId] = useState<string | undefined>(undefined);
    const [editTarget, setEditTarget] = useState<EditTarget | undefined>(undefined);
    const [isStatusDetailOpen, setIsStatusDetailOpen] = useState(false);
    const [detailStatus, setDetailStatus] = useState<mastodon.v1.Status | null>(null);
    const [detailAccountSession, setDetailAccountSession] = useState<AccountSession | undefined>();

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

    // Profile modal state
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [profileAccount, setProfileAccount] = useState<mastodon.v1.Account | null>(null);
    const [profileAccountSession, setProfileAccountSession] = useState<
        AccountSession | undefined
    >();

    // Instance config for ProfileModal (to determine supportsQuotes)
    const { instanceConfig: profileInstanceConfig } = useInstanceConfig({
        accountSession: profileAccountSession,
        isOpen: isProfileModalOpen,
    });

    // ImageViewer state
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [viewerImages, setViewerImages] = useState<ImageViewerImage[]>([]);
    const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
    const [imageViewerKey, setImageViewerKey] = useState(0);

    // VideoViewer state
    const [isVideoViewerOpen, setIsVideoViewerOpen] = useState(false);
    const [viewerVideos, setViewerVideos] = useState<VideoViewerVideo[]>([]);
    const [viewerInitialVideoIndex, setViewerInitialVideoIndex] = useState(0);
    const [videoViewerKey, setVideoViewerKey] = useState(0);

    // AudioPlayer state
    const [isAudioPlayerOpen, setIsAudioPlayerOpen] = useState(false);
    const [audioTracks, setAudioTracks] = useState<AudioViewerTrack[]>([]);
    const [audioInitialIndex, setAudioInitialIndex] = useState(0);
    const [audioPlayerKey, setAudioPlayerKey] = useState(0);

    // Delete confirmation modal state
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [deleteTargetStatus, setDeleteTargetStatus] = useState<mastodon.v1.Status | null>(null);
    const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
    const [isDeleteLoading, setIsDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    // Track deleted status ID to notify ProfileModal
    const [deletedStatusId, setDeletedStatusId] = useState<string | undefined>(undefined);

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
    const shouldShowLoginModal = isLoginModalOpen || accounts.length === 0;

    const handleReply = (status: mastodon.v1.Status, accountId: string) => {
        const account = status.account;
        // Clear quote state to ensure mutual exclusion
        setQuoteToStatus(undefined);
        setQuoteAccountId(undefined);
        setReplyToStatus({
            id: status.id,
            acct: account.acct,
            displayName: account.displayName || account.username,
            content: status.content,
            avatar: account.avatar,
        });
        setReplyAccountId(accountId);
        setIsComposeModalOpen(true);
    };

    const handleQuote = (status: mastodon.v1.Status, accountId: string) => {
        const account = status.account;
        // Clear reply state to ensure mutual exclusion
        setReplyToStatus(undefined);
        setReplyAccountId(undefined);
        setQuoteToStatus({
            id: status.id,
            acct: account.acct,
            displayName: account.displayName || account.username,
            content: status.content,
            avatar: account.avatar,
        });
        setQuoteAccountId(accountId);
        setIsComposeModalOpen(true);
    };

    const handleStatusClick = (status: mastodon.v1.Status, accountId: string) => {
        const accountSession = accounts.find((a) => a.id === accountId);
        setDetailStatus(status);
        setDetailAccountSession(accountSession);
        setIsStatusDetailOpen(true);
    };

    const handleAccountClick = (
        account: mastodon.v1.Account,
        accountSessionId: string | undefined
    ) => {
        const accountSession = accounts.find((a) => a.id === accountSessionId);
        setProfileAccount(account);
        setProfileAccountSession(accountSession);
        setIsProfileModalOpen(true);
    };

    const handleStatusDetailReply = (status: mastodon.v1.Status) => {
        if (detailAccountSession) {
            handleReply(status, detailAccountSession.id);
        }
    };

    const handleStatusDetailQuote = (status: mastodon.v1.Status) => {
        if (detailAccountSession) {
            handleQuote(status, detailAccountSession.id);
        }
    };

    const handleDetailModalClose = () => {
        setIsStatusDetailOpen(false);
        setDetailStatus(null);
        setDetailAccountSession(undefined);
    };

    const handleProfileModalClose = () => {
        setIsProfileModalOpen(false);
        setProfileAccount(null);
        setProfileAccountSession(undefined);
        setDeletedStatusId(undefined);
    };

    const handleComposeClose = () => {
        setIsComposeModalOpen(false);
        setReplyToStatus(undefined);
        setReplyAccountId(undefined);
        setQuoteToStatus(undefined);
        setQuoteAccountId(undefined);
        setEditTarget(undefined);
    };

    // Handle edit request from StatusCard/StatusDetailModal
    const handleStatusEditRequest = useCallback(
        (status: mastodon.v1.Status, accountSessionId: string) => {
            // Clear reply state when entering edit mode
            setReplyToStatus(undefined);
            setReplyAccountId(undefined);
            setEditTarget({ status, accountSessionId });
            setIsComposeModalOpen(true);
        },
        []
    );

    // Handle successful status edit
    const handleStatusEdited = useCallback(
        (updatedStatus: mastodon.v1.Status) => {
            // Update the status in all streams
            updateStatusGlobal(updatedStatus);
            // Update detail modal if viewing the edited status
            if (detailStatus?.id === updatedStatus.id) {
                setDetailStatus(updatedStatus);
            }
        },
        [updateStatusGlobal, detailStatus]
    );

    const handleImageClick = useCallback((images: ImageViewerImage[], index: number) => {
        setViewerImages(images);
        setViewerInitialIndex(index);
        setImageViewerKey((k) => k + 1); // Force remount to reset index
        setIsImageViewerOpen(true);
    }, []);

    const handleImageViewerClose = useCallback(() => {
        setIsImageViewerOpen(false);
    }, []);

    const handleVideoClick = useCallback((videos: VideoViewerVideo[], index: number) => {
        setViewerVideos(videos);
        setViewerInitialVideoIndex(index);
        setVideoViewerKey((k) => k + 1); // Force remount to reset index
        setIsVideoViewerOpen(true);
    }, []);

    const handleVideoViewerClose = useCallback(() => {
        setIsVideoViewerOpen(false);
    }, []);

    const handleAudioClick = useCallback((tracks: AudioViewerTrack[], index: number) => {
        setAudioTracks(tracks);
        setAudioInitialIndex(index);
        setAudioPlayerKey((k) => k + 1); // Force remount to reset index
        setIsAudioPlayerOpen(true);
    }, []);

    const handleAudioPlayerClose = useCallback(() => {
        setIsAudioPlayerOpen(false);
    }, []);

    // Handle delete request from StatusCard - show confirmation modal
    const handleStatusDeleteRequest = useCallback(
        (status: mastodon.v1.Status, accountId: string) => {
            setDeleteTargetStatus(status);
            setDeleteAccountId(accountId);
            setDeleteError(null);
            setIsDeleteConfirmOpen(true);
        },
        []
    );

    // Handle confirmed delete
    const handleStatusDeleteConfirm = async () => {
        if (!deleteTargetStatus || !deleteAccountId) return;

        const session = accounts.find((a) => a.id === deleteAccountId);
        if (!session) {
            setDeleteError('アカウントセッションが見つかりません。再度ログインしてください。');
            return;
        }

        setIsDeleteLoading(true);
        setDeleteError(null);

        try {
            const client = getClient(session);
            await deleteStatus(client, deleteTargetStatus.id);
            removeStatusForAccountStreams(deleteAccountId, deleteTargetStatus.id);

            // Notify ProfileModal to remove deleted status from local list
            setDeletedStatusId(deleteTargetStatus.id);

            // Close detail modal if viewing the deleted status
            if (
                detailStatus?.id === deleteTargetStatus.id ||
                detailStatus?.reblog?.id === deleteTargetStatus.id
            ) {
                handleDetailModalClose();
            }

            setIsDeleteConfirmOpen(false);
            setDeleteTargetStatus(null);
            setDeleteAccountId(null);
        } catch (err) {
            setDeleteError((err as Error).message);
        } finally {
            setIsDeleteLoading(false);
        }
    };

    const handleDeleteConfirmClose = () => {
        if (!isDeleteLoading) {
            setIsDeleteConfirmOpen(false);
            setDeleteTargetStatus(null);
            setDeleteAccountId(null);
            setDeleteError(null);
        }
    };

    // Handle poll updates - update global store and modal state
    const handlePollUpdate = useCallback(
        (statusId: string, poll: mastodon.v1.Poll) => {
            updatePollGlobal(statusId, poll);
            // Also update detail modal state if the status is currently displayed
            setDetailStatus((prev) => {
                if (!prev) return prev;
                if (prev.id === statusId) return { ...prev, poll };
                if (prev.reblog?.id === statusId)
                    return { ...prev, reblog: { ...prev.reblog, poll } };
                return prev;
            });
        },
        [updatePollGlobal]
    );

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar
                onAddAccount={() => setIsLoginModalOpen(true)}
                onCompose={() => setIsComposeModalOpen(true)}
            />

            <main className="flex-1 flex overflow-hidden">
                <ColumnContainer
                    onAddColumn={() => setIsAddColumnModalOpen(true)}
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

            <LoginModal
                isOpen={shouldShowLoginModal}
                onClose={() => setIsLoginModalOpen(false)}
                canClose={accounts.length > 0}
            />
            <AddColumnModal
                key={isAddColumnModalOpen ? 'open' : 'closed'}
                isOpen={isAddColumnModalOpen}
                onClose={() => setIsAddColumnModalOpen(false)}
            />
            <ComposeModal
                isOpen={isComposeModalOpen}
                onClose={handleComposeClose}
                replyToStatus={replyToStatus}
                quoteToStatus={quoteToStatus}
                accountId={replyAccountId ?? quoteAccountId}
                editTarget={editTarget}
                onStatusEdited={handleStatusEdited}
            />
            <StatusDetailModal
                isOpen={isStatusDetailOpen}
                onClose={handleDetailModalClose}
                status={detailStatus}
                accountSession={detailAccountSession}
                onReply={handleStatusDetailReply}
                onQuote={handleStatusDetailQuote}
                onStatusUpdate={updateStatusGlobal}
                onPollUpdate={handlePollUpdate}
                onStatusDelete={handleStatusDeleteRequest}
                onStatusEdit={handleStatusEditRequest}
                onImageClick={handleImageClick}
                onVideoClick={handleVideoClick}
                onAudioClick={handleAudioClick}
                nsfwRevealedStatusIds={nsfwRevealedStatusIdSet}
                onNsfwReveal={addNsfwRevealedStatusId}
            />
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={handleProfileModalClose}
                account={profileAccount}
                accountSession={profileAccountSession}
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
                supportsQuotes={profileInstanceConfig?.supportsQuotes ?? false}
                deletedStatusId={deletedStatusId}
            />
            <ImageViewer
                key={`image-viewer-${imageViewerKey}`}
                isOpen={isImageViewerOpen}
                onClose={handleImageViewerClose}
                images={viewerImages}
                initialIndex={viewerInitialIndex}
            />
            <VideoViewer
                key={`video-viewer-${videoViewerKey}`}
                isOpen={isVideoViewerOpen}
                onClose={handleVideoViewerClose}
                videos={viewerVideos}
                initialIndex={viewerInitialVideoIndex}
            />
            <AudioPlayer
                key={`audio-player-${audioPlayerKey}`}
                isOpen={isAudioPlayerOpen}
                onClose={handleAudioPlayerClose}
                tracks={audioTracks}
                initialIndex={audioInitialIndex}
            />
            <ConfirmModal
                isOpen={isDeleteConfirmOpen}
                onClose={handleDeleteConfirmClose}
                onConfirm={handleStatusDeleteConfirm}
                title="投稿を削除"
                message="この投稿を削除してもよろしいですか？この操作は取り消せません。"
                confirmLabel="削除"
                variant="danger"
                isLoading={isDeleteLoading}
                error={deleteError}
            />
        </div>
    );
}

export default App;
