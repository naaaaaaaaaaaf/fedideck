import { useCallback } from 'react';
import type { mastodon } from 'masto';
import { LoginModal } from './LoginModal';
import { AddColumnModal } from './AddColumnModal';
import { ComposeModal } from './ComposeModal';
import { StatusDetailModal } from './StatusDetailModal';
import { ProfileModal } from './ProfileModal';
import { ImageViewer } from './ImageViewer';
import { VideoViewer } from './VideoViewer';
import { AudioPlayer } from './AudioPlayer';
import { ConfirmModal } from './ConfirmModal';
import type { ImageViewerImage } from '../types/image';
import type { VideoViewerVideo } from '../types/video';
import type { AudioViewerTrack } from '../types/audio';
import { useAccountsStore } from '../store/accounts';
import { getClient, deleteStatus } from '../api/mastoClient';
import { useStreamsStore } from '../store/streams';
import { useModalsStore, type StackEntry } from '../store/modals';

// Z-index constants for modal layers
const Z_INDEX = {
    stackBase: 50,
    overlay: 70,
    confirm: 75,
    utility: 80,
} as const;

export interface ModalHostProps {
    // Callbacks from App (shared with ColumnContainer/Sidebar)
    onReply: (status: mastodon.v1.Status, accountId: string) => void;
    onQuote: (status: mastodon.v1.Status, accountId: string) => void;
    onStatusClick: (status: mastodon.v1.Status, accountId: string) => void;
    onImageClick: (images: ImageViewerImage[], index: number) => void;
    onVideoClick: (videos: VideoViewerVideo[], index: number) => void;
    onAudioClick: (tracks: AudioViewerTrack[], index: number) => void;
    onAccountClick: (account: mastodon.v1.Account, accountSessionId: string | undefined) => void;
    onStatusDeleteRequest: (
        status: mastodon.v1.Status,
        accountId: string,
        originStackEntryId?: string
    ) => void;
    onStatusEditRequest: (status: mastodon.v1.Status, accountSessionId: string) => void;
    onStatusUpdateGlobal: (updatedStatus: mastodon.v1.Status) => void;
    onPollUpdateGlobal: (statusId: string, poll: mastodon.v1.Poll) => void;
    onStatusEdited: (updatedStatus: mastodon.v1.Status, accountSessionId?: string) => void;
    nsfwRevealedStatusIdSet: Set<string>;
    addNsfwRevealedStatusId: (statusId: string) => void;
    shouldShowLoginModal: boolean;
}

export function ModalHost({
    onReply,
    onQuote,
    onStatusClick,
    onImageClick,
    onVideoClick,
    onAudioClick,
    onAccountClick,
    onStatusDeleteRequest,
    onStatusEditRequest,
    onStatusUpdateGlobal,
    onPollUpdateGlobal,
    onStatusEdited,
    nsfwRevealedStatusIdSet,
    addNsfwRevealedStatusId,
    shouldShowLoginModal,
}: ModalHostProps) {
    // Accounts store (for finding sessions by id)
    const accounts = useAccountsStore((s) => s.accounts);

    // Streams store (for delete handler)
    const removeStatusForAccountStreams = useStreamsStore((s) => s.removeStatusForAccountStreams);

    // Modal store — data selectors only (actions via getState())
    const stack = useModalsStore((s) => s.stack);
    const compose = useModalsStore((s) => s.compose);
    const confirm = useModalsStore((s) => s.confirm);
    const imageViewer = useModalsStore((s) => s.imageViewer);
    const videoViewer = useModalsStore((s) => s.videoViewer);
    const audioPlayer = useModalsStore((s) => s.audioPlayer);
    const isAddColumnOpen = useModalsStore((s) => s.isAddColumnOpen);
    const confirmLoading = useModalsStore((s) => s.confirmLoading);
    const confirmError = useModalsStore((s) => s.confirmError);
    const deletedStatusEvents = useModalsStore((s) => s.deletedStatusEvents);

    // Handle confirmed delete
    const handleStatusDeleteConfirm = useCallback(async () => {
        const state = useModalsStore.getState();
        if (!state.confirm || state.confirmLoading) return;
        const { confirm: confirmData } = state;

        const session = accounts.find((a) => a.id === confirmData.accountId);
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
            await deleteStatus(client, confirmData.status.id);
            removeStatusForAccountStreams(confirmData.accountId, confirmData.status.id);

            // Notify ProfileModal to remove deleted status from local list
            store.pushDeletedStatusEvent({
                statusId: confirmData.status.id,
                accountSessionId: confirmData.accountId,
            });

            // Remove stack entry — prefer direct entry id when available for navigated status accuracy
            if (confirmData.originStackEntryId) {
                useModalsStore.getState().removeStackEntryById(confirmData.originStackEntryId);
            } else {
                useModalsStore.getState().removeStatusFromStack({
                    statusId: confirmData.status.id,
                    accountSessionId: confirmData.accountId,
                });
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
    }, [accounts, removeStatusForAccountStreams]);

    // ── Render helpers ────────────────────────────────────────────────────

    // Whether any overlay is blocking the navigation stack
    const hasBlockingOverlay =
        !!compose ||
        !!confirm ||
        !!imageViewer ||
        !!videoViewer ||
        !!audioPlayer ||
        shouldShowLoginModal ||
        isAddColumnOpen;

    // Only the topmost overlay should have aria-modal and focus trap active.
    // Priority: utility > confirm > viewers > compose.
    const activeOverlay = isAddColumnOpen
        ? 'addColumn'
        : shouldShowLoginModal
          ? 'login'
          : confirm
            ? 'confirm'
            : audioPlayer
              ? 'audio'
              : videoViewer
                ? 'video'
                : imageViewer
                  ? 'image'
                  : compose
                    ? 'compose'
                    : null;

    const renderStackEntry = (entry: StackEntry, index: number) => {
        const zIndex = Z_INDEX.stackBase + index;
        const isStackTop = index === stack.length - 1;
        const isActive = isStackTop && !hasBlockingOverlay;

        if (entry.type === 'statusDetail') {
            const accountSession = accounts.find((a) => a.id === entry.accountSessionId);
            return (
                <StatusDetailModal
                    key={entry.id}
                    isOpen={isStackTop}
                    isActive={isActive}
                    onClose={useModalsStore.getState().goBack}
                    status={entry.status}
                    accountSession={accountSession}
                    onReply={(status) => {
                        if (accountSession) onReply(status, accountSession.id);
                    }}
                    onQuote={(status) => {
                        if (accountSession) onQuote(status, accountSession.id);
                    }}
                    onStatusUpdate={(updatedStatus) => {
                        onStatusUpdateGlobal(updatedStatus);
                        useModalsStore.getState().updateStackStatus(
                            {
                                statusId: updatedStatus.id,
                                accountSessionId: entry.accountSessionId,
                            },
                            updatedStatus
                        );
                    }}
                    onPollUpdate={(statusId, poll) => {
                        onPollUpdateGlobal(statusId, poll);
                        useModalsStore
                            .getState()
                            .updateStackPoll(
                                { statusId, accountSessionId: entry.accountSessionId },
                                poll
                            );
                    }}
                    onStatusDelete={(status, accountId) =>
                        onStatusDeleteRequest(status, accountId, entry.id)
                    }
                    onStatusEdit={onStatusEditRequest}
                    onImageClick={onImageClick}
                    onVideoClick={onVideoClick}
                    onAudioClick={onAudioClick}
                    onAccountClick={onAccountClick}
                    nsfwRevealedStatusIds={nsfwRevealedStatusIdSet}
                    onNsfwReveal={addNsfwRevealedStatusId}
                    zIndex={zIndex}
                />
            );
        }

        if (entry.type === 'profile') {
            const accountSession = accounts.find((a) => a.id === entry.accountSessionId);
            return (
                <ProfileModal
                    key={entry.id}
                    isOpen={isStackTop}
                    isActive={isActive}
                    onClose={useModalsStore.getState().goBack}
                    account={entry.account}
                    accountSession={accountSession}
                    onReply={onReply}
                    onQuote={onQuote}
                    onStatusClick={onStatusClick}
                    onImageClick={onImageClick}
                    onVideoClick={onVideoClick}
                    onAudioClick={onAudioClick}
                    onAccountClick={onAccountClick}
                    onNsfwReveal={addNsfwRevealedStatusId}
                    nsfwRevealedStatusIds={nsfwRevealedStatusIdSet}
                    onStatusUpdate={(updatedStatus) => {
                        onStatusUpdateGlobal(updatedStatus);
                        if (entry.accountSessionId) {
                            useModalsStore.getState().updateStackStatus(
                                {
                                    statusId: updatedStatus.id,
                                    accountSessionId: entry.accountSessionId,
                                },
                                updatedStatus
                            );
                        }
                    }}
                    onStatusDelete={(status, accountId) => onStatusDeleteRequest(status, accountId)}
                    onStatusEdit={onStatusEditRequest}
                    deletedStatusEvents={deletedStatusEvents}
                    onDeletedStatusConsumed={(ids) =>
                        useModalsStore.getState().pruneDeletedStatusEvents(ids)
                    }
                    zIndex={zIndex}
                />
            );
        }

        return null;
    };

    return (
        <>
            {/* Navigation stack */}
            {stack.map(renderStackEntry)}

            {/* Overlay: Compose */}
            <ComposeModal
                isOpen={!!compose}
                isActive={activeOverlay === 'compose'}
                onClose={() => useModalsStore.getState().closeCompose()}
                replyToStatus={compose?.mode === 'reply' ? compose.replyToStatus : undefined}
                quoteToStatus={compose?.mode === 'quote' ? compose.quoteToStatus : undefined}
                accountId={compose?.accountId}
                editTarget={compose?.mode === 'edit' ? compose.editTarget : undefined}
                onStatusEdited={(updatedStatus) =>
                    onStatusEdited(updatedStatus, compose?.accountId)
                }
                zIndex={Z_INDEX.overlay}
            />

            {/* Overlay: Confirm */}
            <ConfirmModal
                isOpen={!!confirm}
                isActive={activeOverlay === 'confirm'}
                onClose={() => useModalsStore.getState().closeConfirm()}
                onConfirm={handleStatusDeleteConfirm}
                title="投稿を削除"
                message="この投稿を削除してもよろしいですか？この操作は取り消せません。"
                confirmLabel="削除"
                variant="danger"
                isLoading={confirmLoading}
                error={confirmError}
                zIndex={Z_INDEX.confirm}
            />

            {/* Viewers */}
            {imageViewer && (
                <ImageViewer
                    key={`image-viewer-${imageViewer.key}`}
                    isOpen={true}
                    isActive={activeOverlay === 'image'}
                    onClose={() => useModalsStore.getState().closeImageViewer()}
                    images={imageViewer.images}
                    initialIndex={imageViewer.initialIndex}
                    zIndex={Z_INDEX.overlay}
                />
            )}
            {videoViewer && (
                <VideoViewer
                    key={`video-viewer-${videoViewer.key}`}
                    isOpen={true}
                    isActive={activeOverlay === 'video'}
                    onClose={() => useModalsStore.getState().closeVideoViewer()}
                    videos={videoViewer.videos}
                    initialIndex={videoViewer.initialIndex}
                    zIndex={Z_INDEX.overlay}
                />
            )}
            {audioPlayer && (
                <AudioPlayer
                    key={`audio-player-${audioPlayer.key}`}
                    isOpen={true}
                    isActive={activeOverlay === 'audio'}
                    onClose={() => useModalsStore.getState().closeAudioPlayer()}
                    tracks={audioPlayer.tracks}
                    initialIndex={audioPlayer.initialIndex}
                    zIndex={Z_INDEX.overlay}
                />
            )}

            {/* Utility modals */}
            <LoginModal
                isOpen={shouldShowLoginModal}
                isActive={activeOverlay === 'login'}
                onClose={() => useModalsStore.getState().closeLogin()}
                canClose={accounts.length > 0}
                zIndex={Z_INDEX.utility}
            />
            <AddColumnModal
                key={isAddColumnOpen ? 'open' : 'closed'}
                isOpen={isAddColumnOpen}
                isActive={activeOverlay === 'addColumn'}
                onClose={() => useModalsStore.getState().closeAddColumn()}
                zIndex={Z_INDEX.utility}
            />
        </>
    );
}
